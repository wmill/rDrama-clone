import { describe, expect, it } from "vitest";
import {
	renderCommentMarkdown,
	renderPostBodyMarkdown,
	renderPostTitleHtml,
} from "@/lib/markdown";

describe("renderCommentMarkdown", () => {
	it("renders common markdown formatting", () => {
		const html = renderCommentMarkdown("Hello **world**");
		expect(html).toContain("<p>");
		expect(html).toContain("<strong>world</strong>");
	});

	it("linkifies plain URLs", () => {
		const html = renderCommentMarkdown("Check https://example.com/path");
		expect(html).toContain('href="https://example.com/path"');
	});

	it("escapes raw HTML tags when html is disabled", () => {
		const html = renderCommentMarkdown("<script>alert(1)</script>");
		expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
		expect(html).not.toContain("<script>");
	});

	it("uses line breaks for single newlines", () => {
		const html = renderCommentMarkdown("line one\nline two");
		expect(html).toContain("<br>");
	});

	it("renders lists", () => {
		const html = renderCommentMarkdown("- one\n- two");
		expect(html).toContain("<ul>");
		expect(html).toContain("<li>one</li>");
		expect(html).toContain("<li>two</li>");
	});
});

describe("renderCommentMarkdown plugin contracts", () => {
	it("renders spoiler sections using ||double pipes|| syntax", () => {
		const html = renderCommentMarkdown(
			"I didn't like the part where ||snape killed dumbeldore||",
		);
		expect(html).toContain("spoiler");
		expect(html).toContain("snape killed dumbeldore");
	});

	it("converts @username references to profile links", () => {
		const html = renderCommentMarkdown("Shoutout to @testuser for the fix");
		expect(html).toContain('href="/u/testuser"');
		expect(html).toContain("@testuser");
	});
});

describe("post markdown rendering", () => {
	it("renders post bodies with the same markdown pipeline", () => {
		const html = renderPostBodyMarkdown("Hello **post**");
		expect(html).toContain("<strong>post</strong>");
	});

	it("renders title markdown inline without wrapping paragraphs", () => {
		const html = renderPostTitleHtml("Look at **this**");
		expect(html).toContain("<strong>this</strong>");
		expect(html).not.toContain("<p>");
	});

	it("escapes raw HTML in post titles", () => {
		const html = renderPostTitleHtml("<img src=x onerror=alert(1)>");
		expect(html).toContain("&lt;img");
		expect(html).not.toContain("<img");
	});
});
