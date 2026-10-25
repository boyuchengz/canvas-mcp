import { z } from "zod";
import { MAX_TEXT, htmlToText } from "../text.js";
import { readOnly, run } from "./shared.js";

/** Text files larger than this are returned as a link only. */
const MAX_FILE_BYTES = 1_000_000;

const TEXTUAL_TYPE = /json|xml|javascript|x-python|x-java|x-c|x-sh|markdown/;

/** Course files: listing with folder names, metadata, and inline text content. */
export function registerFileTools(server, canvas) {
	server.registerTool(
		"list_files",
		{
			description:
				"Files in a course (lecture slides, handouts, etc.). Optional search term filters by file name. Returns file IDs for get_file.",
			inputSchema: {
				course_id: z.number().int(),
				search: z.string().min(2).optional().describe("Partial file name to search for"),
			},
			annotations: readOnly,
		},
		async ({ course_id, search }) =>
			run(async () => {
				const [files, folders] = await Promise.all([
					canvas.getList(`/courses/${course_id}/files`, {
						search_term: search,
						sort: "updated_at",
						order: "desc",
					}),
					canvas.getList(`/courses/${course_id}/folders`).catch(() => []),
				]);
				const folderName = new Map(folders.map((f) => [f.id, f.full_name]));
				return files.map((f) => ({
					id: f.id,
					name: f.display_name,
					folder: folderName.get(f.folder_id),
					type: f["content-type"],
					size_kb: Math.round((f.size ?? 0) / 1024),
					updated_at: f.updated_at,
				}));
			}),
	);

	server.registerTool(
		"get_file",
		{
			description:
				"Metadata and a temporary download link for one file. For text-based files (txt, md, html, csv, code, json) it also returns the content. PDFs, slides and Office files are NOT parsed; give the user the download_url instead.",
			inputSchema: { file_id: z.number().int() },
			annotations: readOnly,
		},
		async ({ file_id }) =>
			run(async () => {
				const f = await canvas.getOne(`/files/${file_id}`);
				const type = f["content-type"] ?? "";
				const textual = type.startsWith("text/") || TEXTUAL_TYPE.test(type);
				let content;
				if (textual && f.url && (f.size ?? 0) <= MAX_FILE_BYTES) {
					const raw = await canvas.download(f.url);
					if (raw !== undefined) content = type.includes("html") ? htmlToText(raw) : raw.slice(0, MAX_TEXT);
				}
				return {
					id: f.id,
					name: f.display_name,
					type,
					size_kb: Math.round((f.size ?? 0) / 1024),
					updated_at: f.updated_at,
					download_url: f.url,
					content,
				};
			}),
	);
}
