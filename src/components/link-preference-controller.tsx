import { useEffect } from "react";

import { getPreferredLinkTarget } from "@/lib/content-preferences";

export function LinkPreferenceController({
	newTab,
	newTabExternal,
}: {
	newTab: boolean;
	newTabExternal: boolean;
}) {
	useEffect(() => {
		const apply = (root: ParentNode) => {
			for (const anchor of root.querySelectorAll<HTMLAnchorElement>(
				"a[href]",
			)) {
				const href = anchor.getAttribute("href");
				if (!href || href.startsWith("#")) continue;
				const target = getPreferredLinkTarget(
					anchor.href,
					window.location.origin,
					{ newTab, newTabExternal },
				);
				if (target) {
					anchor.target = "_blank";
					anchor.rel = "noopener noreferrer";
				} else {
					anchor.removeAttribute("target");
					anchor.removeAttribute("rel");
				}
			}
		};

		apply(document);
		const observer = new MutationObserver(() => apply(document));
		observer.observe(document.body, { childList: true, subtree: true });
		return () => observer.disconnect();
	}, [newTab, newTabExternal]);
	return null;
}
