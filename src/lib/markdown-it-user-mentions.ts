import type MarkdownIt from "markdown-it";

function markdownItUserMentions(md: MarkdownIt): void {
	md.core.ruler.after("inline", "user_mentions", (state) => {
		const mentionRegex = /(^|[^\w/])@([A-Za-z0-9_]{3,25})\b/g;

		for (const blockToken of state.tokens) {
			if (blockToken.type !== "inline" || !blockToken.children?.length) {
				continue;
			}

			const transformedChildren = [];
			let linkDepth = 0;

			for (const child of blockToken.children) {
				if (child.type === "link_open") {
					linkDepth += 1;
					transformedChildren.push(child);
					continue;
				}

				if (child.type === "link_close") {
					linkDepth = Math.max(0, linkDepth - 1);
					transformedChildren.push(child);
					continue;
				}

				if (child.type !== "text" || linkDepth > 0) {
					transformedChildren.push(child);
					continue;
				}

				const source = child.content;
				let lastIndex = 0;
				mentionRegex.lastIndex = 0;
				let match = mentionRegex.exec(source);

				while (match !== null) {
					const matchIndex = match.index;
					const fullMatch = match[0];
					const prefix = match[1] ?? "";
					const username = match[2] ?? "";
					const mentionStart = matchIndex + prefix.length;

					if (mentionStart > lastIndex) {
						const textBefore = new state.Token("text", "", 0);
						textBefore.content = source.slice(lastIndex, mentionStart);
						transformedChildren.push(textBefore);
					}

					const linkOpen = new state.Token("link_open", "a", 1);
					linkOpen.attrs = [["href", `/u/${username}`]];
					transformedChildren.push(linkOpen);

					const linkText = new state.Token("text", "", 0);
					linkText.content = `@${username}`;
					transformedChildren.push(linkText);

					const linkClose = new state.Token("link_close", "a", -1);
					transformedChildren.push(linkClose);

					lastIndex = matchIndex + fullMatch.length;
					match = mentionRegex.exec(source);
				}

				if (lastIndex === 0) {
					transformedChildren.push(child);
					continue;
				}

				if (lastIndex < source.length) {
					const textAfter = new state.Token("text", "", 0);
					textAfter.content = source.slice(lastIndex);
					transformedChildren.push(textAfter);
				}
			}

			blockToken.children = transformedChildren;
		}
	});
}

export default markdownItUserMentions;
