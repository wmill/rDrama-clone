import MarkdownIt from "markdown-it";
import { MARKDOWN_OPTIONS } from "@/lib/markdown-options";

const markdown = new MarkdownIt(MARKDOWN_OPTIONS);

export function renderCommentMarkdown(body: string): string {
	return markdown.render(body);
}
