import { z } from "zod";
import { htmlToText } from "../text.js";
import { DAY_MS, activeCourseIds, readOnly, run } from "./shared.js";

/** Upper bound on discussion replies returned, to keep responses a sensible size. */
const MAX_DISCUSSION_REPLIES = 150;

/** Announcements, discussions, inbox and the activity stream. None of these mark anything as read. */
export function registerCommunicationTools(server, canvas) {
	server.registerTool(
		"get_announcements",
		{
			description: "Recent announcements. Omit course_id for all active courses.",
			inputSchema: {
				course_id: z.number().int().optional(),
				days: z.number().int().min(1).max(120).default(14).describe("How many days back to look"),
			},
			annotations: readOnly,
		},
		async ({ course_id, days }) =>
			run(async () => {
				const ids = course_id ? [course_id] : await activeCourseIds(canvas);
				if (ids.length === 0) return [];
				const list = await canvas.getList("/announcements", {
					"context_codes[]": ids.map((id) => `course_${id}`),
					start_date: new Date(Date.now() - days * DAY_MS).toISOString(),
					end_date: new Date().toISOString(),
				});
				return list.map((a) => ({
					course: a.context_code,
					title: a.title,
					posted_at: a.posted_at,
					author: a.author?.display_name,
					message: htmlToText(a.message),
					url: a.html_url,
				}));
			}),
	);

	server.registerTool(
		"list_discussions",
		{
			description: "Discussion topics in a course (not announcements), newest activity first.",
			inputSchema: { course_id: z.number().int() },
			annotations: readOnly,
		},
		async ({ course_id }) =>
			run(async () => {
				const list = await canvas.getList(`/courses/${course_id}/discussion_topics`, {
					order_by: "recent_activity",
				});
				return list.map((t) => ({
					id: t.id,
					title: t.title,
					author: t.author?.display_name,
					posted_at: t.posted_at,
					last_reply_at: t.last_reply_at,
					replies: t.discussion_subentry_count,
					unread: t.unread_count,
					graded: Boolean(t.assignment_id),
					due_at: t.assignment?.due_at,
					locked: t.locked,
					url: t.html_url,
				}));
			}),
	);

	server.registerTool(
		"get_discussion",
		{
			description:
				"One discussion topic: the prompt plus the full thread of replies. Does not mark anything as read. Some topics hide replies until the student has posted.",
			inputSchema: { course_id: z.number().int(), topic_id: z.number().int() },
			annotations: readOnly,
		},
		async ({ course_id, topic_id }) =>
			run(async () => {
				const base = `/courses/${course_id}/discussion_topics/${topic_id}`;
				const topic = await canvas.getOne(base);
				const view = await canvas.getOne(`${base}/view`).catch((e) => ({ error: String(e?.message ?? e) }));
				const names = new Map((view.participants ?? []).map((p) => [p.id, p.display_name]));
				let budget = MAX_DISCUSSION_REPLIES;
				const walk = (entries = []) =>
					entries
						.filter(() => budget-- > 0)
						.map((e) => ({
							author: names.get(e.user_id) ?? e.user_name,
							at: e.created_at,
							message: e.deleted ? "(deleted)" : htmlToText(e.message, 2000),
							replies: e.replies?.length ? walk(e.replies) : undefined,
						}));
				return {
					title: topic.title,
					author: topic.author?.display_name,
					posted_at: topic.posted_at,
					require_initial_post: topic.require_initial_post,
					prompt: htmlToText(topic.message),
					replies: view.error ? undefined : walk(view.view),
					replies_unavailable: view.error,
					url: topic.html_url,
				};
			}),
	);

	server.registerTool(
		"list_inbox",
		{
			description: "Canvas Inbox conversations (messages from instructors/TAs/classmates). Listing does not mark anything as read.",
			inputSchema: {
				scope: z.enum(["inbox", "unread", "starred", "sent", "archived"]).default("inbox"),
			},
			annotations: readOnly,
		},
		async ({ scope }) =>
			run(async () => {
				const list = await canvas.getList("/conversations", { scope: scope === "inbox" ? undefined : scope });
				return list.map((c) => ({
					id: c.id,
					subject: c.subject,
					course: c.context_name,
					participants: (c.participants ?? []).map((p) => p.name),
					last_message_at: c.last_message_at,
					unread: c.workflow_state === "unread",
					preview: c.last_message,
				}));
			}),
	);

	server.registerTool(
		"get_inbox_message",
		{
			description: "Full message thread of one Inbox conversation. Reads WITHOUT marking it as read.",
			inputSchema: { conversation_id: z.number().int() },
			annotations: readOnly,
		},
		async ({ conversation_id }) =>
			run(async () => {
				// Canvas marks a conversation as read on GET unless told otherwise.
				const c = await canvas.getOne(`/conversations/${conversation_id}`, { auto_mark_as_read: "false" });
				const names = new Map((c.participants ?? []).map((p) => [p.id, p.name]));
				return {
					subject: c.subject,
					course: c.context_name,
					messages: (c.messages ?? []).map((m) => ({
						from: names.get(m.author_id),
						at: m.created_at,
						body: String(m.body ?? "").slice(0, 4000),
						attachments: m.attachments?.map((a) => ({ id: a.id, name: a.display_name })),
					})),
				};
			}),
	);

	server.registerTool(
		"get_recent_activity",
		{
			description:
				"The student's Canvas activity stream: newly posted grades, feedback comments, announcements, discussion replies and messages. Good for 'what's new since yesterday'.",
			inputSchema: { limit: z.number().int().min(1).max(100).default(30) },
			annotations: readOnly,
		},
		async ({ limit }) =>
			run(async () => {
				const list = await canvas.getList("/users/self/activity_stream", {
					only_active_courses: "true",
					per_page: Math.min(limit, 100),
				});
				return list.slice(0, limit).map((a) => ({
					type: a.type,
					course_id: a.course_id,
					title: a.title,
					at: a.updated_at ?? a.created_at,
					message: htmlToText(a.message, 500) || undefined,
					score: a.score,
					grade: a.grade,
					url: a.html_url,
				}));
			}),
	);
}
