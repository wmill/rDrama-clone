import { describe, expect, it } from "vitest";

import {
	replaceSlursInHtml,
	replaceSlursInText,
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
});
