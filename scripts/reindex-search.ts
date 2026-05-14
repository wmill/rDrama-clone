import "@/lib/env.server";

import { reindexPublicSearch } from "@/lib/search.server";

async function main() {
	const indexed = await reindexPublicSearch();

	if (!indexed) {
		console.error("Search reindex skipped: ELASTICSEARCH_URL is not configured.");
		process.exitCode = 1;
		return;
	}

	console.log("Search reindex completed.");
}

main().catch((error) => {
	console.error("Search reindex failed.", error);
	process.exitCode = 1;
});
