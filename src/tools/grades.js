import { z } from "zod";
import { readOnly, run, studentEnrollment } from "./shared.js";

/** Course totals and the assignment-group math behind them. */
export function registerGradeTools(server, canvas) {
	server.registerTool(
		"get_grades",
		{
			description: "Current overall grade/score in every active course.",
			inputSchema: {},
			annotations: readOnly,
		},
		async () =>
			run(async () => {
				const courses = await canvas.getList("/courses", {
					enrollment_state: "active",
					"include[]": ["total_scores"],
				});
				return courses.map((c) => {
					const e = studentEnrollment(c);
					return {
						course_id: c.id,
						course: c.name,
						current_score: e?.computed_current_score,
						current_grade: e?.computed_current_grade,
						final_score: e?.computed_final_score,
						final_grade: e?.computed_final_grade,
					};
				});
			}),
	);

	server.registerTool(
		"get_grade_breakdown",
		{
			description:
				"How the course grade is built: assignment groups with their weights, every assignment's score, and drop rules. Use for 'what do I need on the final' style questions.",
			inputSchema: { course_id: z.number().int() },
			annotations: readOnly,
		},
		async ({ course_id }) =>
			run(async () => {
				const [course, groups] = await Promise.all([
					canvas.getOne(`/courses/${course_id}`, { "include[]": ["total_scores"] }),
					canvas.getList(`/courses/${course_id}/assignment_groups`, {
						"include[]": ["assignments", "submission"],
					}),
				]);
				const e = studentEnrollment(course);
				return {
					course: course.name,
					weighted_groups: course.apply_assignment_group_weights,
					current_score: e?.computed_current_score,
					current_grade: e?.computed_current_grade,
					groups: groups.map((g) => ({
						name: g.name,
						weight_percent: g.group_weight,
						drop_lowest: g.rules?.drop_lowest,
						drop_highest: g.rules?.drop_highest,
						assignments: (g.assignments ?? []).map((a) => ({
							id: a.id,
							name: a.name,
							due_at: a.due_at,
							points_possible: a.points_possible,
							score: a.submission?.score,
							state: a.submission?.workflow_state,
							excused: a.submission?.excused,
							omit_from_final_grade: a.omit_from_final_grade,
						})),
					})),
				};
			}),
	);
}
