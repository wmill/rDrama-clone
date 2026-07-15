import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { renderCommentMarkdown } from "@/lib/markdown";

type CommentFormProps = {
	mode: "new" | "reply" | "edit";
	onSubmit: (text: string) => Promise<{ success: boolean; error?: string }>;
	onCancel?: () => void;
	initialText?: string;
};

const modeConfig = {
	new: {
		placeholder: "What are your thoughts?",
		submitLabel: "Post Comment",
		showCancel: false,
		minHeight: "min-h-[100px]",
		buttonSize: "default" as const,
	},
	reply: {
		placeholder: "Write a reply...",
		submitLabel: "Reply",
		showCancel: true,
		minHeight: "min-h-[80px]",
		buttonSize: "sm" as const,
	},
	edit: {
		placeholder: "",
		submitLabel: "Save",
		showCancel: true,
		minHeight: "min-h-[100px]",
		buttonSize: "sm" as const,
	},
};

export function CommentForm({
	mode,
	onSubmit,
	onCancel,
	initialText = "",
}: CommentFormProps) {
	const [text, setText] = useState(initialText);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const config = modeConfig[mode];
	const previewHtml = useMemo(() => {
		return renderCommentMarkdown(text);
	}, [text]);

	const handleSubmit = async () => {
		if (!text.trim() || isSubmitting) return;

		setError(null);
		setIsSubmitting(true);

		try {
			const result = await onSubmit(text);
			if (result.success) {
				if (mode !== "edit") {
					setText("");
				}
			} else {
				setError(result.error ?? "Something went wrong");
			}
		} catch {
			setError("Something went wrong");
		} finally {
			setIsSubmitting(false);
		}
	};

	const submittingLabel =
		mode === "edit"
			? "Saving..."
			: mode === "reply"
				? "Posting..."
				: "Posting...";

	return (
		<div className="space-y-2">
			<div className="flex justify-end">
				<Link
					to="/formatting"
					className="text-xs text-cyan-400 hover:text-cyan-300 hover:underline"
				>
					Formatting help
				</Link>
			</div>

			<Textarea
				value={text}
				onChange={(e) => setText(e.target.value)}
				placeholder={config.placeholder}
				className={`${config.minHeight} border-slate-700 bg-slate-800 text-white placeholder:text-slate-500`}
			/>
			<div className={`p-3`}>
				{text.trim() ? (
					<div
						className="prose prose-invert prose-sm max-w-none text-slate-300"
						// biome-ignore lint/security/noDangerouslySetInnerHtml: Rendered from markdown-it with html:false
						dangerouslySetInnerHTML={{ __html: previewHtml }}
					/>
				) : (
					<p className="text-sm text-slate-500 italic">Nothing to preview</p>
				)}
			</div>

			{error && <p className="text-sm text-red-400">{error}</p>}

			<div className="flex gap-2">
				<Button
					size={config.buttonSize}
					onClick={handleSubmit}
					disabled={isSubmitting || !text.trim()}
				>
					{isSubmitting ? submittingLabel : config.submitLabel}
				</Button>
				{config.showCancel && onCancel && (
					<Button size={config.buttonSize} variant="outline" onClick={onCancel}>
						Cancel
					</Button>
				)}
			</div>
		</div>
	);
}
