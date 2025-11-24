import { config } from "dotenv"

import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import * as schema from "./schema.ts"

config()

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
	throw new Error("DATABASE_URL is not set")
}

const pool = new Pool({
	connectionString: databaseUrl,
})

export const db = drizzle(pool, { schema })
