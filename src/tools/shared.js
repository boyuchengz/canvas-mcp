/** Every tool in this server only reads; clients may use this to skip confirmation prompts. */
export const readOnly = { readOnlyHint: true, openWorldHint: true };

export const DAY_MS = 86_400_000;

/** Runs a tool body and wraps its result (or error) in an MCP tool response. */
export async function run(fn) {
	try {
		const data = await fn();
		return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
	} catch (err) {
		return {
			isError: true,
			content: [{ type: "text", text: err instanceof Error ? err.message : String(err) }],
		};
	}
}

/** IDs of the student's active courses, used when a tool is called without course_id. */
export async function activeCourseIds(canvas) {
	const courses = await canvas.getList("/courses", { enrollment_state: "active" });
	return courses.map((c) => c.id);
}

/** Picks the student enrollment from a course payload (falls back to the first one). */
export function studentEnrollment(course) {
	return (course.enrollments ?? []).find((e) => e.type === "student") ?? course.enrollments?.[0];
}
