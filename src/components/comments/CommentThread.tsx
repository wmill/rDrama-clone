import { Link, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
	createComment,
	type CommentSortType,
	type CommentWithReplies,
} from "@/lib/comments.server";
import { getCurrentUser } from "@/lib/sessions.server";
import type { VoteType } from "@/lib/votes.server";
import { Comment } from "./Comment";
import { Loader2 } from "lucide-react";

const createCommentFn = createServerFn({ method: "POST" })
	.inputValidator(
		(data: { body: string; parentSubmissionId: number }) => data,
	)
	.handler(
		async ({
			data,
		}: { data: { body: string; parentSubmissionId: number } }) => {
			const user = await getCurrentUser();
			if (!user) {
				return { success: false as const, error: "Not logged in" };
			}
			try {
				const id = await createComment({
					authorId: user.id,
					body: data.body,
					parentSubmissionId: data.parentSubmissionId,
				});
				return { success: true as const, id };
			} catch (err) {
				return {
					success: false as const,
					error:
						err instanceof Error ? err.message : "Failed to create comment",
				};
			}
		},
	);

const sortOptions: { value: CommentSortType; label: string }[] = [
	{ value: "top", label: "Top" },
	{ value: "new", label: "New" },
	{ value: "old", label: "Old" },
	{ value: "controversial", label: "Controversial" },
];

type CommentThreadProps = {
	submissionId: number;
	comments: CommentWithReplies[];
	commentCount: number;
	currentUserId?: number;
	userVotes: Map<number, VoteType>;
	sort?: CommentSortType;
	isLoading?: boolean;
	onSortChange?: (sort: CommentSortType) => void;
};

export function CommentThread({
	submissionId,
	comments,
	commentCount,
	currentUserId,
	userVotes,
	sort = "top",
	onSortChange,
	isLoading
}: CommentThreadProps) {
	const router = useRouter();
	const [newComment, setNewComment] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleSubmitComment = async () => {
		if (!newComment.trim() || isSubmitting) return;

		if (!currentUserId) {
			router.navigate({ to: "/login" });
			return;
		}

		setError(null);
		setIsSubmitting(true);

		try {
			const result = await createCommentFn({
				data: {
					body: newComment,
					parentSubmissionId: submissionId,
				},
			});

			if (result.success) {
				setNewComment("");
				router.invalidate();
			} else {
				setError(result.error ?? "Failed to post comment");
			}
		} catch {
			setError("Failed to post comment");
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleReplyAdded = useCallback(() => {
		router.invalidate();
	}, [router]);

	return (
		<div className="space-y-4">
			{/* Comment form */}
			<div className="space-y-3">
				<h2 className="text-lg font-semibold text-white">
					{commentCount} {commentCount === 1 ? "Comment" : "Comments"}
				</h2>

				{currentUserId ? (
					<div className="space-y-2">
						<Textarea
							value={newComment}
							onChange={(e) => setNewComment(e.target.value)}
							placeholder="What are your thoughts?"
							className="min-h-[100px] border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
						/>
						{error && (
							<p className="text-sm text-red-400">{error}</p>
						)}
						<Button
							onClick={handleSubmitComment}
							disabled={isSubmitting || !newComment.trim()}
						>
							{isSubmitting ? "Posting..." : "Post Comment"}
						</Button>
					</div>
				) : (
					<div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 text-center">
						<p className="text-slate-400">
							<Link to="/login" className="text-cyan-400 hover:text-cyan-300">
								Sign in
							</Link>{" "}
							to join the conversation
						</p>
					</div>
				)}
			</div>

			{/* Sort options */}
			{comments.length > 0 && (
				<div className="flex items-center gap-2">
					<span className="text-sm text-slate-400">Sort by:</span>
					<div className="flex gap-1 rounded-lg bg-slate-800 p-1">
						{sortOptions.map((option) => (
							<button
								key={option.value}
								type="button"
								onClick={() => onSortChange?.(option.value)}
								className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
									sort === option.value
										? "bg-cyan-500 text-white"
										: "text-slate-400 hover:text-white"
								}`}
							>
								{option.label}
							</button>
						))}
					</div>
				</div>
			)}


			{/* Comments list */}
			<ActualComments 
				submissionId={submissionId}
				currentUserId={currentUserId}
				userVotes={userVotes}
				onReplyAdded={handleReplyAdded}
				isLoading={isLoading}
				comments={comments}
			/>
		</div>
	);
}

type ActualCommentsProps = {
	comments: CommentWithReplies[];
	submissionId: number;
	currentUserId?: number;
	userVotes: Map<number, VoteType>;
	onReplyAdded: () => void;
	isLoading?: boolean;
}

function ActualComments({comments, submissionId, currentUserId, userVotes, onReplyAdded, isLoading}: ActualCommentsProps) {
	if (comments.length === 0) {
		return (
			<div className="rounded-lg border border-dashed border-slate-700 p-8 text-center">
				<p className="text-slate-500">
					No comments yet. Be the first to share your thoughts!
				</p>
			</div>
		);
	}

	return (<div className="relative space-y-1">
		{isLoading && (
			<div className="absolute inset-0 z-10 flex items-start justify-center rounded-xl bg-slate-900/80 backdrop-blur-sm">
				<Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
			</div>
		)}
		
		{comments.map((comment) => (
			<Comment
				key={comment.id}
				devKey={String(comment.id)}
				comment={comment}
				submissionId={submissionId}
				currentUserId={currentUserId}
				userVotes={userVotes}
				onReplyAdded={onReplyAdded}
			/>
		))}
	</div>)
}