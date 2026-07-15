export type FormattingExample = {
	name: string;
	markdown: string;
	description: string;
};

export const FORMATTING_EXAMPLES: readonly FormattingExample[] = [
	{
		name: "Italics",
		markdown: "*emphasized text*",
		description: "Wrap text in one asterisk or underscore.",
	},
	{
		name: "Bold",
		markdown: "**strong text**",
		description: "Wrap text in two asterisks or underscores.",
	},
	{
		name: "Inline code",
		markdown: "Use `const answer = 42` inline.",
		description: "Wrap code in backticks.",
	},
	{
		name: "Strikethrough",
		markdown: "~~old text~~ new text",
		description: "Wrap text in two tildes.",
	},
	{
		name: "Links",
		markdown: "[The Motte](/)",
		description: "Put link text in brackets and its URL in parentheses.",
	},
	{
		name: "Automatic links",
		markdown: "https://example.com",
		description: "Complete URLs become links automatically.",
	},
	{
		name: "Blockquotes",
		markdown: "> Quoted text\n> can span multiple lines.",
		description: "Start quoted lines with a greater-than sign.",
	},
	{
		name: "Headings",
		markdown: "## Section heading",
		description: "Use one through six hash signs at the start of a line.",
	},
	{
		name: "Bulleted lists",
		markdown: "- First item\n- Second item",
		description: "Start each item with a dash, plus, or asterisk.",
	},
	{
		name: "Numbered lists",
		markdown: "1. First item\n2. Second item",
		description: "Start each item with a number and period.",
	},
	{
		name: "Code blocks",
		markdown: "```ts\nconst answer = 42;\n```",
		description: "Surround a block with three backticks.",
	},
	{
		name: "Horizontal rules",
		markdown: "Before\n\n---\n\nAfter",
		description: "Put three dashes on their own line.",
	},
	{
		name: "Spoilers",
		markdown: "||hidden information||",
		description: "Wrap a spoiler in two vertical bars.",
	},
	{
		name: "Username mentions",
		markdown: "Hello @example_user",
		description: "Prefix a username with @ to link to its profile.",
	},
] as const;
