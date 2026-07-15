const SLUR_REPLACEMENTS: ReadonlyArray<[RegExp, string]> = [
	[/\bretards?\b/gi, "person"],
	[/\bfagg?ots?\b/gi, "person"],
	[/\bnigg(?:er|a)s?\b/gi, "person"],
];

export function replaceSlursInText(value: string): string {
	return SLUR_REPLACEMENTS.reduce(
		(result, [pattern, replacement]) => result.replace(pattern, replacement),
		value,
	);
}

export function replaceSlursInHtml(value: string): string {
	return value
		.split(/(<[^>]+>)/g)
		.map((part) => (part.startsWith("<") ? part : replaceSlursInText(part)))
		.join("");
}
