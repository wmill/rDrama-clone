import {
	type AnyPgColumn,
	boolean,
	customType,
	doublePrecision,
	integer,
	pgEnum,
	pgTable,
	primaryKey,
	serial,
	smallint,
	text,
	time,
	timestamp,
	unique,
	varchar,
} from "drizzle-orm/pg-core";

const ltree = customType<{ data: string; driverData: string }>({
	dataType() {
		return "ltree";
	},
});

export const stateModEnum = pgEnum("statemod", [
	"VISIBLE",
	"FILTERED",
	"REMOVED",
]);
export const stateReportEnum = pgEnum("statereport", [
	"UNREPORTED",
	"RESOLVED",
	"REPORTED",
	"IGNORED",
]);
export const filterBehaviorEnum = pgEnum("filterbehavior", [
	"AUTOMATIC",
	"UNFILTERED",
	"FILTERED",
]);
export const userTagEnum = pgEnum("usertag", [
	"Quality",
	"Good",
	"Comment",
	"Warning",
	"Tempban",
	"Permban",
	"Spam",
	"Bot",
]);
export const volunteerJanitorResultEnum = pgEnum("volunteerjanitorresult", [
	"Pending",
	"TopQuality",
	"Good",
	"Neutral",
	"Bad",
	"Warning",
	"Ban",
]);

export const users = pgTable("users", {
	id: serial("id").primaryKey(),
	username: varchar("username", { length: 255 }).notNull(),
	email: varchar("email", { length: 255 }),
	passhash: varchar("passhash", { length: 255 }).notNull(),
	createdUtc: integer("created_utc").notNull(),
	adminLevel: integer("admin_level").notNull().default(0),
	over18: boolean("over_18").notNull().default(false),
	isActivated: boolean("is_activated").notNull().default(false),
	bio: varchar("bio", { length: 1500 }),
	bioHtml: varchar("bio_html", { length: 10000 }),
	referredBy: integer("referred_by"),
	isBanned: integer("is_banned").notNull().default(0),
	banReason: varchar("ban_reason", { length: 256 }),
	loginNonce: integer("login_nonce").notNull().default(0),
	reserved: varchar("reserved", { length: 256 }),
	mfaSecret: varchar("mfa_secret", { length: 32 }),
	isPrivate: boolean("is_private").notNull().default(false),
	unbanUtc: integer("unban_utc").notNull().default(0),
	isNofollow: boolean("is_nofollow").notNull().default(false),
	customFilterList: varchar("custom_filter_list", { length: 1000 })
		.notNull()
		.default(""),
	storedSubscriberCount: integer("stored_subscriber_count")
		.notNull()
		.default(0),
	banEvade: integer("ban_evade").notNull().default(0),
	originalUsername: varchar("original_username", { length: 255 }),
	customTitle: varchar("customtitle", { length: 1000 }),
	defaultSorting: varchar("defaultsorting", { length: 15 })
		.notNull()
		.default("new"),
	defaultTime: varchar("defaulttime", { length: 5 }).notNull(),
	nameColor: varchar("namecolor", { length: 6 }).notNull(),
	titleColor: varchar("titlecolor", { length: 6 }).notNull(),
	profileUrl: varchar("profileurl", { length: 65 }),
	bannerUrl: varchar("bannerurl", { length: 65 }),
	hideVotedOn: boolean("hidevotedon").notNull().default(false),
	newTab: boolean("newtab").notNull().default(false),
	flairChanged: integer("flairchanged"),
	defaultSortingComments: varchar("defaultsortingcomments", { length: 15 })
		.notNull()
		.default("new"),
	theme: varchar("theme", { length: 15 }).notNull(),
	slurReplacer: boolean("slurreplacer").notNull().default(true),
	shadowBanned: varchar("shadowbanned", { length: 25 }),
	newTabExternal: boolean("newtabexternal").notNull().default(true),
	customTitlePlain: varchar("customtitleplain", { length: 100 }),
	themeColor: varchar("themecolor", { length: 6 }).notNull(),
	changelogSub: boolean("changelogsub").notNull().default(false),
	css: varchar("css", { length: 4000 }),
	profileCss: varchar("profilecss", { length: 4000 }),
	coins: integer("coins").notNull().default(0),
	agendaPoster: integer("agendaposter").notNull().default(0),
	postCount: integer("post_count").notNull().default(0),
	commentCount: integer("comment_count").notNull().default(0),
	highRes: varchar("highres", { length: 60 }),
	patron: integer("patron").notNull().default(0),
	controversial: boolean("controversial").notNull().default(false),
	verified: varchar("verified", { length: 20 }),
	cardView: boolean("cardview").notNull(),
	receivedAwardCount: integer("received_award_count").notNull().default(0),
	highlightComments: boolean("highlightcomments").notNull().default(true),
	nitter: boolean("nitter"),
	trueScore: integer("truescore").notNull().default(0),
	frontSize: integer("frontsize").notNull().default(25),
	coinsSpent: integer("coins_spent").notNull().default(0),
	proCoins: integer("procoins").notNull().default(0),
	verifiedColor: varchar("verifiedcolor", { length: 6 }),
	friends: varchar("friends", { length: 500 }),
	friendsHtml: varchar("friends_html", { length: 2000 }),
	enemies: varchar("enemies", { length: 500 }),
	enemiesHtml: varchar("enemies_html", { length: 2000 }),
	fp: varchar("fp", { length: 21 }),
	lootboxesBought: integer("lootboxes_bought").notNull().default(0),
	winnings: integer("winnings").notNull().default(0),
	patronUtc: integer("patron_utc").notNull().default(0),
	house: varchar("house", { length: 16 }),
	reddit: varchar("reddit", { length: 15 }).notNull(),
	volunteerLastStartedUtc: timestamp("volunteer_last_started_utc", {
		mode: "date",
	}),
	volunteerJanitorCorrectness: doublePrecision(
		"volunteer_janitor_correctness",
	).notNull(),
	chatAuthorized: boolean("chat_authorized").notNull(),
	chatLastSeen: timestamp("chat_lastseen", {
		withTimezone: true,
		mode: "date",
	}).notNull(),
	filterBehavior: filterBehaviorEnum("filter_behavior").notNull(),
	storedFollowingCount: integer("stored_following_count").notNull().default(0),
});

