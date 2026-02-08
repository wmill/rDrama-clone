import { createRequire } from "node:module";
import { config } from "dotenv";
import { resolve } from "node:path";
import { faker } from "@faker-js/faker";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/db/schema.ts";

// tracery-grammar is CJS-only, no types
const require = createRequire(import.meta.url);
const tracery = require("tracery-grammar");

// ---------- env ----------
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
	console.error("DATABASE_URL is not set");
	process.exit(1);
}

// ---------- cli args ----------
function getArg(name: string, fallback: number): number {
	const idx = process.argv.indexOf(`--${name}`);
	if (idx === -1 || idx + 1 >= process.argv.length) return fallback;
	const val = Number.parseInt(process.argv[idx + 1], 10);
	return Number.isNaN(val) ? fallback : val;
}

const SEED = getArg("seed", 12345);
const NUM_USERS = getArg("users", 50);
const NUM_SUBMISSIONS = getArg("submissions", 10);
const COMMENTS_PER_SUBMISSION = getArg("comments", 1000);
const MAX_DEPTH = getArg("max-depth", 20);
const BATCH_SIZE = getArg("batch-size", 500);
const CLEAN = process.argv.includes("--clean") || process.argv.includes("--clean-only");
const CLEAN_ONLY = process.argv.includes("--clean-only");

faker.seed(SEED);

// Seed tracery's RNG with a simple seeded PRNG so output is deterministic
let _rngState = SEED;
tracery.setRng(() => {
	_rngState = (_rngState * 16807 + 0) % 2147483647;
	return _rngState / 2147483647;
});

