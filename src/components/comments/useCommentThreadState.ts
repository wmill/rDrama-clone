import {
	type Dispatch,
	type SetStateAction,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { getCommentsSinceFn } from "@/lib/comment-actions.server";
import { buildCommentTree } from "@/lib/comment-tree";
import type {
	CommentFlat,
	CommentSortType,
	CommentWithReplies,
} from "@/lib/comments.server";

const COMMENTS_PAGE_SIZE =
	Number(import.meta.env.VITE_RESULTS_PER_PAGE_COMMENTS) ?? 50;

export type CommentThreadState = {
	byId: Record<number, CommentFlat>;
	allIds: number[];
	commentCount: number;
	lastFetchedAt: number;
};

export type UseCommentThreadStateOptions = {
	submissionId: number;
	comments: CommentFlat[];
	commentCount: number;
	commentsLastFetchedAt: number;
	initialSort?: CommentSortType;
	onCommentCountChange?: (count: number) => void;
};

export function buildInitialCommentState(
	comments: CommentFlat[],
	commentCount: number,
	lastFetchedAt: number,
): CommentThreadState {
	const byId: Record<number, CommentFlat> = {};
	const allIds: number[] = [];

	for (const comment of comments) {
		byId[comment.id] = comment;
		allIds.push(comment.id);
	}

	return { byId, allIds, commentCount, lastFetchedAt };
}

export function mergeCommentState(
	state: CommentThreadState,
	newComments: CommentFlat[],
	fetchedAt: number,
): { nextState: CommentThreadState; newCount: number } {
	let newCount = 0;
	const byId = { ...state.byId };
	const allIds = state.allIds.slice();

	for (const comment of newComments) {
		if (!byId[comment.id]) {
			newCount += 1;
			allIds.push(comment.id);
		}
		byId[comment.id] = comment;
	}

	return {
		nextState: {
			byId,
			allIds,
			commentCount: state.commentCount + newCount,
			lastFetchedAt: Math.max(state.lastFetchedAt, fetchedAt),
		},
		newCount,
	};
}

export type UseCommentThreadStateResult = {
	sort: CommentSortType;
	visibleLimit: number;
	isSyncing: boolean;
	rootRenderedCount: number;
	flatComments: CommentFlat[];
	commentTree: CommentWithReplies[];
	localCommentCount: number;
	handleReplyAdded: (comment?: CommentFlat) => void;
	handleSortChange: (nextSort: CommentSortType) => Promise<void>;
	setVisibleLimit: Dispatch<SetStateAction<number>>;
	setRootRenderedCount: Dispatch<SetStateAction<number>>;
};

export function useCommentThreadState({
	submissionId,
	comments,
	commentCount,
	commentsLastFetchedAt,
	initialSort = "top",
	onCommentCountChange,
}: UseCommentThreadStateOptions): UseCommentThreadStateResult {
	const [sort, setSort] = useState<CommentSortType>(initialSort);
	const [visibleLimit, setVisibleLimit] = useState(COMMENTS_PAGE_SIZE);
	const [isSyncing, setIsSyncing] = useState(false);
	const [commentState, setCommentState] = useState<CommentThreadState>(() =>
		buildInitialCommentState(comments, commentCount, commentsLastFetchedAt),
	);
	const [rootRenderedCount, setRootRenderedCount] = useState(0);
	const commentStateRef = useRef(commentState);

	useEffect(() => {
		commentStateRef.current = commentState;
	}, [commentState]);

	const flatComments = useMemo(
		() =>
			commentState.allIds.map((id) => commentState.byId[id]).filter(Boolean),
		[commentState],
	);

	const commentTree = useMemo(
		() => buildCommentTree(flatComments, sort),
		[flatComments, sort],
	);

	const handleMerge = useCallback(
		(newComments: CommentFlat[], fetchedAt: number) => {
			const { nextState, newCount } = mergeCommentState(
				commentStateRef.current,
				newComments,
				fetchedAt,
			);

			commentStateRef.current = nextState;
			setCommentState(nextState);
			onCommentCountChange?.(nextState.commentCount);

			if (newCount > 0) {
				setVisibleLimit((prev) => prev + newCount);
			}
		},
		[onCommentCountChange],
	);

	const handleReplyAdded = useCallback(
		(comment?: CommentFlat) => {
			if (!comment) return;
			handleMerge([comment], comment.createdUtc);
		},
		[handleMerge],
	);

	const handleSortChange = useCallback(
		async (nextSort: CommentSortType) => {
			setSort(nextSort);
			setRootRenderedCount(0);
			setIsSyncing(true);

			try {
				const result = await getCommentsSinceFn({
					data: { submissionId, since: commentStateRef.current.lastFetchedAt },
				});

				if (result.success) {
					handleMerge(result.comments, result.lastFetchedAt);
				}
			} finally {
				setIsSyncing(false);
			}
		},
		[handleMerge, submissionId],
	);

	return {
		sort,
		visibleLimit,
		isSyncing,
		rootRenderedCount,
		flatComments,
		commentTree,
		localCommentCount: commentState.commentCount,
		handleReplyAdded,
		handleSortChange,
		setVisibleLimit,
		setRootRenderedCount,
	};
}
