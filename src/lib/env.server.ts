import { config } from "dotenv";

// Vite/Nitro load these files for application builds. Explicit loading keeps
// standalone operational scripts consistent without importing Node path/fs,
// which can otherwise leak through server-function modules into client builds.
config({ path: ".env.local" });
config({ path: ".env" });