// ---------- tracery grammars ----------
const commentGrammar = tracery.createGrammar({
	origin: [
		"#hotTake# #reason#",
		"#agreeDisagree# #example#",
		"#meta# #snark#",
		"#question# #followup#",
		"#story# #edit#",
		"#tangent#",
		"#comparison#",
		"#selfDeprecating# #pivot#",
		"#prediction#",
		"#anecdote# #lesson#",
	],
	hotTake: [
		"Unpopular opinion:",
		"Hot take:",
		"This is going to get downvoted, but",
		"Everyone's missing the point:",
		"I'll say what nobody else will:",
		"Controversial, I know, but",
		"Prepare for a spicy take:",
	],
	reason: [
		"the real issue is #topic#.",
		"it boils down to #topic# and #topic#.",
		"it's basically #topic# with extra steps.",
		"you can't ignore how #topic# plays into this.",
		"if you look at it through the lens of #topic#, it makes sense.",
		"once you understand #topic#, the rest follows.",
	],
	agreeDisagree: [
		"I agree, but",
		"I disagree, because",
		"Mostly true, except",
		"Counterpoint:",
		"That's fair, however",
		"Sure, but have you considered",
		"I used to think this too, until",
		"You're right in theory, but in practice",
	],
	example: [
		"in my case, #topic# was the difference.",
		"I've seen this happen with #topic#.",
		"this matches what I've read about #topic#.",
		"look at how #platform# handled #topic#.",
		"anyone who's worked on #topic# knows this.",
		"#topic# proved this exact thing wrong last year.",
	],
	meta: [
		"Can we stop pretending",
		"This thread is wild because",
		"People say #topic#, but",
		"Sorting by controversial and",
		"I swear every thread about #topic# turns into",
		"The real content is always in the replies, because",
	],
	snark: [
		"nobody has a source.",
		"everyone's arguing past each other.",
		"the comments are more interesting than the post.",
		"nobody actually read the article.",
		"we're just going in circles at this point.",
		"half these accounts are bots anyway.",
		"somebody always brings up #topic#.",
	],
	question: [
		"Serious question:",
		"Do you have a link for that?",
		"What do you mean by #topic#?",
		"How does this relate to #topic#?",
		"Has anyone actually tested this with #topic#?",
		"Wait, are you saying #topic# doesn't matter?",
		"Genuine question: does #topic# change anything here?",
	],
	followup: [
		"I'm not trying to be rude—just curious.",
		"Genuinely asking.",
		"Not sure I'm following.",
		"I feel like this gets asked every week.",
		"Would love to see data on this.",
		"Asking for a friend, obviously.",
	],
	story: [
		"This happened to me once:",
		"Small anecdote:",
		"I used to think that too,",
		"True story:",
		"My experience was completely different—",
		"When I was dealing with #topic#,",
	],
	edit: [
		"Edit: okay, I see the point now.",
		"Edit: spelling.",
		"Edit: added context.",
		"Edit: why is this my most upvoted comment?",
		"Edit: RIP my inbox.",
		"Edit: I stand corrected on #topic#.",
	],
	tangent: [
		"This reminds me of the time #platform# tried to fix #topic# and made everything worse.",
		"Slightly off-topic, but #topic# is going to be huge this year.",
		"Nobody's talking about how #topic# connects to #topic#.",
		"Idk why but this made me think about #topic#.",
		"Speaking of #topic#, has anyone noticed #observation#?",
	],
	comparison: [
		"This is like the #topic# situation all over again.",
		"It's basically #platform# vs #platform# but for #topic#.",
		"Imagine explaining this thread to someone from #timeframe#.",
		"This is what happens when you combine #topic# with #topic#.",
	],
	selfDeprecating: [
		"I have no idea what I'm talking about, but",
		"Take this with a grain of salt because",
		"I'm probably wrong, but",
		"This is going to sound dumb, but",
		"Disclaimer: I'm an idiot, however",
	],
	pivot: [
		"I think #topic# is the key that nobody's considering.",
		"the real answer probably involves #topic#.",
		"it seems like #topic# would solve most of these issues.",
		"we should be looking at #topic# instead.",
	],
	prediction: [
		"Mark my words: #topic# is going to blow up within #timeframe#.",
		"In #timeframe#, we'll look back at #topic# and laugh.",
		"I guarantee #topic# will be irrelevant in #timeframe#.",
		"Prediction: #platform# will adopt #topic# by #timeframe#.",
	],
	anecdote: [
		"I worked at a place where #topic# was everything.",
		"My friend built a whole #topic# system from scratch.",
		"I once spent a week debugging #topic#.",
		"I remember when #topic# was considered cutting edge.",
	],
	lesson: [
		"The takeaway? Don't trust the defaults.",
		"Lesson learned: always benchmark #topic# first.",
		"Long story short, #topic# saved us.",
		"Moral of the story: read the docs.",
		"In hindsight, we should have started with #topic#.",
	],
	observation: [
		"how quiet the mods have been",
		"the shift in how people talk about #topic#",
		"that everyone's suddenly an expert on #topic#",
		"how different the tone is from last year",
	],
	topic: [
		"caching",
		"moderation",
		"mobile UI",
		"ranking algorithms",
		"bots",
		"performance",
		"tags",
		"federation",
		"shadowbans",
		"karma",
		"dark mode",
		"rate limiting",
		"content filtering",
		"accessibility",
		"two-factor auth",
		"API design",
		"open source",
		"monetization",
		"user onboarding",
		"notifications",
		"search indexing",
		"pagination",
		"CDN costs",
		"spam detection",
	],
	platform: [
		"Reddit",
		"Twitter",
		"Mastodon",
		"Lemmy",
		"Hacker News",
		"Lobsters",
		"Discord",
		"Bluesky",
		"Threads",
	],
	timeframe: [
		"6 months",
		"a year",
		"two years",
		"5 years",
		"a decade",
		"next quarter",
	],
});
commentGrammar.addModifiers(tracery.baseEngModifiers);

