import "@/lib/env.server";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema.ts";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
	const error = new Error("DATABASE_URL is not set");
	console.error("[DB Error]", error.message);
	throw error;
}

const pool = new Pool({
	connectionString: databaseUrl,
});

// Log connection errors
pool.on("error", (err) => {
	console.error("[DB Pool Error]", err.message);
});

export const db = drizzle(pool, {
	schema,
	logger: process.env.NODE_ENV !== "production",
});
