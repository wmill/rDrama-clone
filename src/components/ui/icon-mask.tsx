import { cn } from "@/lib/utils";

type IconMaskProps = {
	src: string;
	className?: string;
	colorClassName?: string;
	title?: string;
	ariaHidden?: boolean;
};

export function IconMask({
	src,
	className,
	colorClassName,
	title,
	ariaHidden = true,
}: IconMaskProps) {
	return (
		<span
			className={cn("inline-block", colorClassName, className)}
			style={{
				maskImage: `url("${src}")`,
				WebkitMaskImage: `url("${src}")`,
				maskRepeat: "no-repeat",
				WebkitMaskRepeat: "no-repeat",
				maskSize: "100% 100%",
				WebkitMaskSize: "100% 100%",
			}}
			aria-hidden={ariaHidden}
			title={title}
		/>
	);
}