const titleGrammar = tracery.createGrammar({
	origin: [
		"#opener# #subject#",
		"#subject# — #commentary#",
		"#askPrefix# #subject#?",
		"#subject#: #commentary#",
		"[#tag#] #subject#",
	],
	opener: [
		"The state of",
		"Let's talk about",
		"Why does nobody discuss",
		"Unpopular opinion about",
		"I'm tired of",
		"Can we fix",
		"PSA about",
		"An honest take on",
		"Why I stopped caring about",
		"Everything wrong with",
	],
	subject: [
		"#topic# on this site",
		"the current #topic# situation",
		"how #platform# handles #topic#",
		"#topic# vs #topic#",
		"the #topic# problem nobody talks about",
		"our approach to #topic#",
		"modern #topic#",
	],
	commentary: [
		"thoughts from someone who's been here too long",
		"a rant",
		"am I wrong?",
		"why is this so hard?",
		"it's worse than you think",
		"we need to do better",
		"an underrated problem",
		"the real story",
	],
	askPrefix: [
		"What's the deal with",
		"Does anyone actually understand",
		"Why is everyone ignoring",
		"Has anyone solved",
		"How do you feel about",
		"Who decided",
		"When did we stop caring about",
	],
	tag: ["Discussion", "Meta", "Rant", "Question", "Serious", "Debate"],
	topic: [
		"caching",
		"moderation",
		"mobile UI",
		"ranking algorithms",
		"bots",
		"performance",
		"tags",
		"federation",
		"shadowbans",
		"karma",
		"dark mode",
		"rate limiting",
		"content filtering",
		"notifications",
		"API design",
		"open source",
		"spam detection",
	],
	platform: [
		"Reddit",
		"Twitter",
		"Mastodon",
		"Lemmy",
		"Hacker News",
		"Bluesky",
	],
});
titleGrammar.addModifiers(tracery.baseEngModifiers);

const bodyGrammar = tracery.createGrammar({
	origin: [
		"#intro#\n\n#body1#\n\n#body2#\n\n#closing#",
		"#intro#\n\n#body1#\n\n#closing#",
		"#rant#",
		"#intro#\n\n#listIntro#\n\n#list#\n\n#closing#",
	],
	intro: [
		"I've been thinking about this for a while and I need to get it off my chest.",
		"This might be a #temperature# take, but hear me out.",
		"So I've been using this site for #duration# and I've noticed something.",
		"Before anyone says 'just use #platform#' — I've tried. Hear me out.",
		"Throwaway for obvious reasons. Here goes.",
	],
	body1: [
		"The core issue is that #topic# isn't being handled well. Every time I see a thread about it, the same arguments come up and nothing changes.",
		"I think most people agree that #topic# needs work, but nobody can agree on how to fix it. Some say #solution#, others say #solution#.",
		"Look, I get that #topic# is complicated. But we've been dealing with this for #duration# and the current approach clearly isn't working.",
	],
	body2: [
		"What I'd propose instead is #solution#. I know it's not perfect, but at least it addresses #topic# directly.",
		"Compare this to how #platform# does it. They solved #topic# by #solution# and nobody complained.",
		"The real bottleneck isn't even #topic# — it's #topic#. Fix that first and the rest falls into place.",
	],
	rant: [
		"I just need to vent. #topic# is broken, the mods know it, we all know it, and yet here we are pretending everything's fine. Every single day there's a new thread about it and the answer is always '#solution#' as if that's some kind of revelation. I'm exhausted.\n\nEdit: I feel better now.",
		"Hot take: #topic# was never good. We just didn't have alternatives. Now we do (#platform# exists) and people are still clinging to the old way because of nostalgia or whatever. Time to move on.\n\nInb4 'just leave then' — I would but #topic# keeps pulling me back.",
	],
	listIntro: ["Here's what I think needs to change:", "My proposal, point by point:"],
	list: [
		"1. #solution#\n2. #solution#\n3. #solution#",
		"- #solution#\n- #solution#\n- #solution#\n- #solution#",
	],
	closing: [
		"Anyway, that's my #temperature# take. Let me know what you think.",
		"TLDR: #topic# needs #solution#. Fight me.",
		"If you read this far, thanks. Genuinely curious what you all think.",
		"Am I crazy or does this make sense? Open to being wrong here.",
		"Ready for the downvotes, but someone had to say it.",
	],
	temperature: ["lukewarm", "hot", "scorching", "ice cold", "mildly spicy"],
	duration: [
		"a few months",
		"over a year",
		"way too long",
		"since the beginning",
		"about six months",
	],
	solution: [
		"better moderation tools",
		"transparent ranking",
		"community-elected mods",
		"open-sourcing the algorithm",
		"rate limiting power users",
		"killing karma entirely",
		"adding proper tags",
		"investing in mobile",
		"actually reading user feedback",
		"a complete rewrite",
		"federation",
		"better onboarding",
	],
	topic: [
		"caching",
		"moderation",
		"mobile UI",
		"ranking algorithms",
		"bots",
		"performance",
		"content filtering",
		"karma",
		"spam detection",
		"notifications",
	],
	platform: ["Reddit", "Mastodon", "Lemmy", "Hacker News", "Bluesky", "Lobsters"],
});
bodyGrammar.addModifiers(tracery.baseEngModifiers);

