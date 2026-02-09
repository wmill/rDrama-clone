import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

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
	const [previewHtml, setPreviewHtml] = useState("");
	const mdRef = useRef<{ render: (src: string) => string } | null>(null);

	const config = modeConfig[mode];

	// Lazily load markdown-it on the client
	useEffect(() => {
		let cancelled = false;
		import("markdown-it").then((mod) => {
			if (cancelled) return;
			const MarkdownIt = mod.default;
			mdRef.current = new MarkdownIt({ html: false, linkify: true });
		});
		return () => {
			cancelled = true;
		};
	}, []);

	// Re-render preview whenever text changes while preview is visible
	useEffect(() => {
		if (mdRef.current) {
			setPreviewHtml(mdRef.current.render(text));
		}
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
			{/* Write / Preview tabs */}

						
				<Textarea
					value={text}
					onChange={(e) => setText(e.target.value)}
					placeholder={config.placeholder}
					className={`${config.minHeight} border-slate-700 bg-slate-800 text-white placeholder:text-slate-500`}
				/>
				<div
					className={`p-3`}
				>
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