export const submissions = pgTable("submissions", {
	id: serial("id").primaryKey(),
	authorId: integer("author_id")
		.notNull()
		.references(() => users.id),
	createdUtc: integer("created_utc").notNull(),
	over18: boolean("over_18").notNull().default(false),
	distinguishLevel: integer("distinguish_level").notNull().default(0),
	editedUtc: integer("edited_utc").notNull().default(0),
	isPinned: boolean("is_pinned").notNull().default(false),
	upvotes: integer("upvotes").notNull().default(1),
	downvotes: integer("downvotes").notNull().default(0),
	appId: integer("app_id"),
	thumbUrl: varchar("thumburl", { length: 200 }),
	private: boolean("private").notNull().default(false),
	views: integer("views").notNull().default(0),
	isBot: boolean("is_bot").notNull().default(false),
	bannedFor: boolean("bannedfor"),
	commentCount: integer("comment_count").notNull().default(0),
	stickied: varchar("stickied", { length: 40 }),
	title: varchar("title", { length: 500 }).notNull(),
	url: varchar("url", { length: 2083 }),
	body: text("body"),
	bodyHtml: text("body_html"),
	embedUrl: varchar("embed_url", { length: 1500 }),
	titleHtml: varchar("title_html", { length: 1500 }).notNull(),
	realUpvotes: integer("realupvotes"),
	flair: varchar("flair", { length: 350 }),
	stickiedUtc: integer("stickied_utc"),
	ghost: boolean("ghost").notNull().default(false),
	bumpUtc: integer("bump_utc"),
	taskId: integer("task_id"),
	stateUserDeletedUtc: timestamp("state_user_deleted_utc", {
		withTimezone: true,
		mode: "date",
	}),
	stateMod: stateModEnum("state_mod").notNull(),
	stateModSetBy: varchar("state_mod_set_by"),
	stateReport: stateReportEnum("state_report").notNull(),
});

