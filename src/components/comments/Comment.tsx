import { Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import {
	ChevronDown,
	ChevronUp,
	Clock,
	MessageSquare,
	Pencil,
	Reply,
	Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { CommentWithReplies } from "@/lib/comments.server";
import {
	createComment,
	deleteComment,
	updateComment,
} from "@/lib/comments.server";
import { getCurrentUser } from "@/lib/sessions.server";
import type { VoteType } from "@/lib/votes.server";
import { VoteButtons } from "./VoteButtons";

const createCommentFn = createServerFn({ method: "POST" })
	.inputValidator(
		(data: {
			body: string;
			parentSubmissionId: number;
			parentCommentId?: number;
		}) => data,
	)
	.handler(
		async ({
			data,
		}: {
			data: {
				body: string;
				parentSubmissionId: number;
				parentCommentId?: number;
			};
		}) => {
			const user = await getCurrentUser();
			if (!user) {
				return { success: false as const, error: "Not logged in" };
			}
			try {
				const id = await createComment({
					authorId: user.id,
					body: data.body,
					parentSubmissionId: data.parentSubmissionId,
					parentCommentId: data.parentCommentId,
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

const updateCommentFn = createServerFn({ method: "POST" })
	.inputValidator((data: { id: number; body: string }) => data)
	.handler(async ({ data }: { data: { id: number; body: string } }) => {
		const user = await getCurrentUser();
		if (!user) {
			return { success: false as const, error: "Not logged in" };
		}
		const result = await updateComment(data.id, user.id, data.body);
		return { success: result };
	});

const deleteCommentFn = createServerFn({ method: "POST" })
	.inputValidator((data: { id: number }) => data)
	.handler(async ({ data }: { data: { id: number } }) => {
		const user = await getCurrentUser();
		if (!user) {
			return { success: false as const, error: "Not logged in" };
		}
		const result = await deleteComment(data.id, user.id);
		return { success: result };
	});

function formatRelativeTime(unixTimestamp: number): string {
	const now = Date.now() / 1000;
	const diff = now - unixTimestamp;

	if (diff < 60) return "just now";
	if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
	if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
	if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
	if (diff < 2592000) return `${Math.floor(diff / 604800)}w ago`;
	if (diff < 31536000) return `${Math.floor(diff / 2592000)}mo ago`;
	return `${Math.floor(diff / 31536000)}y ago`;
}

type CommentProps = {
	comment: CommentWithReplies;
	submissionId: number;
	currentUserId?: number;
	userVotes?: Map<number, VoteType>;
	depth?: number;
	maxDepth?: number;
	onReplyAdded?: () => void;
	visibleIds?: Set<number>;
};

export function Comment({
	comment,
	submissionId,
	currentUserId,
	userVotes = new Map(),
	depth = 0,
	maxDepth = 10,
	onReplyAdded,
	visibleIds,
}: CommentProps) {
	const [isCollapsed, setIsCollapsed] = useState(false);
	const [showReplyForm, setShowReplyForm] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const [replyText, setReplyText] = useState("");
	const [editText, setEditText] = useState(comment.body ?? "");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isDeleted, setIsDeleted] = useState(comment.isDeleted);
	const [currentBody, setCurrentBody] = useState(comment.bodyHtml);

	const isAuthor = currentUserId === comment.authorId;
	const userVote = userVotes.get(comment.id) ?? 0;

	const handleReply = async () => {
		if (!replyText.trim() || isSubmitting) return;

		setIsSubmitting(true);
		try {
			const result = await createCommentFn({
				data: {
					body: replyText,
					parentSubmissionId: submissionId,
					parentCommentId: comment.id,
				},
			});

			if (result.success) {
				setReplyText("");
				setShowReplyForm(false);
				onReplyAdded?.();
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleEdit = async () => {
		if (!editText.trim() || isSubmitting) return;

		setIsSubmitting(true);
		try {
			const result = await updateCommentFn({
				data: { id: comment.id, body: editText },
			});

			if (result.success) {
				setCurrentBody(editText);
				setIsEditing(false);
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleDelete = async () => {
		if (!confirm("Are you sure you want to delete this comment?")) return;

		setIsSubmitting(true);
		try {
			const result = await deleteCommentFn({ data: { id: comment.id } });

			if (result.success) {
				setIsDeleted(true);
				setCurrentBody("[deleted]");
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	const depthColors = [
		"border-l-cyan-500",
		"border-l-purple-500",
		"border-l-green-500",
		"border-l-yellow-500",
		"border-l-red-500",
		"border-l-blue-500",
		"border-l-pink-500",
		"border-l-orange-500",
	];

	const borderColor = depthColors[depth % depthColors.length];

	const createdTime = useMemo(
		() => formatRelativeTime(comment.createdUtc),
		[comment.createdUtc],
	);
	const editedTime = useMemo(
		() => formatRelativeTime(comment.editedUtc),
		[comment.editedUtc],
	);

	return (
		<div
			className={`${depth > 0 ? `ml-4 border-l-2 ${borderColor} pl-3` : ""}`}
		>
			<div className="group py-2">
				{/* Comment header */}
				<div className="flex items-center gap-2 text-xs text-slate-400">
					<button
						type="button"
						onClick={() => setIsCollapsed(!isCollapsed)}
						className="flex items-center gap-1 hover:text-slate-300"
					>
						{isCollapsed ? (
							<ChevronDown className="h-3 w-3" />
						) : (
							<ChevronUp className="h-3 w-3" />
						)}
					</button>

					<span className="font-medium text-cyan-400">
						{isDeleted ? "[deleted]" : comment.authorName}
					</span>

					{comment.distinguishLevel > 0 && (
						<span className="rounded bg-green-500/20 px-1.5 py-0.5 text-[10px] font-medium text-green-400">
							MOD
						</span>
					)}

					<span className="flex items-center gap-1">
						<Clock className="h-3 w-3" />
						{createdTime}
					</span>

					{comment.editedUtc > 0 && (
						<span className="text-slate-500">(edited {editedTime})</span>
					)}

					{isCollapsed && (
						<span className="text-slate-500">
							[{comment.replies.length + 1} collapsed]
						</span>
					)}
				</div>

				{!isCollapsed && (
					<>
						{/* Comment body */}
						<div className="mt-1 flex gap-2">
							<div className="flex-shrink-0 pt-1">
								<VoteButtons
									type="comment"
									id={comment.id}
									score={comment.score}
									userVote={userVote}
									size="sm"
									disabled={!currentUserId}
								/>
							</div>

							<div className="flex-1 min-w-0">
								{isEditing ? (
									<div className="space-y-2">
										<Textarea
											value={editText}
											onChange={(e) => setEditText(e.target.value)}
											className="min-h-[100px] border-slate-700 bg-slate-800 text-white"
										/>
										<div className="flex gap-2">
											<Button
												size="sm"
												onClick={handleEdit}
												disabled={isSubmitting}
											>
												{isSubmitting ? "Saving..." : "Save"}
											</Button>
											<Button
												size="sm"
												variant="outline"
												onClick={() => {
													setIsEditing(false);
													setEditText(comment.body ?? "");
												}}
											>
												Cancel
											</Button>
										</div>
									</div>
								) : (
									<div
										className="prose prose-invert prose-sm max-w-none text-slate-300"
										// biome-ignore lint/security/noDangerouslySetInnerHtml: Content sanitized server-side
										dangerouslySetInnerHTML={{ __html: currentBody }}
									/>
								)}

								{/* Actions */}
								{!isEditing && !isDeleted && (
									<div className="mt-2 flex items-center gap-3 text-xs">
										{currentUserId && (
											<button
												type="button"
												onClick={() => setShowReplyForm(!showReplyForm)}
												className="flex items-center gap-1 text-slate-500 hover:text-cyan-400"
											>
												<Reply className="h-3 w-3" />
												Reply
											</button>
										)}

										<Link
											to={`/comment/${comment.id}` as "/"}
											className="flex items-center gap-1 text-slate-500 hover:text-cyan-400"
										>
											<MessageSquare className="h-3 w-3" />
											Permalink
										</Link>

										{isAuthor && (
											<>
												<button
													type="button"
													onClick={() => setIsEditing(true)}
													className="flex items-center gap-1 text-slate-500 hover:text-cyan-400"
												>
													<Pencil className="h-3 w-3" />
													Edit
												</button>
												<button
													type="button"
													onClick={handleDelete}
													className="flex items-center gap-1 text-slate-500 hover:text-red-400"
												>
													<Trash2 className="h-3 w-3" />
													Delete
												</button>
											</>
										)}
									</div>
								)}

								{/* Reply form */}
								{showReplyForm && (
									<div className="mt-3 space-y-2">
										<Textarea
											value={replyText}
											onChange={(e) => setReplyText(e.target.value)}
											placeholder="Write a reply..."
											className="min-h-[80px] border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
										/>
										<div className="flex gap-2">
											<Button
												size="sm"
												onClick={handleReply}
												disabled={isSubmitting || !replyText.trim()}
											>
												{isSubmitting ? "Posting..." : "Reply"}
											</Button>
											<Button
												size="sm"
												variant="outline"
												onClick={() => {
													setShowReplyForm(false);
													setReplyText("");
												}}
											>
												Cancel
											</Button>
										</div>
									</div>
								)}
							</div>
						</div>

						{/* Replies */}
						{comment.replies.length > 0 &&
							depth < maxDepth &&
							(() => {
								const filteredReplies = visibleIds
									? comment.replies.filter((r) => visibleIds.has(r.id))
									: comment.replies;
								const hiddenCount =
									comment.replies.length - filteredReplies.length;
								return (
									<div className="mt-2">
										{filteredReplies.map((reply) => (
											<Comment
												key={reply.id}
												comment={reply}
												submissionId={submissionId}
												currentUserId={currentUserId}
												userVotes={userVotes}
												depth={depth + 1}
												maxDepth={maxDepth}
												onReplyAdded={onReplyAdded}
												visibleIds={visibleIds}
											/>
										))}
										{hiddenCount > 0 && (
											<p className="ml-4 mt-1 text-xs text-slate-500">
												{hiddenCount} more{" "}
												{hiddenCount === 1 ? "reply" : "replies"} hidden
											</p>
										)}
									</div>
								);
							})()}

						{comment.replies.length > 0 && depth >= maxDepth && (
							<Link
								to={`/comment/${comment.id}` as "/"}
								className="mt-2 block text-sm text-cyan-400 hover:text-cyan-300"
							>
								Continue this thread ({comment.replies.length} more replies) →
							</Link>
						)}
					</>
				)}
			</div>
		</div>
	);
}
