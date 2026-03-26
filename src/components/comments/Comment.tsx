import { Link } from "@tanstack/react-router";
import chevronDownUrl from "lucide-static/icons/chevron-down.svg?url";
import chevronUpUrl from "lucide-static/icons/chevron-up.svg?url";
import clockUrl from "lucide-static/icons/clock.svg?url";
import messageSquareUrl from "lucide-static/icons/message-square.svg?url";
import pencilUrl from "lucide-static/icons/pencil.svg?url";
import replyUrl from "lucide-static/icons/reply.svg?url";
import trash2Url from "lucide-static/icons/trash-2.svg?url";
import { memo, useMemo, useState } from "react";
import { IconMask } from "@/components/ui/icon-mask";
import { distinguishCommentFn } from "@/lib/admin-actions.server";
import {
	createCommentFn,
	deleteCommentFn,
	updateCommentFn,
} from "@/lib/comment-actions.server";
import type { CommentFlat, CommentWithReplies } from "@/lib/comments.server";
import { reportCommentFn } from "@/lib/reporting-actions.server";
import { formatRelativeTime } from "@/lib/utils";
import { useModalsStore } from "@/stores/modals";
import { CommentForm } from "./CommentForm";
import { VoteButtons } from "./VoteButtons";

type CommentProps = {
	comment: CommentWithReplies;
	submissionId: number;
	currentUserId?: number;
	currentUserAdminLevel?: number;
	depth?: number;
	maxDepth?: number;
	onReplyAdded?: (comment?: CommentFlat) => void;
};

export const Comment = memo(function Comment({
	comment,
	submissionId,
	currentUserId,
	currentUserAdminLevel = 0,
	depth = 0,
	maxDepth = 10,
	onReplyAdded,
}: CommentProps) {
	const [isCollapsed, setIsCollapsed] = useState(false);
	const [showReplyForm, setShowReplyForm] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const [isDeleted, setIsDeleted] = useState(comment.isDeleted);
	const [currentBody, setCurrentBody] = useState(comment.bodyHtml);
	const [reportMessage, setReportMessage] = useState<string | null>(null);
	const [isReporting, setIsReporting] = useState(false);
	const [distinguishLevel, setDistinguishLevel] = useState(
		comment.distinguishLevel,
	);
	const [isDistinguishing, setIsDistinguishing] = useState(false);
	const isModHidden = comment.isModHidden;
	const isContentHidden = isDeleted || isModHidden;

	const openReportModal = useModalsStore((s) => s.openReportModal);
	const isAuthor = currentUserId === comment.authorId;
	const userVote = comment.userVote;

	const canDistinguish =
		currentUserAdminLevel >= 2 || (currentUserAdminLevel >= 1 && isAuthor);

	const handleDelete = async () => {
		if (!confirm("Are you sure you want to delete this comment?")) return;

		const result = await deleteCommentFn({ data: { id: comment.id } });
		if (result.success) {
			setIsDeleted(true);
			setCurrentBody("[deleted]");
		}
	};

	const handleReport = async () => {
		let reason: string;
		try {
			reason = await openReportModal();
		} catch {
			return;
		}

		setReportMessage(null);
		setIsReporting(true);

		try {
			const result = await reportCommentFn({
				data: { id: comment.id, reason },
			});
			if (result.success) {
				setReportMessage(result.message);
			}
		} finally {
			setIsReporting(false);
		}
	};

	const handleDistinguish = async () => {
		setIsDistinguishing(true);
		try {
			const result = await distinguishCommentFn({ data: { id: comment.id } });
			if (result.success) {
				setDistinguishLevel(result.distinguishLevel);
			}
		} finally {
			setIsDistinguishing(false);
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
	// debugger;

	return (
		<div
			className={`${depth > 0 ? `ml-4 border-l-2 ${borderColor} pl-3` : ""}`}
		>
			<div className="py-2">
				{/* Comment header */}
				<div className="flex items-center gap-2 text-xs text-slate-400">
					<button
						type="button"
						onClick={() => setIsCollapsed(!isCollapsed)}
						className="flex items-center gap-1 hover:text-slate-300"
					>
						{isCollapsed ? (
							<IconMask
								src={chevronDownUrl}
								className="h-3 w-3"
								colorClassName="bg-current"
							/>
						) : (
							<IconMask
								src={chevronUpUrl}
								className="h-3 w-3"
								colorClassName="bg-current"
							/>
						)}
					</button>

					{isContentHidden ? (
						<span className="font-medium text-cyan-400">[deleted]</span>
					) : (
						<a
							href={`/u/${comment.authorName}`}
							className="font-medium text-cyan-400 hover:underline"
						>
							{comment.authorName}
						</a>
					)}

					{distinguishLevel > 0 && (
						<span className="rounded bg-green-500/20 px-1.5 py-0.5 text-[10px] font-medium text-green-400">
							MOD
						</span>
					)}

					<span className="flex items-center gap-1">
						<IconMask
							src={clockUrl}
							className="h-3 w-3"
							colorClassName="bg-current"
						/>
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
								{!isEditing && (
									<div className="mt-2 flex items-center gap-3 text-xs">
										{currentUserId && !isDeleted && !isModHidden && (
											<button
												type="button"
												onClick={() => setShowReplyForm(!showReplyForm)}
												className="flex items-center gap-1 text-slate-500 hover:text-cyan-400"
											>
												<IconMask
													src={replyUrl}
													className="h-3 w-3"
													colorClassName="bg-current"
												/>
												Reply
											</button>
										)}

										{currentUserId && !isDeleted && !isModHidden && (
											<button
												type="button"
												onClick={handleReport}
												disabled={isReporting}
												className="text-slate-500 hover:text-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
											>
												{isReporting ? "Reporting..." : "Report"}
											</button>
										)}

										<Link
											to={`/comment/${comment.id}` as "/"}
											className="flex items-center gap-1 text-slate-500 hover:text-cyan-400"
										>
											<IconMask
												src={messageSquareUrl}
												className="h-3 w-3"
												colorClassName="bg-current"
											/>
											Permalink
										</Link>

										{isAuthor && !isDeleted && !isModHidden && (
											<>
												<button
													type="button"
													onClick={() => setIsEditing(true)}
													className="flex items-center gap-1 text-slate-500 hover:text-cyan-400"
												>
													<IconMask
														src={pencilUrl}
														className="h-3 w-3"
														colorClassName="bg-current"
													/>
													Edit
												</button>
												<button
													type="button"
													onClick={handleDelete}
													className="flex items-center gap-1 text-slate-500 hover:text-red-400"
												>
													<IconMask
														src={trash2Url}
														className="h-3 w-3"
														colorClassName="bg-current"
													/>
													Delete
												</button>
											</>
										)}

										{canDistinguish && !isDeleted && !isModHidden && (
											<button
												type="button"
												onClick={handleDistinguish}
												disabled={isDistinguishing}
												className={`text-slate-500 hover:text-green-400 disabled:cursor-not-allowed disabled:opacity-60 ${
													distinguishLevel > 0 ? "text-green-400" : ""
												}`}
											>
												{distinguishLevel > 0 ? "Undistinguish" : "Distinguish"}
											</button>
										)}
									</div>
								)}

								{reportMessage && (
									<p className="mt-2 text-xs text-emerald-400">
										{reportMessage}
									</p>
								)}

								{/* Reply form */}
								{showReplyForm && !isModHidden && !isDeleted && (
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
												if (result.success) {
													onReplyAdded?.(result.comment ?? undefined);
												}
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
										currentUserAdminLevel={currentUserAdminLevel}
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
