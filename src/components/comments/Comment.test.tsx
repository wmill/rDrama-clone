import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { CommentWithReplies } from "@/lib/comments.server";
import { renderCommentMarkdown } from "@/lib/markdown";
import { Comment } from "./Comment";

const { invalidate } = vi.hoisted(() => ({ invalidate: vi.fn() }));

vi.mock("@tanstack/react-router", () => ({
	useRouter: () => ({ invalidate }),
	Link: ({ children, to, ...props }: { children: ReactNode; to: string }) => (
		<a href={to} {...props}>
			{children}
		</a>
	),
}));

vi.mock("./VoteButtons", () => ({
	VoteButtons: () => <div data-testid="vote-buttons" />,
}));

vi.mock("@/stores/modals", () => ({
	useModalsStore: (selector: (state: unknown) => unknown) =>
		selector({
			openReportModal: vi.fn(),
			openDeleteCommentModal: vi.fn(),
		}),
}));

vi.mock("@/lib/comment-actions.server", () => ({
	createCommentFn: vi.fn(),
	deleteCommentFn: vi.fn(),
	pinCommentAsOpFn: vi.fn(),
	restoreCommentFn: vi.fn(),
	saveCommentFn: vi.fn(),
	setOwnCommentNsfwFn: vi.fn(),
	updateCommentFn: vi.fn(),
}));

import {
	pinCommentAsOpFn,
	restoreCommentFn,
	setOwnCommentNsfwFn,
} from "@/lib/comment-actions.server";

vi.mock("@/lib/admin-actions.server", () => ({
	distinguishCommentFn: vi.fn(),
	pinCommentFn: vi.fn(),
	setCommentModerationStateFn: vi.fn(),
	setCommentNsfwFn: vi.fn(),
}));

vi.mock("@/lib/reporting-actions.server", () => ({
	reportCommentFn: vi.fn(),
}));

import { updateCommentFn } from "@/lib/comment-actions.server";

function makeComment(): CommentWithReplies {
	return {
		id: 1,
		authorId: 7,
		authorName: "alice",
		body: "original body",
		bodyHtml: "<p>original body</p>",
		createdUtc: 100,
		editedUtc: 0,
		upvotes: 1,
		downvotes: 0,
		score: 1,
		level: 0,
		parentCommentId: null,
		parentSubmissionId: 42,
		descendantCount: 0,
		pinnedBy: null,
		distinguishLevel: 0,
		isDeleted: false,
		isRemoved: false,
		isFiltered: false,
		isPinned: false,
		isSaved: false,
		isModHidden: false,
		userVote: 0,
		stateMod: "VISIBLE",
		stateModSetBy: null,
		replies: [],
	};
}

describe("Comment awards", () => {
	it("renders award chips in the comment header", () => {
		const comment = {
			...makeComment(),
			awards: [{ kind: "silver", count: 3 }],
		};

		render(
			<Comment comment={comment} submissionId={42} submissionAuthorId={99} />,
		);

		expect(screen.getByTitle("Silver x3")).toBeDefined();
		expect(screen.getByTitle("Silver x3").textContent).toContain("3");
	});
});

