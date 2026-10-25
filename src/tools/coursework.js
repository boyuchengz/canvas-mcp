import { z } from "zod";
import { htmlToText } from "../text.js";
import { DAY_MS, activeCourseIds, readOnly, run } from "./shared.js";

/** Deadlines and graded work: planner, to-do, assignments, quizzes, calendar. */
export function registerCourseworkTools(server, canvas) {
	server.registerTool(
		"get_upcoming",
		{
			description:
				"Everything due across all courses in the next N days (assignments, quizzes, discussions), with submission status. Best tool for 'what is due this week'.",
			inputSchema: {
				days: z.number().int().min(1).max(60).default(7).describe("How many days ahead to look"),
			},
			annotations: readOnly,
		},
		async ({ days }) =>
			run(async () => {
				const start = new Date();
				const end = new Date(start.getTime() + days * DAY_MS);
				const items = await canvas.getList("/planner/items", {
					start_date: start.toISOString(),
					end_date: end.toISOString(),
					order: "asc",
				});
				return items.map((i) => ({
					course: i.context_name,
					course_id: i.course_id,
					type: i.plannable_type,
					title: i.plannable?.title ?? i.plannable?.name,
					due_at: i.plannable?.due_at ?? i.plannable_date,
					points: i.plannable?.points_possible,
					submitted: i.submissions ? i.submissions.submitted : undefined,
					graded: i.submissions ? i.submissions.graded : undefined,
					missing: i.submissions ? i.submissions.missing : undefined,
					url: canvas.resolve(i.html_url),
				}));
			}),
	);

	server.registerTool(
		"get_todo",
		{
			description: "The student's Canvas To Do list (items that still need submitting).",
			inputSchema: {},
			annotations: readOnly,
		},
		async () =>
			run(async () => {
				const items = await canvas.getList("/users/self/todo");
				return items.map((i) => ({
					type: i.type,
					course_id: i.course_id,
					title: i.assignment?.name ?? i.quiz?.title,
					due_at: i.assignment?.due_at ?? i.quiz?.due_at,
					points: i.assignment?.points_possible,
					url: i.html_url,
				}));
			}),
	);

	server.registerTool(
		"get_missing",
		{
			description: "Past-due assignments across all courses that the student has not submitted.",
			inputSchema: {},
			annotations: readOnly,
		},
		async () =>
			run(async () => {
				const list = await canvas.getList("/users/self/missing_submissions", {
					"include[]": ["course"],
					"filter[]": ["submittable"],
				});
				return list.map((a) => ({
					course: a.course?.name,
					course_id: a.course_id,
					assignment_id: a.id,
					name: a.name,
					due_at: a.due_at,
					lock_at: a.lock_at,
					points_possible: a.points_possible,
					url: a.html_url,
				}));
			}),
	);

	server.registerTool(
		"list_assignments",
		{
			description:
				"All assignments in one course with due dates and the student's own score for each. Use bucket to filter.",
			inputSchema: {
				course_id: z.number().int(),
				bucket: z.enum(["past", "overdue", "undated", "ungraded", "unsubmitted", "upcoming", "future"]).optional(),
			},
			annotations: readOnly,
		},
		async ({ course_id, bucket }) =>
			run(async () => {
				const list = await canvas.getList(`/courses/${course_id}/assignments`, {
					"include[]": ["submission"],
					order_by: "due_at",
					bucket,
				});
				return list.map((a) => ({
					id: a.id,
					name: a.name,
					due_at: a.due_at,
					lock_at: a.lock_at,
					points_possible: a.points_possible,
					submission_types: a.submission_types,
					state: a.submission?.workflow_state,
					submitted_at: a.submission?.submitted_at,
					score: a.submission?.score,
					grade: a.submission?.grade,
					late: a.submission?.late,
					missing: a.submission?.missing,
					url: a.html_url,
				}));
			}),
	);

	server.registerTool(
		"get_assignment",
		{
			description: "Full details of one assignment: instructions text, rubric, and teacher comments on the submission.",
			inputSchema: { course_id: z.number().int(), assignment_id: z.number().int() },
			annotations: readOnly,
		},
		async ({ course_id, assignment_id }) =>
			run(async () => {
				const base = `/courses/${course_id}/assignments/${assignment_id}`;
				const a = await canvas.getOne(base);
				const s = await canvas
					.getOne(`${base}/submissions/self`, { "include[]": ["submission_comments", "rubric_assessment"] })
					.catch(() => undefined);
				return {
					name: a.name,
					due_at: a.due_at,
					points_possible: a.points_possible,
					submission_types: a.submission_types,
					allowed_attempts: a.allowed_attempts,
					instructions: htmlToText(a.description),
					rubric: a.rubric?.map((r) => ({ criterion: r.description, points: r.points })),
					submission: s && {
						state: s.workflow_state,
						submitted_at: s.submitted_at,
						score: s.score,
						grade: s.grade,
						late: s.late,
						comments: s.submission_comments?.map((c) => ({
							author: c.author_name,
							at: c.created_at,
							comment: c.comment,
						})),
					},
					url: a.html_url,
				};
			}),
	);

	server.registerTool(
		"list_quizzes",
		{
			description:
				"Classic Quizzes in a course with dates, time limit and attempts. Note: 'New Quizzes' do not appear here; they show up in list_assignments instead.",
			inputSchema: { course_id: z.number().int() },
			annotations: readOnly,
		},
		async ({ course_id }) =>
			run(async () => {
				const list = await canvas.getList(`/courses/${course_id}/quizzes`);
				return list.map((q) => ({
					id: q.id,
					title: q.title,
					type: q.quiz_type,
					due_at: q.due_at,
					unlock_at: q.unlock_at,
					lock_at: q.lock_at,
					time_limit_min: q.time_limit,
					allowed_attempts: q.allowed_attempts,
					questions: q.question_count,
					points_possible: q.points_possible,
					locked_for_user: q.locked_for_user,
					url: q.html_url,
				}));
			}),
	);

	server.registerTool(
		"get_quiz",
		{
			description:
				"Details of one Classic Quiz: instructions, settings, and the student's own attempts and scores. Quiz questions themselves are not exposed to students by the Canvas API.",
			inputSchema: { course_id: z.number().int(), quiz_id: z.number().int() },
			annotations: readOnly,
		},
		async ({ course_id, quiz_id }) =>
			run(async () => {
				const base = `/courses/${course_id}/quizzes/${quiz_id}`;
				const q = await canvas.getOne(base);
				const subs = await canvas.getOne(`${base}/submissions`).catch(() => undefined);
				return {
					title: q.title,
					instructions: htmlToText(q.description),
					due_at: q.due_at,
					unlock_at: q.unlock_at,
					lock_at: q.lock_at,
					time_limit_min: q.time_limit,
					allowed_attempts: q.allowed_attempts,
					scoring_policy: q.scoring_policy,
					questions: q.question_count,
					points_possible: q.points_possible,
					shows_correct_answers: q.show_correct_answers,
					one_question_at_a_time: q.one_question_at_a_time,
					cant_go_back: q.cant_go_back,
					my_attempts: subs?.quiz_submissions?.map((s) => ({
						attempt: s.attempt,
						state: s.workflow_state,
						started_at: s.started_at,
						finished_at: s.finished_at,
						score: s.score,
						kept_score: s.kept_score,
						time_spent_sec: s.time_spent,
					})),
					url: q.html_url,
				};
			}),
	);

	server.registerTool(
		"get_calendar_events",
		{
			description:
				"Calendar events (lectures, exams, office hours, review sessions) that instructors put on the Canvas calendar. Assignments are covered by get_upcoming instead.",
			inputSchema: {
				days: z.number().int().min(1).max(120).default(14).describe("How many days ahead to look"),
				course_id: z.number().int().optional(),
			},
			annotations: readOnly,
		},
		async ({ days, course_id }) =>
			run(async () => {
				const ids = course_id ? [course_id] : await activeCourseIds(canvas);
				if (ids.length === 0) return [];
				const list = await canvas.getList("/calendar_events", {
					type: "event",
					start_date: new Date().toISOString(),
					end_date: new Date(Date.now() + days * DAY_MS).toISOString(),
					// Canvas accepts at most 10 context codes per calendar request.
					"context_codes[]": ids.slice(0, 10).map((id) => `course_${id}`),
				});
				return list.map((ev) => ({
					title: ev.title,
					course: ev.context_name ?? ev.context_code,
					start_at: ev.start_at,
					end_at: ev.end_at,
					location: ev.location_name || undefined,
					description: htmlToText(ev.description, 1000) || undefined,
					url: ev.html_url,
				}));
			}),
	);
}
