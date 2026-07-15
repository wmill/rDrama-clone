import { describe, expect, it } from "vitest";

import {
	getPreferredLinkTarget,
	normalizeThemeColor,
	replaceSlursInHtml,
	replaceSlursInText,
	resolvePreferenceDefault,
} from "@/lib/content-preferences";

describe("content preferences", () => {
	it("replaces configured slurs case-insensitively", () => {
		expect(replaceSlursInText("RETARD and faggot")).toBe("person and person");
	});

	it("changes rendered text without touching HTML attributes", () => {
		expect(replaceSlursInHtml('<a href="/retard">retard</a>')).toBe(
			'<a href="/retard">person</a>',
		);
	});

	it("applies internal and external link-target preferences independently", () => {
		const origin = "https://forum.example";
		expect(
			getPreferredLinkTarget("/post/1", origin, {
				newTab: true,
				newTabExternal: false,
			}),
		).toBe("_blank");
		expect(
			getPreferredLinkTarget("https://elsewhere.example", origin, {
				newTab: true,
				newTabExternal: false,
			}),
		).toBeUndefined();
		expect(
			getPreferredLinkTarget("https://elsewhere.example", origin, {
				newTab: false,
				newTabExternal: true,
			}),
		).toBe("_blank");
	});

	it("normalizes safe theme colors and rejects unsafe values", () => {
		expect(normalizeThemeColor("a0b1c2")).toBe("#a0b1c2");
		expect(normalizeThemeColor("red;position:fixed")).toBe("#06b6d4");
	});

	it("uses saved defaults only when an explicit URL value is absent", () => {
		expect(resolvePreferenceDefault("top", "new", "hot")).toBe("top");
		expect(resolvePreferenceDefault(undefined, "new", "hot")).toBe("new");
		expect(resolvePreferenceDefault(undefined, undefined, "hot")).toBe("hot");
	});
});
