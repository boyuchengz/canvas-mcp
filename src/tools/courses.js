import { z } from "zod";
import { htmlToText } from "../text.js";
import { readOnly, run } from "./shared.js";

/** Courses and their content: syllabus, modules, wiki pages, staff, groups. */
export function registerCourseTools(server, canvas) {
	server.registerTool(
		"list_courses",
		{
			description: "List the student's active Canvas courses with IDs. Call this first to get course_id values.",
			inputSchema: {},
			annotations: readOnly,
		},
		async () =>
			run(async () => {
				const courses = await canvas.getList("/courses", {
					enrollment_state: "active",
					"include[]": ["term"],
				});
				return courses.map((c) => ({
					id: c.id,
					name: c.name,
					code: c.course_code,
					term: c.term?.name,
				}));
			}),
	);

	server.registerTool(
		"get_syllabus",
		{
			description: "The syllabus text of a course (grading policy, schedule, late policy, if the instructor posted it).",
			inputSchema: { course_id: z.number().int() },
			annotations: readOnly,
		},
		async ({ course_id }) =>
			run(async () => {
				const c = await canvas.getOne(`/courses/${course_id}`, { "include[]": ["syllabus_body"] });
				return { course: c.name, syllabus: htmlToText(c.syllabus_body) || "(no syllabus posted on Canvas)" };
			}),
	);

	server.registerTool(
		"get_front_page",
		{
			description: "The course home page text, where instructors often put key links, schedule and contact info.",
			inputSchema: { course_id: z.number().int() },
			annotations: readOnly,
		},
		async ({ course_id }) =>
			run(async () => {
				const p = await canvas.getOne(`/courses/${course_id}/front_page`);
				return { title: p.title, updated_at: p.updated_at, body: htmlToText(p.body), url: p.html_url };
			}),
	);

	server.registerTool(
		"list_modules",
		{
			description: "Course content outline: modules and the items (pages, files, assignments, links) inside each.",
			inputSchema: { course_id: z.number().int() },
			annotations: readOnly,
		},
		async ({ course_id }) =>
			run(async () => {
				const mods = await canvas.getList(`/courses/${course_id}/modules`, { "include[]": ["items"] });
				return mods.map((m) => ({
					id: m.id,
					name: m.name,
					state: m.state,
					items: (m.items ?? []).map((i) => ({
						title: i.title,
						type: i.type,
						page_url: i.page_url,
						content_id: i.content_id,
						url: i.html_url,
					})),
				}));
			}),
	);

	server.registerTool(
		"list_pages",
		{
			description: "All wiki pages in a course (some courses keep notes outside Modules). Use get_page to read one.",
			inputSchema: { course_id: z.number().int() },
			annotations: readOnly,
		},
		async ({ course_id }) =>
			run(async () => {
				const list = await canvas.getList(`/courses/${course_id}/pages`, { sort: "updated_at", order: "desc" });
				return list.map((p) => ({
					title: p.title,
					page_url: p.url,
					updated_at: p.updated_at,
					front_page: p.front_page,
				}));
			}),
	);

	server.registerTool(
		"get_page",
		{
			description: "Read the text of a Canvas wiki page. page_url comes from list_modules (e.g. 'week-3-notes').",
			inputSchema: { course_id: z.number().int(), page_url: z.string() },
			annotations: readOnly,
		},
		async ({ course_id, page_url }) =>
			run(async () => {
				const p = await canvas.getOne(`/courses/${course_id}/pages/${encodeURIComponent(page_url)}`);
				return { title: p.title, updated_at: p.updated_at, body: htmlToText(p.body), url: p.html_url };
			}),
	);

	server.registerTool(
		"list_course_staff",
		{
			description: "Instructors and TAs of a course, with email when Canvas exposes it.",
			inputSchema: { course_id: z.number().int() },
			annotations: readOnly,
		},
		async ({ course_id }) =>
			run(async () => {
				const list = await canvas.getList(`/courses/${course_id}/users`, {
					"enrollment_type[]": ["teacher", "ta"],
					"include[]": ["enrollments", "email", "bio"],
				});
				return list.map((u) => ({
					name: u.name,
					role: [...new Set((u.enrollments ?? []).map((x) => x.type))].join(", "),
					email: u.email,
					bio: u.bio || undefined,
				}));
			}),
	);

	server.registerTool(
		"list_groups",
		{
			description: "Student groups (project teams, lab sections) the student belongs to.",
			inputSchema: {},
			annotations: readOnly,
		},
		async () =>
			run(async () => {
				const list = await canvas.getList("/users/self/groups");
				return list.map((g) => ({
					id: g.id,
					name: g.name,
					course_id: g.course_id,
					members: g.members_count,
				}));
			}),
	);
}
