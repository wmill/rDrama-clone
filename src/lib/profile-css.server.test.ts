import { describe, expect, it } from "vitest";

import {
	ProfileCssError,
	profileCssContainerClass,
	sanitizeProfileCss,
} from "@/lib/profile-css.server";

describe("profile CSS sanitizer", () => {
	it("prefixes every selector and regenerates allowlisted visual CSS", () => {
		expect(
			sanitizeProfileCss(
				".profile-bio, h2:hover { color: rebeccapurple; border-radius: 4px }",
				42,
			),
		).toBe(
			".profile-owner-42 .profile-bio,.profile-owner-42 h2:hover{color:rebeccapurple;border-radius:4px}",
		);
		expect(profileCssContainerClass(42)).toBe("profile-owner-42");
	});

	it.each([
		["malformed", ".x { color red; }"],
		["at-rule", "@import 'https://evil.test/x.css';"],
		["encoded URL", ".x { background-color: url(https://evil.test/x) }"],
		["selector list escape", ".x, body { color: red }"],
		["root selector", ":root { color: red }"],
		["nesting", ".x { & .y { color: red } }"],
		["custom property", ".x { --secret: red; color: var(--secret) }"],
		["positioning", ".x { position: fixed; color: red }"],
		["stacking", ".x { z-index: 999; color: red }"],
		["remote function", ".x { color: attr(data-secret) }"],
	])("rejects %s attacks", (_name, css) => {
		expect(() => sanitizeProfileCss(css, 42)).toThrow(ProfileCssError);
	});

	it("accepts an empty stylesheet without adding a container", () => {
		expect(sanitizeProfileCss("  ", 42)).toBe("");
	});
});
