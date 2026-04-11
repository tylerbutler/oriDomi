import { defineConfig } from "tsup";

export default defineConfig([
	{
		entry: ["src/oridomi.ts"],
		format: ["esm"],
		dts: true,
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
