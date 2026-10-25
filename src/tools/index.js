import { registerCommunicationTools } from "./communication.js";
import { registerCourseTools } from "./courses.js";
import { registerCourseworkTools } from "./coursework.js";
import { registerFileTools } from "./files.js";
import { registerGradeTools } from "./grades.js";

export function registerTools(server, canvas) {
	registerCourseTools(server, canvas);
	registerCourseworkTools(server, canvas);
	registerGradeTools(server, canvas);
	registerFileTools(server, canvas);
	registerCommunicationTools(server, canvas);
}