// ---------- helpers ----------
function generateComment(): string {
	return commentGrammar.flatten("#origin#");
}

function generateTitle(): string {
	return titleGrammar.flatten("#origin#");
}

function generateBody(): string {
	return bodyGrammar.flatten("#origin#");
}

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function textToHtml(text: string): string {
	return text
		.split("\n")
		.map((line) => `<p>${escapeHtml(line)}</p>`)
		.join("");
}

function nowUtc(): number {
	return Math.floor(Date.now() / 1000);
}

// ---------- db ----------
const pool = new Pool({ connectionString: databaseUrl });
const db = drizzle(pool, { schema });

// ---------- generation ----------
async function createUsers(count: number): Promise<number[]> {
	console.log(`Creating ${count} users...`);
	const baseUtc = nowUtc() - 86400 * 365; // ~1 year ago

	const rows = [];
	for (let i = 0; i < count; i++) {
		const username = `${faker.internet.username()}_g${SEED}_${i}`.slice(0, 255);
		rows.push({
			username,
			email: faker.internet.email().slice(0, 255),
			passhash: "$2b$10$fakefakefakefakefakefakefakefakefakefakefakefakefakefak", // placeholder
			createdUtc: baseUtc + faker.number.int({ min: 0, max: 86400 * 365 }),
			defaultTime: "day",
			nameColor: faker.color.rgb({ format: "hex" }).replace("#", "").slice(0, 6),
			titleColor: faker.color.rgb({ format: "hex" }).replace("#", "").slice(0, 6),
			theme: "dark",
			reddit: "none",
			volunteerJanitorCorrectness: 0,
			chatAuthorized: false,
			chatLastSeen: new Date(),
			filterBehavior: "AUTOMATIC" as const,
			cardView: faker.datatype.boolean(),
			themeColor: faker.color.rgb({ format: "hex" }).replace("#", "").slice(0, 6),
		});
	}

	const inserted = await db
		.insert(schema.users)
		.values(rows)
		.returning({ id: schema.users.id });

	const ids = inserted.map((r) => r.id);
	console.log(`  Created ${ids.length} users (IDs ${ids[0]}–${ids[ids.length - 1]})`);
	return ids;
}

function pickRandom<T>(arr: T[]): T {
	return arr[faker.number.int({ min: 0, max: arr.length - 1 })];
}

