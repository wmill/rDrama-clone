import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

import { createUser } from "../src/lib/auth.server";

const [username, email, password] = process.argv.slice(2);

if (!username || !email || !password) {
	console.error("Usage: pnpm create-user <username> <email> <password>");
	process.exit(1);
}

const result = await createUser(username, email, password);

if (!result.success) {
	console.error("Error:", result.error);
	process.exit(1);
}

console.log("Created user:", result.user.username, `(id: ${result.user.id})`);
process.exit(0);
