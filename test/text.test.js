import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_TEXT, htmlToText } from "../src/text.js";

test("returns an empty string for empty input", () => {
	assert.equal(htmlToText(null), "");
	assert.equal(htmlToText(""), "");
});

test("keeps paragraph and list structure", () => {
	const html = "<h2>Week 3</h2><p>Read chapter 4.</p><ul><li>Lab 2</li><li>Quiz</li></ul>";
	assert.equal(htmlToText(html), "Week 3\nRead chapter 4.\n- Lab 2\n- Quiz");
});

test("drops script and style blocks entirely", () => {
	assert.equal(htmlToText("<style>p{}</style><p>hi</p><script>alert(1)</script>"), "hi");
});

test("decodes common entities exactly once", () => {
	assert.equal(htmlToText("a&nbsp;&amp;&nbsp;b &lt;tag&gt; &quot;q&quot; &#39;s&#39;"), "a & b <tag> \"q\" 's'");
	assert.equal(htmlToText("&amp;lt;"), "&lt;");
});

test("collapses runs of blank lines", () => {
	assert.equal(htmlToText("<p>a</p><p></p><p></p><p>b</p>"), "a\n\nb");
});

test("truncates to the requested length", () => {
	assert.equal(htmlToText("x".repeat(MAX_TEXT + 50)).length, MAX_TEXT);
	assert.equal(htmlToText("<p>abcdef</p>", 3), "abc");
});
