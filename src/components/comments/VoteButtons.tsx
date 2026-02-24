import { useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import arrowBigDownUrl from "lucide-static/icons/arrow-big-down.svg?url";
import arrowBigUpUrl from "lucide-static/icons/arrow-big-up.svg?url";
import { useState } from "react";
import { IconMask } from "@/components/ui/icon-mask";
import { getCurrentUser } from "@/lib/sessions.server";
import {
	type VoteType,
	voteOnComment,
	voteOnSubmission,
} from "@/lib/votes.server";

const voteSubmissionFn = createServerFn({ method: "POST" })
	.inputValidator((data: { submissionId: number; voteType: VoteType }) => data)
	.handler(
		async ({
			data,
		}: {
			data: { submissionId: number; voteType: VoteType };
		}) => {
			const user = await getCurrentUser();
			if (!user) {
				return {
					success: false,
					error: "Not logged in",
					newScore: 0,
					userVote: 0 as VoteType,
				};
			}
			return voteOnSubmission(user.id, data.submissionId, data.voteType);
		},
	);

const voteCommentFn = createServerFn({ method: "POST" })
	.inputValidator((data: { commentId: number; voteType: VoteType }) => data)
	.handler(
		async ({ data }: { data: { commentId: number; voteType: VoteType } }) => {
			const user = await getCurrentUser();
			if (!user) {
				return {
					success: false,
					error: "Not logged in",
					newScore: 0,
					userVote: 0 as VoteType,
				};
			}
			return voteOnComment(user.id, data.commentId, data.voteType);
		},
	);

type VoteButtonsProps = {
	type: "submission" | "comment";
	id: number;
	score: number;
	userVote?: VoteType;
	size?: "sm" | "md" | "lg";
	vertical?: boolean;
	disabled?: boolean;
};

export function VoteButtons({
	type,
	id,
	score: initialScore,
	userVote: initialUserVote = 0,
	size = "md",
	vertical = true,
	disabled = false,
}: VoteButtonsProps) {
	const router = useRouter();
	const [score, setScore] = useState(initialScore);
	const [userVote, setUserVote] = useState<VoteType>(initialUserVote);
	const [isVoting, setIsVoting] = useState(false);

	const handleVote = async (voteType: VoteType) => {
		if (disabled || isVoting) return;

		// Optimistic update
		const previousScore = score;
		const previousVote = userVote;

		// Calculate new score optimistically
		let newScore = initialScore;
		let newVote: VoteType = voteType;

		// If clicking same vote, remove it
		if (userVote === voteType) {
			newVote = 0;
		}

		// Remove old vote effect
		if (previousVote === 1) newScore -= 1;
		if (previousVote === -1) newScore += 1;

		// Add new vote effect
		if (newVote === 1) newScore += 1;
		if (newVote === -1) newScore -= 1;

		setScore(newScore);
		setUserVote(newVote);
		setIsVoting(true);

		try {
			const result =
				type === "submission"
					? await voteSubmissionFn({ data: { submissionId: id, voteType } })
					: await voteCommentFn({ data: { commentId: id, voteType } });

			if (!result.success) {
				// Revert on error
				setScore(previousScore);
				setUserVote(previousVote);
				if (result.error === "Not logged in") {
					router.navigate({ to: "/login" });
				}
			} else {
				// Use server values
				setScore(result.newScore);
				setUserVote(result.userVote);
			}
		} catch {
			// Revert on error
			setScore(previousScore);
			setUserVote(previousVote);
		} finally {
			setIsVoting(false);
		}
	};

	const sizeClasses = {
		sm: {
			button: "p-0.5",
			icon: "h-4 w-4",
			score: "text-xs min-w-[1.5rem]",
		},
		md: {
			button: "p-1",
			icon: "h-5 w-5",
			score: "text-sm min-w-[2rem]",
		},
		lg: {
			button: "p-1.5",
			icon: "h-6 w-6",
			score: "text-base min-w-[2.5rem]",
		},
	};

	const classes = sizeClasses[size];

	return (
		<div
			className={`flex items-center gap-0.5 ${vertical ? "flex-col" : "flex-row"}`}
		>
			<button
				type="button"
				onClick={() => handleVote(1)}
				disabled={disabled || isVoting}
				className={`group rounded ${classes.button} transition-colors ${
					userVote === 1
						? "text-orange-500 bg-orange-500/10"
						: "text-slate-400 hover:bg-slate-800 hover:text-orange-500"
				} disabled:opacity-50 disabled:cursor-not-allowed`}
				aria-label="Upvote"
			>
				<IconMask
					src={arrowBigUpUrl}
					className={classes.icon}
					colorClassName={
						userVote === 1 ? "bg-orange-500" : "bg-slate-400 group-hover:bg-orange-500"
					}
				/>
			</button>

			<span
				className={`${classes.score} text-center font-semibold ${
					score > 0
						? "text-orange-500"
						: score < 0
							? "text-blue-500"
							: "text-slate-400"
				}`}
			>
				{score}
			</span>

			<button
				type="button"
				onClick={() => handleVote(-1)}
				disabled={disabled || isVoting}
				className={`group rounded ${classes.button} transition-colors ${
					userVote === -1
						? "text-blue-500 bg-blue-500/10"
						: "text-slate-400 hover:bg-slate-800 hover:text-blue-500"
				} disabled:opacity-50 disabled:cursor-not-allowed`}
				aria-label="Downvote"
			>
				<IconMask
					src={arrowBigDownUrl}
					className={classes.icon}
					colorClassName={
						userVote === -1 ? "bg-blue-500" : "bg-slate-400 group-hover:bg-blue-500"
					}
				/>
			</button>
		</div>
	);
}
