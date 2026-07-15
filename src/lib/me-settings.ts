import { z } from "zod";

import { CommentSortTypes, SortTypes, TimeFilters } from "@/lib/constants";

const colorSchema = z
	.string()
	.trim()
	.regex(/^[0-9a-fA-F]{3,6}$/, "Use a 3 or 6 character hex color");

const optionalUrlSchema = z
	.string()
	.trim()
	.max(65, "URL must be 65 characters or fewer")
	.refine((value) => {
		if (!value) return true;
		try {
			const url = new URL(value);
			return url.protocol === "http:" || url.protocol === "https:";
		} catch {
			return false;
		}
	}, "Enter a valid http:// or https:// URL");

export const settingsSchema = z.object({
	bio: z.string().trim().max(1500, "Bio must be 1500 characters or fewer"),
	customTitlePlain: z
		.string()
		.trim()
		.max(100, "Custom title must be 100 characters or fewer"),
	profileUrl: optionalUrlSchema,
	bannerUrl: optionalUrlSchema,
	profileCss: z
		.string()
		.max(4000, "Profile CSS must be 4000 characters or fewer"),
	defaultSorting: z.enum(SortTypes),
	defaultSortingComments: z.enum(CommentSortTypes),
	defaultTime: z.enum(TimeFilters),
	isPrivate: z.boolean(),
	hideVotedOn: z.boolean(),
	cardView: z.boolean(),
	highlightComments: z.boolean(),
	newTabExternal: z.boolean(),
	newTab: z.boolean(),
	nameColor: colorSchema,
	titleColor: colorSchema,
	themeColor: colorSchema,
	theme: z.enum(["dark", "light"]),
	over18: z.boolean(),
	slurReplacer: z.boolean(),
});

export type SettingsInput = z.infer<typeof settingsSchema>;