export const comments = pgTable("comments", {
	id: serial("id").primaryKey(),
	authorId: integer("author_id")
		.notNull()
		.references(() => users.id),
	createdUtc: integer("created_utc").notNull(),
	parentSubmission: integer("parent_submission").references(
		() => submissions.id,
	),
	distinguishLevel: integer("distinguish_level").notNull().default(0),
	editedUtc: integer("edited_utc").notNull().default(0),
	level: integer("level").notNull().default(0),
	parentCommentId: integer("parent_comment_id").references(
		(): AnyPgColumn => comments.id,
	),
	over18: boolean("over_18").notNull().default(false),
	upvotes: integer("upvotes").notNull().default(1),
	downvotes: integer("downvotes").notNull().default(0),
	isBot: boolean("is_bot").notNull().default(false),
	appId: integer("app_id"),
	sentTo: integer("sentto"),
	bannedFor: boolean("bannedfor"),
	// Legacy DB column name; stores the pin label / who pinned the comment.
	pinnedBy: varchar("is_pinned", { length: 40 }),
	body: text("body"),
	bodyHtml: text("body_html").notNull(),
	realUpvotes: integer("realupvotes").notNull().default(1),
	topCommentId: integer("top_comment_id"),
	isPinnedUtc: integer("is_pinned_utc"),
	ghost: boolean("ghost").notNull().default(false),
	descendantCount: integer("descendant_count").notNull().default(0),
	volunteerJanitorBadness: doublePrecision(
		"volunteer_janitor_badness",
	).notNull(),
	stateUserDeletedUtc: timestamp("state_user_deleted_utc", {
		withTimezone: true,
		mode: "date",
	}),
	stateMod: stateModEnum("state_mod").notNull(),
	stateModSetBy: varchar("state_mod_set_by"),
	stateReport: stateReportEnum("state_report").notNull(),
	path: ltree("path"),
});

export const commentVotes = pgTable(
	"commentvotes",
	{
		commentId: integer("comment_id")
			.notNull()
			.references(() => comments.id),
		voteType: integer("vote_type").notNull(),
		userId: integer("user_id")
			.notNull()
			.references(() => users.id),
		appId: integer("app_id"),
		real: boolean("real").notNull().default(true),
		createdDatetimez: timestamp("created_datetimez", {
			withTimezone: true,
			mode: "date",
		}).notNull(),
	},
	(table) => [primaryKey({ columns: [table.commentId, table.userId] })],
);

export const votes = pgTable(
	"votes",
	{
		userId: integer("user_id")
			.notNull()
			.references(() => users.id),
		submissionId: integer("submission_id")
			.notNull()
			.references(() => submissions.id),
		voteType: integer("vote_type").notNull(),
		appId: integer("app_id"),
		real: boolean("real").notNull().default(true),
		createdDatetimez: timestamp("created_datetimez", {
			withTimezone: true,
			mode: "date",
		}).notNull(),
	},
	(table) => [primaryKey({ columns: [table.submissionId, table.userId] })],
);

export const follows = pgTable(
	"follows",
	{
		userId: integer("user_id")
			.notNull()
			.references(() => users.id),
		targetId: integer("target_id")
			.notNull()
			.references(() => users.id),
		createdDatetimez: timestamp("created_datetimez", {
			withTimezone: true,
			mode: "date",
		})
			.notNull()
			.defaultNow(),
	},
	(table) => [primaryKey({ columns: [table.targetId, table.userId] })],
);

export const saveRelationship = pgTable(
	"save_relationship",
	{
		submissionId: integer("submission_id")
			.notNull()
			.references(() => submissions.id),
		userId: integer("user_id")
			.notNull()
			.references(() => users.id),
	},
	(table) => [primaryKey({ columns: [table.userId, table.submissionId] })],
);

export const commentSaveRelationship = pgTable(
	"comment_save_relationship",
	{
		userId: integer("user_id")
			.notNull()
			.references(() => users.id),
		commentId: integer("comment_id")
			.notNull()
			.references(() => comments.id),
	},
	(table) => [primaryKey({ columns: [table.userId, table.commentId] })],
);

export const badgeDefs = pgTable("badge_defs", {
	id: serial("id").primaryKey(),
	name: varchar("name", { length: 50 }).notNull(),
	description: varchar("description", { length: 200 }),
});

export const badges = pgTable(
	"badges",
	{
		badgeId: integer("badge_id")
			.notNull()
			.references(() => badgeDefs.id),
		userId: integer("user_id")
			.notNull()
			.references(() => users.id),
		description: varchar("description", { length: 256 }),
		url: varchar("url", { length: 256 }),
	},
	(table) => [primaryKey({ columns: [table.userId, table.badgeId] })],
);

export const awardRelationships = pgTable("award_relationships", {
	id: serial("id").primaryKey(),
	userId: integer("user_id")
		.notNull()
		.references(() => users.id),
	submissionId: integer("submission_id").references(() => submissions.id),
	commentId: integer("comment_id").references(() => comments.id),
	kind: varchar("kind", { length: 20 }).notNull(),
});