async function createSubmissions(
	count: number,
	userIds: number[],
): Promise<number[]> {
	console.log(`Creating ${count} submissions...`);
	const baseUtc = nowUtc() - 86400 * 30; // ~1 month ago

	const rows = [];
	for (let i = 0; i < count; i++) {
		const title = generateTitle();
		const body = generateBody();
		rows.push({
			authorId: pickRandom(userIds),
			createdUtc: baseUtc + faker.number.int({ min: 0, max: 86400 * 30 }),
			title,
			titleHtml: `<p>${escapeHtml(title)}</p>`,
			body,
			bodyHtml: textToHtml(body),
			upvotes: faker.number.int({ min: 1, max: 500 }),
			downvotes: faker.number.int({ min: 0, max: 100 }),
			views: faker.number.int({ min: 10, max: 10000 }),
			stateMod: "VISIBLE" as const,
			stateReport: "UNREPORTED" as const,
		});
	}

	const inserted = await db
		.insert(schema.submissions)
		.values(rows)
		.returning({ id: schema.submissions.id });

	const ids = inserted.map((r) => r.id);
	console.log(`  Created ${ids.length} submissions (IDs ${ids[0]}–${ids[ids.length - 1]})`);
	return ids;
}

interface TempComment {
	tempId: number;
	parentTempId: number | null;
	level: number;
	authorId: number;
	createdUtc: number;
	body: string;
	bodyHtml: string;
	upvotes: number;
	downvotes: number;
}

function buildCommentTree(
	totalComments: number,
	userIds: number[],
	baseUtc: number,
): TempComment[] {
	const comments: TempComment[] = [];

	for (let i = 0; i < totalComments; i++) {
		const body = generateComment();
		const ups = faker.number.int({ min: 1, max: 200 });
		const downs = faker.number.int({ min: 0, max: 30 });

		let parentTempId: number | null = null;
		let level = 0;

		if (comments.length > 0) {
			// 85% chance of replying, 15% top-level
			const shouldReply = faker.number.float({ min: 0, max: 1 }) < 0.85;

			if (shouldReply) {
				const eligible = comments.filter((c) => c.level < MAX_DEPTH);
				if (eligible.length > 0) {
					// Bias toward recent comments for thread continuity
					const biasedIndex = Math.floor(
						eligible.length *
							(1 -
								faker.number.float({ min: 0, max: 1 }) ** 2),
					);
					const parent =
						eligible[Math.min(biasedIndex, eligible.length - 1)];
					parentTempId = parent.tempId;
					level = parent.level + 1;
				}
			}
		}

		comments.push({
			tempId: i,
			parentTempId,
			level,
			authorId: pickRandom(userIds),
			createdUtc: baseUtc + faker.number.int({ min: 0, max: 86400 * 7 }),
			body,
			bodyHtml: `<p>${escapeHtml(body)}</p>`,
			upvotes: ups,
			downvotes: downs,
		});
	}

	return comments;
}

