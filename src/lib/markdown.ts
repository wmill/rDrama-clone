import MarkdownIt from "markdown-it";
import markdownItSpoilerSimple from "@/lib/markdown-it-spoiler-simple";
import { MARKDOWN_OPTIONS } from "@/lib/markdown-options";

const markdown = new MarkdownIt(MARKDOWN_OPTIONS).use(markdownItSpoilerSimple);

export function renderCommentMarkdown(body: string): string {
	return markdown.render(body);
}
