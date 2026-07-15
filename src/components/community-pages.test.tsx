import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (config: unknown) => config,
}));

import { FORMATTING_EXAMPLES } from "@/lib/community-content";
import { renderCommentMarkdown } from "@/lib/markdown";
import { FormattingPage } from "@/routes/formatting";
import { RulesPage } from "@/routes/rules";

describe("community pages", () => {
	it("renders the public TheMotte rules content", () => {
		render(<RulesPage />);
		expect(
			screen.getByRole("heading", { name: "Rules", level: 1 }),
		).not.toBeNull();
		expect(screen.getByText("The Foundation")).not.toBeNull();
		expect(screen.getAllByText("Don't be egregiously obnoxious")).toHaveLength(
			2,
		);
	});

	it("renders every documented example through the production renderer", () => {
		render(<FormattingPage />);
		for (const example of FORMATTING_EXAMPLES) {
			expect(screen.getByText(example.name)).not.toBeNull();
			expect(renderCommentMarkdown(example.markdown).trim()).not.toBe("");
		}
		expect(
			screen.getByText(/Raw HTML is displayed as text for safety/),
		).not.toBeNull();
	});

	it("documents only behavior the configured renderer actually supports", () => {
		expect(renderCommentMarkdown("~~gone~~")).toContain("<s>gone</s>");
		expect(renderCommentMarkdown("||secret||")).toContain(
			'<span class="spoiler">secret</span>',
		);
		expect(renderCommentMarkdown("Hello @alice")).toContain('href="/u/alice"');
		expect(renderCommentMarkdown("<script>alert(1)</script>")).toContain(
			"&lt;script&gt;",
		);
	});
});
