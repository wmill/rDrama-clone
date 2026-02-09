import { Link } from "@tanstack/react-router";
import {
	ChevronDown,
	ChevronUp,
	Clock,
	MessageSquare,
	Pencil,
	Reply,
	Trash2,
} from "lucide-react";
import { memo, useMemo, useState } from "react";

import {
	createCommentFn,
	deleteCommentFn,
	updateCommentFn,
} from "@/lib/comment-actions.server";
import type { CommentWithReplies } from "@/lib/comments.server";
import { CommentForm } from "./CommentForm";
import { VoteButtons } from "./VoteButtons";

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
	depth?: number;
	maxDepth?: number;
	onReplyAdded?: () => void;
};

export const Comment = memo(function Comment({
	comment,
	submissionId,
	currentUserId,
	depth = 0,
	maxDepth = 10,
	onReplyAdded,
}: CommentProps) {
	const [isCollapsed, setIsCollapsed] = useState(false);
	const [showReplyForm, setShowReplyForm] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const [isDeleted, setIsDeleted] = useState(comment.isDeleted);
	const [currentBody, setCurrentBody] = useState(comment.bodyHtml);

	const isAuthor = currentUserId === comment.authorId;
	const userVote = comment.userVote;

	const handleDelete = async () => {
		if (!confirm("Are you sure you want to delete this comment?")) return;

		const result = await deleteCommentFn({ data: { id: comment.id } });
		if (result.success) {
			setIsDeleted(true);
			setCurrentBody("[deleted]");
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
									<CommentForm
										mode="edit"
										initialText={comment.body ?? ""}
										onSubmit={async (text) => {
											const result = await updateCommentFn({
												data: { id: comment.id, body: text },
											});
											if (result.success) {
												setCurrentBody(text);
												setIsEditing(false);
											}
											return result;
										}}
										onCancel={() => setIsEditing(false)}
									/>
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
									<div className="mt-3">
										<CommentForm
											mode="reply"
											onSubmit={async (text) => {
												const result = await createCommentFn({
													data: {
														body: text,
														parentSubmissionId: submissionId,
														parentCommentId: comment.id,
													},
												});
												if (result.success) onReplyAdded?.();
												return result;
											}}
											onCancel={() => setShowReplyForm(false)}
										/>
									</div>
								)}
							</div>
						</div>

						{/* Replies */}
						{comment.replies.length > 0 && depth < maxDepth && (
							<div className="mt-2">
								{comment.replies.map((reply) => (
									<Comment
										key={reply.id}
										comment={reply}
										submissionId={submissionId}
										currentUserId={currentUserId}
										depth={depth + 1}
										maxDepth={maxDepth}
										onReplyAdded={onReplyAdded}
									/>
								))}
							</div>
						)}

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
});
