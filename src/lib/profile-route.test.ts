import { describe, expect, it } from "vitest";
import {
	buildProfileCommentsHref,
	buildProfilePostsHref,
	parseCommentsProfileSearch,
	parsePostsProfileSearch,
} from "@/lib/profile-route";

describe("profile-route helpers", () => {
	it("parses comments search with defaults for invalid values", () => {
		const parsed = parseCommentsProfileSearch({
			sort: "bad-sort",
			t: "not-a-time",
			page: "0",
		});

		expect(parsed).toEqual({
			sort: "new",
			t: "all",
			page: 1,
		});
	});

	it("parses posts search with explicit valid values", () => {
		const parsed = parsePostsProfileSearch({
			sort: "top",
			t: "month",
			page: "3",
		});

		expect(parsed).toEqual({
			sort: "top",
			t: "month",
			page: 3,
		});
	});

	it("builds encoded profile hrefs", () => {
		expect(
			buildProfileCommentsHref("name with spaces", {
				sort: "new",
				t: "all",
				page: 1,
			}),
		).toBe("/u/name%20with%20spaces?sort=new&t=all&page=1");

		expect(
			buildProfilePostsHref("name with spaces", {
				sort: "hot",
				t: "week",
				page: 2,
			}),
		).toBe("/u/name%20with%20spaces/posts?sort=hot&t=week&page=2");
	});
});