async function createCommentsForSubmission(
	submissionId: number,
	totalComments: number,
	userIds: number[],
): Promise<void> {
	console.log(
		`  Submission ${submissionId}: generating ${totalComments} comments (max depth ${MAX_DEPTH})...`,
	);
	const baseUtc = nowUtc() - 86400 * 7;

	// 1) Build tree in-memory with temp IDs
	console.log("    Building comment tree in memory...");
	const tree = buildCommentTree(totalComments, userIds, baseUtc);

	// Group by level so parents are inserted before children
	const byLevel = new Map<number, TempComment[]>();
	for (const c of tree) {
		const list = byLevel.get(c.level) ?? [];
		list.push(c);
		byLevel.set(c.level, list);
	}

	const maxLevel = Math.max(...byLevel.keys());
	console.log(
		`    Tree built: ${byLevel.get(0)?.length ?? 0} top-level, max depth ${maxLevel}`,
	);

	// 2) Insert level by level, mapping tempId → dbId
	const tempToDb = new Map<number, number>();
	// Track top-comment ID: for level-0 it's themselves, for deeper it's inherited
	const tempToTopTemp = new Map<number, number>();
	for (const c of tree) {
		if (c.parentTempId === null) {
			tempToTopTemp.set(c.tempId, c.tempId);
		} else {
			const parentTop = tempToTopTemp.get(c.parentTempId);
			tempToTopTemp.set(
				c.tempId,
				parentTop !== undefined ? parentTop : c.parentTempId,
			);
		}
	}

	let totalInserted = 0;

	for (let lvl = 0; lvl <= maxLevel; lvl++) {
		const levelComments = byLevel.get(lvl);
		if (!levelComments) continue;

		// Insert in batches
		for (let i = 0; i < levelComments.length; i += BATCH_SIZE) {
			const chunk = levelComments.slice(i, i + BATCH_SIZE);
			const rows = chunk.map((c) => {
				const parentDbId =
					c.parentTempId !== null
						? (tempToDb.get(c.parentTempId) ?? null)
						: null;
				const topTempId = tempToTopTemp.get(c.tempId);
				const topDbId =
					topTempId !== undefined && topTempId !== c.tempId
						? (tempToDb.get(topTempId) ?? null)
						: null;

				return {
					authorId: c.authorId,
					createdUtc: c.createdUtc,
					parentSubmission: submissionId,
					level: c.level,
					parentCommentId: parentDbId,
					topCommentId: topDbId, // level-0 gets null now, fixed below
					body: c.body,
					bodyHtml: c.bodyHtml,
					upvotes: c.upvotes,
					downvotes: c.downvotes,
					realUpvotes: c.upvotes - c.downvotes,
					volunteerJanitorBadness: 0,
					stateMod: "VISIBLE" as const,
					stateReport: "UNREPORTED" as const,
					descendantCount: 0,
				};
			});

			const inserted = await db
				.insert(schema.comments)
				.values(rows)
				.returning({ id: schema.comments.id });

			for (let j = 0; j < inserted.length; j++) {
				tempToDb.set(chunk[j].tempId, inserted[j].id);
			}

			totalInserted += inserted.length;
		}

		if (totalInserted % 2000 === 0 || lvl === maxLevel) {
			console.log(
				`    Level ${lvl}: ${levelComments.length} comments (${totalInserted}/${totalComments} total)`,
			);
		}
	}

	// 3) Update top-level comments: topCommentId = own ID
	const { sql, inArray } = await import("drizzle-orm");
	const topLevelComments = tree
		.filter((c) => c.level === 0)
		.map((c) => tempToDb.get(c.tempId)!)
		.filter(Boolean);

	for (let i = 0; i < topLevelComments.length; i += BATCH_SIZE) {
		const chunk = topLevelComments.slice(i, i + BATCH_SIZE);
		await db
			.update(schema.comments)
			.set({ topCommentId: sql`id` })
			.where(inArray(schema.comments.id, chunk));
	}

	// 4) Update descendant_count
	await updateDescendantCounts(submissionId);

	// 5) Update submission comment_count
	await db.execute(
		sql`UPDATE submissions SET comment_count = (SELECT count(*) FROM comments WHERE parent_submission = ${submissionId}) WHERE id = ${submissionId}`,
	);
}

async function updateDescendantCounts(submissionId: number): Promise<void> {
	console.log("    Updating descendant counts...");
	const { sql } = await import("drizzle-orm");
	// Recursive CTE: count ALL descendants (not just direct children)
	await db.execute(sql`
		WITH RECURSIVE tree AS (
			SELECT id, parent_comment_id
			FROM comments
			WHERE parent_submission = ${submissionId}
		),
		descendants AS (
			-- direct children
			SELECT parent_comment_id AS ancestor_id, id AS descendant_id
			FROM tree
			WHERE parent_comment_id IS NOT NULL

			UNION ALL

			-- indirect descendants
			SELECT d.ancestor_id, t.id AS descendant_id
			FROM descendants d
			JOIN tree t ON t.parent_comment_id = d.descendant_id
		),
		counts AS (
			SELECT ancestor_id AS id, count(*) AS cnt
			FROM descendants
			GROUP BY ancestor_id
		)
		UPDATE comments
		SET descendant_count = counts.cnt
		FROM counts
		WHERE comments.id = counts.id
	`);
}

