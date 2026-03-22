import type MarkdownIt from "markdown-it";

function markdownItSpoilerSimple(md: MarkdownIt): void {
	md.core.ruler.after("inline", "spoiler", (state) => {
		const spoilerRegex = /\|\|([^\n|][^\n]*?)\|\|/g;

		for (const blockToken of state.tokens) {
			if (blockToken.type !== "inline" || !blockToken.children?.length) {
				continue;
			}

			const transformedChildren = [];

			for (const child of blockToken.children) {
				if (child.type !== "text") {
					transformedChildren.push(child);
					continue;
				}

				const source = child.content;
				let lastIndex = 0;
				let match = spoilerRegex.exec(source);
				while (match !== null) {
					const matchIndex = match.index;
					const fullMatch = match[0];
					const spoilerContent = match[1] ?? "";

					if (matchIndex > lastIndex) {
						const textBefore = new state.Token("text", "", 0);
						textBefore.content = source.slice(lastIndex, matchIndex);
						transformedChildren.push(textBefore);
					}

					const spoilerOpen = new state.Token("spoiler_open", "span", 1);
					spoilerOpen.markup = "||";
					spoilerOpen.attrs = [["class", "spoiler"]];
					transformedChildren.push(spoilerOpen);

					const spoilerText = new state.Token("text", "", 0);
					spoilerText.content = spoilerContent;
					transformedChildren.push(spoilerText);

					const spoilerClose = new state.Token("spoiler_close", "span", -1);
					spoilerClose.markup = "||";
					transformedChildren.push(spoilerClose);

					lastIndex = matchIndex + fullMatch.length;
					match = spoilerRegex.exec(source);
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

export default markdownItSpoilerSimple;
