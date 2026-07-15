import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LinkPreferenceController } from "@/components/link-preference-controller";

describe("LinkPreferenceController", () => {
	it("applies and removes independent internal and external link targets", () => {
		const { rerender } = render(
			<>
				<LinkPreferenceController newTab newTabExternal={false} />
				<a href="/post/1">Internal</a>
				<a href="https://example.net/post/1">External</a>
			</>,
		);
		const internal = screen.getByRole("link", { name: "Internal" });
		const external = screen.getByRole("link", { name: "External" });
		expect(internal.getAttribute("target")).toBe("_blank");
		expect(internal.getAttribute("rel")).toBe("noopener noreferrer");
		expect(external.getAttribute("target")).toBeNull();

		rerender(
			<>
				<LinkPreferenceController newTab={false} newTabExternal />
				<a href="/post/1">Internal</a>
				<a href="https://example.net/post/1">External</a>
			</>,
		);
		expect(internal.getAttribute("target")).toBeNull();
		expect(internal.getAttribute("rel")).toBeNull();
		expect(external.getAttribute("target")).toBe("_blank");
	});
});