export const viewers = pgTable(
	"viewers",
	{
		userId: integer("user_id")
			.notNull()
			.references(() => users.id),
		viewerId: integer("viewer_id")
			.notNull()
			.references(() => users.id),
		lastViewDatetimez: timestamp("last_view_datetimez", {
			withTimezone: true,
			mode: "date",
		})
			.notNull()
			.defaultNow(),
	},
	(table) => [primaryKey({ columns: [table.userId, table.viewerId] })],
);

export const alts = pgTable(
	"alts",
	{
		user1: integer("user1")
			.notNull()
			.references(() => users.id),
		user2: integer("user2")
			.notNull()
			.references(() => users.id),
		isManual: boolean("is_manual").notNull().default(false),
	},
	(table) => [primaryKey({ columns: [table.user1, table.user2] })],
);

export const bannedDomains = pgTable("banneddomains", {
	domain: varchar("domain", { length: 100 }).primaryKey(),
	reason: varchar("reason", { length: 100 }).notNull(),
});

export const chatMessage = pgTable("chat_message", {
	id: serial("id").primaryKey(),
	authorId: integer("author_id")
		.notNull()
		.references(() => users.id),
	quoteId: integer("quote_id"),
	text: varchar("text").notNull(),
	textHtml: varchar("text_html").notNull(),
	createdDatetimez: timestamp("created_datetimez", {
		withTimezone: true,
		mode: "date",
	})
		.notNull()
		.defaultNow(),
});

export const clientAuths = pgTable(
	"client_auths",
	{
		userId: integer("user_id")
			.notNull()
			.references(() => users.id),
		oauthClient: integer("oauth_client").notNull(),
		accessToken: varchar("access_token", { length: 128 }).notNull(),
	},
	(table) => [primaryKey({ columns: [table.userId, table.oauthClient] })],
);

export const commentFlags = pgTable("commentflags", {
	id: serial("id").primaryKey(),
	userId: integer("user_id")
		.notNull()
		.references(() => users.id),
	commentId: integer("comment_id")
		.notNull()
		.references(() => comments.id),
	reason: varchar("reason", { length: 350 }),
	createdDatetimez: timestamp("created_datetimez", {
		withTimezone: true,
		mode: "date",
	})
		.notNull()
		.defaultNow(),
});

export const flags = pgTable("flags", {
	id: serial("id").primaryKey(),
	userId: integer("user_id")
		.notNull()
		.references(() => users.id),
	postId: integer("post_id")
		.notNull()
		.references(() => submissions.id),
	reason: varchar("reason", { length: 350 }),
	createdDatetimez: timestamp("created_datetimez", {
		withTimezone: true,
		mode: "date",
	})
		.notNull()
		.defaultNow(),
});

export const marseys = pgTable("marseys", {
	name: varchar("name", { length: 30 }).primaryKey(),
	authorId: integer("author_id")
		.notNull()
		.references(() => users.id),
	tags: varchar("tags", { length: 200 }).notNull(),
	count: integer("count").notNull().default(0),
});

export const modActions = pgTable("modactions", {
	id: serial("id").primaryKey(),
	userId: integer("user_id").references(() => users.id),
	targetUserId: integer("target_user_id").references(() => users.id),
	targetSubmissionId: integer("target_submission_id").references(
		() => submissions.id,
	),
	targetCommentId: integer("target_comment_id").references(() => comments.id),
	kind: varchar("kind", { length: 32 }),
	note: varchar("_note", { length: 256 }),
	createdDatetimez: timestamp("created_datetimez", {
		withTimezone: true,
		mode: "date",
	})
		.notNull()
		.defaultNow(),
});

// Deviation from rDrama: rDrama keeps comment_id NOT NULL and models
// non-comment notifications as comments authored by a system user. We
// instead allow comment_id to be null and carry type/actor/body/url on
// the row itself, which avoids the system-user machinery entirely.
export const notifications = pgTable(
	"notifications",
	{
		id: serial("id").primaryKey(),
		userId: integer("user_id")
			.notNull()
			.references(() => users.id),
		commentId: integer("comment_id").references(() => comments.id),
		type: varchar("type", { length: 20 }).notNull().default("comment"),
		actorId: integer("actor_id").references(() => users.id),
		body: varchar("body", { length: 500 }),
		url: varchar("url", { length: 255 }),
		read: boolean("read").notNull(),
		createdDatetimez: timestamp("created_datetimez", {
			withTimezone: true,
			mode: "date",
		})
			.notNull()
			.defaultNow(),
	},
	(table) => [unique().on(table.userId, table.commentId)],
);