async function cleanGeneratedData(): Promise<void> {
	console.log("Cleaning previously generated data...");
	const { like } = await import("drizzle-orm");

	// Find generated user IDs (they have the _g{seed}_ pattern)
	const genUsers = await db
		.select({ id: schema.users.id })
		.from(schema.users)
		.where(like(schema.users.username, `%\\_g${SEED}\\_%`));

	if (genUsers.length === 0) {
		console.log("  No generated data found for this seed.");
		return;
	}

	const userIds = genUsers.map((u) => u.id);
	console.log(`  Found ${userIds.length} generated users`);

	// Delete in order: comments → submissions → users (FK constraints)
	const { inArray } = await import("drizzle-orm");

	// Find submissions by these users
	const genSubmissions = await db
		.select({ id: schema.submissions.id })
		.from(schema.submissions)
		.where(inArray(schema.submissions.authorId, userIds));
	const subIds = genSubmissions.map((s) => s.id);

	if (subIds.length > 0) {
		// Delete comment votes for comments on these submissions
		const genComments = await db
			.select({ id: schema.comments.id })
			.from(schema.comments)
			.where(inArray(schema.comments.parentSubmission, subIds));
		const commentIds = genComments.map((c) => c.id);

		if (commentIds.length > 0) {
			for (let i = 0; i < commentIds.length; i += BATCH_SIZE) {
				const chunk = commentIds.slice(i, i + BATCH_SIZE);
				await db
					.delete(schema.commentVotes)
					.where(inArray(schema.commentVotes.commentId, chunk));
			}
		}

		// Nullify self-FK before deleting comments
		await db
			.update(schema.comments)
			.set({ parentCommentId: null, topCommentId: null })
			.where(inArray(schema.comments.parentSubmission, subIds));
		await db
			.delete(schema.comments)
			.where(inArray(schema.comments.parentSubmission, subIds));
		console.log(`  Deleted comments`);

		// Delete submission votes
		await db
			.delete(schema.votes)
			.where(inArray(schema.votes.submissionId, subIds));

		// Delete submissions
		await db
			.delete(schema.submissions)
			.where(inArray(schema.submissions.id, subIds));
		console.log(`  Deleted ${subIds.length} submissions`);
	}

	// Delete users
	await db.delete(schema.users).where(inArray(schema.users.id, userIds));
	console.log(`  Deleted ${userIds.length} users`);
}

// ---------- main ----------
async function main() {
	console.log("=== rDrama Data Generator ===");
	console.log(`  seed:       ${SEED}`);
	console.log(`  users:      ${NUM_USERS}`);
	console.log(`  submissions: ${NUM_SUBMISSIONS}`);
	console.log(`  comments/submission: ${COMMENTS_PER_SUBMISSION}`);
	console.log(`  max depth:  ${MAX_DEPTH}`);
	console.log(`  batch size: ${BATCH_SIZE}`);
	console.log(`  clean:      ${CLEAN}`);
	console.log("");

	if (CLEAN) {
		await cleanGeneratedData();
		if (CLEAN_ONLY) {
			await pool.end();
			return;
		}
		console.log("");
	}

	const userIds = await createUsers(NUM_USERS);
	const submissionIds = await createSubmissions(NUM_SUBMISSIONS, userIds);

	for (const submissionId of submissionIds) {
		await createCommentsForSubmission(
			submissionId,
			COMMENTS_PER_SUBMISSION,
			userIds,
		);
	}

	console.log("\nDone! Generated:");
	console.log(`  ${NUM_USERS} users`);
	console.log(`  ${NUM_SUBMISSIONS} submissions`);
	console.log(`  ${NUM_SUBMISSIONS * COMMENTS_PER_SUBMISSION} total comments`);

	await pool.end();
}

main().catch((err) => {
	console.error("Fatal error:", err);
	process.exit(1);
});
