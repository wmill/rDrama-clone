import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";

const cwd = process.cwd();
const envLocalPath = resolve(cwd, ".env.local");
const envPath = resolve(cwd, ".env");

if (existsSync(envLocalPath)) {
	config({ path: envLocalPath });
}

if (existsSync(envPath)) {
	config({ path: envPath });
}
