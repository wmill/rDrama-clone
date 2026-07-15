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

export function getPreferredLinkTarget(
	href: string,
	origin: string,
	preferences: { newTab: boolean; newTabExternal: boolean },
): "_blank" | undefined {
	try {
		const external = new URL(href, origin).origin !== new URL(origin).origin;
		return (external ? preferences.newTabExternal : preferences.newTab)
			? "_blank"
			: undefined;
	} catch {
		return undefined;
	}
}

export function normalizeThemeColor(value?: string): string {
	return /^[0-9a-fA-F]{3,6}$/.test(value ?? "") ? `#${value}` : "#06b6d4";
}

export function resolvePreferenceDefault<T>(
	explicit: T | undefined,
	saved: T | undefined,
	fallback: T,
): T {
	return explicit ?? saved ?? fallback;
}
