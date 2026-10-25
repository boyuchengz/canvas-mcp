/** Hard cap on any single block of text returned to the model. */
export const MAX_TEXT = 20_000;

const ENTITIES = {
	"&nbsp;": " ",
	"&amp;": "&",
	"&lt;": "<",
	"&gt;": ">",
	"&quot;": '"',
	"&#39;": "'",
};

/**
 * Converts Canvas rich-content HTML into compact plain text.
 * Deliberately simple: keeps line structure and list bullets, drops markup.
 */
export function htmlToText(html, maxLength = MAX_TEXT) {
	if (!html) return "";
	return html
		.replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
		.replace(/<li[^>]*>/gi, "- ")
		.replace(/<[^>]+>/g, "")
		.replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity])
		.replace(/\n{3,}/g, "\n\n")
		.trim()
		.slice(0, maxLength);
}
