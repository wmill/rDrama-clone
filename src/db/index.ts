import { config } from "dotenv";
import { resolve } from "node:path";

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema.ts";

// Load .env.local first, then .env (dotenv won't overwrite existing values)
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

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

export const db = drizzle(pool, { schema });
