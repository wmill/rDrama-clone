import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cn, formatRelativeTime, stripHtmlToText } from "./utils";

describe("utils", () => {
	describe("cn", () => {
		it("merges conditional and conflicting tailwind classes", () => {
			expect(
				cn("rounded", false && "hidden", "px-2", "px-4", ["text-sm"]),
			).toBe("rounded px-4 text-sm");
		});
	});

	describe("stripHtmlToText", () => {
		it("returns an empty string for nullish values", () => {
			expect(stripHtmlToText(null)).toBe("");
			expect(stripHtmlToText(undefined)).toBe("");
		});

		it("removes tags and normalizes whitespace", () => {
			expect(
				stripHtmlToText("<p>Hello<br>there</p>   <strong>friend</strong>"),
			).toBe("Hello there friend");
		});
	});

	describe("formatRelativeTime", () => {
		beforeEach(() => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date("2026-04-07T12:00:00Z"));
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it("formats recent timestamps across supported ranges", () => {
			const now = Math.floor(Date.now() / 1000);

			expect(formatRelativeTime(now - 30)).toBe("just now");
			expect(formatRelativeTime(now - 120)).toBe("2m ago");
			expect(formatRelativeTime(now - 60 * 60 * 5)).toBe("5h ago");
			expect(formatRelativeTime(now - 60 * 60 * 24 * 3)).toBe("3d ago");
			expect(formatRelativeTime(now - 60 * 60 * 24 * 14)).toBe("2w ago");
			expect(formatRelativeTime(now - 60 * 60 * 24 * 30 * 4)).toBe("4mo ago");
			expect(formatRelativeTime(now - 60 * 60 * 24 * 365 * 2)).toBe("2y ago");
		});
	});
});