export const oauthApps = pgTable("oauth_apps", {
	id: serial("id").primaryKey(),
	clientId: varchar("client_id", { length: 64 }),
	appName: varchar("app_name", { length: 50 }).notNull(),
	redirectUri: varchar("redirect_uri", { length: 50 }).notNull(),
	authorId: integer("author_id")
		.notNull()
		.references(() => users.id),
	description: varchar("description", { length: 256 }).notNull(),
});

export const subscriptions = pgTable(
	"subscriptions",
	{
		userId: integer("user_id")
			.notNull()
			.references(() => users.id),
		submissionId: integer("submission_id")
			.notNull()
			.references(() => submissions.id),
	},
	(table) => [primaryKey({ columns: [table.userId, table.submissionId] })],
);

export const tasksRepeatable = pgTable("tasks_repeatable", {
	id: serial("id").primaryKey(),
	authorId: integer("author_id")
		.notNull()
		.references(() => users.id),
	typeId: smallint("type_id").notNull(),
	enabled: boolean("enabled").notNull(),
	runState: smallint("run_state").notNull(),
	runTimeLast: timestamp("run_time_last", { mode: "date" }),
	frequencyDay: smallint("frequency_day").notNull(),
	timeOfDayUtc: time("time_of_day_utc").notNull(),
	createdUtc: integer("created_utc").notNull(),
	label: varchar("label"),
});

export const tasksRepeatablePython = pgTable("tasks_repeatable_python", {
	id: integer("id")
		.primaryKey()
		.references(() => tasksRepeatable.id),
	importPath: varchar("import_path").notNull(),
	callable: varchar("callable").notNull(),
});

export const tasksRepeatableRuns = pgTable("tasks_repeatable_runs", {
	id: serial("id").primaryKey(),
	taskId: integer("task_id")
		.notNull()
		.references(() => tasksRepeatable.id),
	manual: boolean("manual").notNull(),
	tracebackStr: text("traceback_str"),
	completedUtc: timestamp("completed_utc", { mode: "date" }),
	createdUtc: integer("created_utc").notNull(),
});

export const tasksRepeatableScheduledSubmissions = pgTable(
	"tasks_repeatable_scheduled_submissions",
	{
		id: integer("id")
			.primaryKey()
			.references(() => tasksRepeatable.id),
		authorIdSubmission: integer("author_id_submission").notNull(),
		ghost: boolean("ghost").notNull(),
		private: boolean("private").notNull(),
		over18: boolean("over_18").notNull(),
		isBot: boolean("is_bot").notNull(),
		title: varchar("title", { length: 500 }).notNull(),
		url: varchar("url"),
		body: text("body"),
		bodyHtml: text("body_html"),
		flair: varchar("flair"),
		embedUrl: varchar("embed_url"),
	},
);

export const userBlocks = pgTable(
	"userblocks",
	{
		userId: integer("user_id")
			.notNull()
			.references(() => users.id),
		targetId: integer("target_id")
			.notNull()
			.references(() => users.id),
	},
	(table) => [primaryKey({ columns: [table.userId, table.targetId] })],
);

export const userNotes = pgTable("usernotes", {
	id: serial("id").primaryKey(),
	authorId: integer("author_id")
		.notNull()
		.references(() => users.id),
	referenceUser: integer("reference_user")
		.notNull()
		.references(() => users.id),
	referenceComment: integer("reference_comment").references(() => comments.id),
	referencePost: integer("reference_post").references(() => submissions.id),
	note: varchar("note", { length: 10000 }).notNull(),
	tag: userTagEnum("tag").notNull(),
	createdDatetimez: timestamp("created_datetimez", {
		withTimezone: true,
		mode: "date",
	})
		.notNull()
		.defaultNow(),
});

export const volunteerJanitor = pgTable("volunteer_janitor", {
	id: serial("id").primaryKey(),
	userId: integer("user_id")
		.notNull()
		.references(() => users.id),
	commentId: integer("comment_id")
		.notNull()
		.references(() => comments.id),
	result: volunteerJanitorResultEnum("result").notNull(),
	recordedDatetimez: timestamp("recorded_datetimez", {
		withTimezone: true,
		mode: "date",
	})
		.notNull()
		.defaultNow(),
});
