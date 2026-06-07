import { defineConfig } from "tsup";

export default defineConfig([
	{
		entry: ["src/oridomi.ts", "src/react.ts", "src/vue.ts", "src/svelte.ts", "src/solid.ts"],
		format: ["esm"],
		dts: true,
		external: ["react", "react-dom", "vue", "svelte", "svelte/action", "solid-js"],
		sourcemap: true,
		clean: true,
		outDir: "dist",
	},
	{
		entry: ["src/oridomi.ts"],
		format: ["iife"],
		globalName: "OriDomiModule",
		sourcemap: true,
		minify: true,
		outDir: "dist",
		outExtension: () => ({ js: ".iife.js" }),
		footer: {
			js: "window.OriDomi = OriDomiModule.default;",
		},
	},
]);
