import type { AwardCount } from "@/lib/awards.server";
import { AWARD_OPTIONS } from "@/lib/constants";

export function AwardChips({ awards }: { awards?: AwardCount[] }) {
	if (!awards || awards.length === 0) {
		return null;
	}

	return (
		<>
			{awards.map((award) => {
				const option = AWARD_OPTIONS.find((o) => o.kind === award.kind);
				const title = option?.title ?? award.kind;
				return (
					<span
						key={award.kind}
						title={award.count > 1 ? `${title} x${award.count}` : title}
						className="inline-flex items-center gap-0.5 rounded bg-amber-500/10 px-1.5 py-0.5 font-medium text-amber-300"
					>
						<span aria-hidden="true">{option?.icon ?? "🏅"}</span>
						<span className="sr-only">{title} award</span>
						{award.count > 1 && <span>{award.count}</span>}
					</span>
				);
			})}
		</>
	);
}
