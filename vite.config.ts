import { defineConfig } from "vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import viteTsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

export default defineConfig({
	plugins: [
		{
			name: "server-env-client-boundary",
			enforce: "pre",
			transform(_code, id, options) {
				if (!options?.ssr && id.endsWith("/src/lib/env.server.ts")) {
					this.error(
						"src/lib/env.server.ts was included in the client module graph. Move the importing handler into a *.server.ts server-function module.",
					);
				}
			},
		},
		devtools(),
		nitro(),
		// this is the plugin that enables path aliases
		viteTsConfigPaths({
			projects: ["./tsconfig.json"],
		}),
		tailwindcss(),
		tanstackStart(),
		viteReact(),
	],
	server: {
		allowedHosts: true,
	},
	test: {
		environment: "jsdom",
		globals: true,
		setupFiles: ["./src/test/setup.ts"],
		include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
	},
});