describe("Comment pin labels and permissions", () => {
	it("labels OP and moderator pins distinctly", () => {
		const { rerender } = render(
			<Comment
				comment={{ ...makeComment(), pinnedBy: "(OP)", isPinned: true }}
				submissionId={42}
				submissionAuthorId={99}
			/>,
		);
		expect(screen.getByText("Pinned by OP")).not.toBeNull();

		rerender(
			<Comment
				key="moderator-pin"
				comment={{ ...makeComment(), pinnedBy: "moderator", isPinned: true }}
				submissionId={42}
				submissionAuthorId={99}
			/>,
		);
		expect(screen.getByText("Pinned by moderator")).not.toBeNull();
	});

	it("lets the post author toggle an OP pin", async () => {
		vi.mocked(pinCommentAsOpFn).mockResolvedValue({
			success: true,
			changed: true,
		});
		render(
			<Comment
				comment={makeComment()}
				submissionId={42}
				submissionAuthorId={99}
				currentUserId={99}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Pin as OP" }));
		await waitFor(() =>
			expect(pinCommentAsOpFn).toHaveBeenCalledWith({
				data: { id: 1, pinned: true },
			}),
		);
		expect(screen.getByText("Pinned by OP")).not.toBeNull();
	});

	it("does not offer an OP unpin for a moderator pin", () => {
		render(
			<Comment
				comment={{ ...makeComment(), pinnedBy: "moderator", isPinned: true }}
				submissionId={42}
				submissionAuthorId={99}
				currentUserId={99}
			/>,
		);
		expect(screen.queryByRole("button", { name: /pin as OP/i })).toBeNull();
	});
});

describe("Comment NSFW behavior", () => {
	it("renders the NSFW gate while retaining the comment", () => {
		render(
			<Comment
				comment={{
					...makeComment(),
					isNsfw: true,
					isNsfwHidden: true,
					bodyHtml:
						"<p>Enable NSFW content in settings to view this comment</p>",
				}}
				submissionId={42}
				submissionAuthorId={99}
			/>,
		);
		expect(screen.getByText("NSFW")).not.toBeNull();
		expect(screen.getByText(/Enable NSFW content/i)).not.toBeNull();
	});

	it("lets the author toggle the NSFW flag", async () => {
		vi.mocked(setOwnCommentNsfwFn).mockResolvedValue({ success: true });
		render(
			<Comment
				comment={makeComment()}
				submissionId={42}
				submissionAuthorId={99}
				currentUserId={7}
			/>,
		);
		fireEvent.click(screen.getByRole("button", { name: "Mark NSFW" }));
		await waitFor(() =>
			expect(setOwnCommentNsfwFn).toHaveBeenCalledWith({
				data: { id: 1, nsfw: true },
			}),
		);
		expect(screen.getByText("NSFW")).not.toBeNull();
	});
});

describe("Comment highlighting", () => {
	it("marks comments newer than the supplied highlight threshold", () => {
		const { container } = render(
			<Comment
				comment={{ ...makeComment(), createdUtc: 200 }}
				submissionId={42}
				submissionAuthorId={99}
				highlightComments
				highlightSince={150}
			/>,
		);
		expect(container.querySelector('[data-highlighted="true"]')).not.toBeNull();
	});
});

describe("Comment editing", () => {
	it("shows rendered markdown, not raw markdown, after a successful edit", async () => {
		const comment = makeComment();
		vi.mocked(updateCommentFn).mockImplementation(async (input) => {
			const { body } = (input as { data: { body: string } }).data;
			return {
				success: true as const,
				comment: {
					...comment,
					body,
					bodyHtml: renderCommentMarkdown(body),
				},
			};
		});

		const { container } = render(
			<Comment
				comment={comment}
				submissionId={42}
				submissionAuthorId={99}
				currentUserId={7}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: /Edit/i }));

		const textarea = screen.getByDisplayValue("original body");
		fireEvent.change(textarea, {
			target: { value: "**bold** and ||spoiler|| text" },
		});
		fireEvent.click(screen.getByRole("button", { name: /^Save$/i }));

		await waitFor(() => {
			expect(screen.queryByDisplayValue(/bold/)).toBeNull();
		});

		const body = container.querySelector(".prose");
		expect(body).not.toBeNull();
		expect(body?.innerHTML).toContain("<strong>bold</strong>");
		expect(body?.innerHTML).toContain('<span class="spoiler">spoiler</span>');
		expect(body?.textContent).not.toContain("**bold**");
	});
});

describe("Comment restore", () => {
	it("renders Restore for the author placeholder and restores its body", async () => {
		vi.mocked(restoreCommentFn).mockResolvedValue({ success: true });
		const comment = { ...makeComment(), isDeleted: true };
		const { container } = render(
			<Comment
				comment={comment}
				submissionId={42}
				submissionAuthorId={99}
				currentUserId={7}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Restore" }));
		await waitFor(() => expect(invalidate).toHaveBeenCalled());
		expect(container.querySelector(".prose")?.innerHTML).toContain(
			"original body",
		);
	});
});
