import MarkdownIt from "markdown-it";
import markdownItSpoilerSimple from "@/lib/markdown-it-spoiler-simple";
import markdownItUserMentions from "@/lib/markdown-it-user-mentions";
import { MARKDOWN_OPTIONS } from "@/lib/markdown-options";

const markdown = new MarkdownIt(MARKDOWN_OPTIONS)
	.use(markdownItSpoilerSimple)
	.use(markdownItUserMentions);

export function renderCommentMarkdown(body: string): string {
	return markdown.render(body);
}

export function renderPostBodyMarkdown(body: string): string {
	return markdown.render(body);
}

export function renderPostTitleHtml(title: string): string {
	return markdown.renderInline(title);
}
