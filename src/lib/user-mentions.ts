import MarkdownIt from "markdown-it";
import type Token from "markdown-it/lib/token.mjs";

import { MARKDOWN_OPTIONS } from "@/lib/markdown-options";

export const USER_MENTION_REGEX = /(^|[^\w/])@([A-Za-z0-9_]{3,25})\b/g;

const markdownWithoutMentionLinks = new MarkdownIt(MARKDOWN_OPTIONS);

export function extractUserMentionsFromText(source: string): string[] {
	const usernames: string[] = [];
	USER_MENTION_REGEX.lastIndex = 0;
	let match = USER_MENTION_REGEX.exec(source);

	while (match !== null) {
		const username = match[2];
		if (username) {
			usernames.push(username);
		}
		match = USER_MENTION_REGEX.exec(source);
	}

	return usernames;
}

export function collectUserMentionsFromInlineTokens(
	children: readonly Token[],
): string[] {
	const usernames: string[] = [];
	let linkDepth = 0;

	for (const child of children) {
		if (child.type === "link_open") {
			linkDepth += 1;
			continue;
		}

		if (child.type === "link_close") {
			linkDepth = Math.max(0, linkDepth - 1);
			continue;
		}

		if (child.type !== "text" || linkDepth > 0) {
			continue;
		}

		usernames.push(...extractUserMentionsFromText(child.content));
	}

	return usernames;
}

export function extractUserMentionsFromMarkdown(markdown: string): string[] {
	const tokens = markdownWithoutMentionLinks.parse(markdown, {});
	const usernames = new Set<string>();

	for (const token of tokens) {
		if (token.type !== "inline" || !token.children?.length) {
			continue;
		}

		for (const username of collectUserMentionsFromInlineTokens(
			token.children,
		)) {
			usernames.add(username);
		}
	}

	return [...usernames];
}
