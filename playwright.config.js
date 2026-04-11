import { defineConfig } from "@playwright/test";

export default defineConfig({
	testDir: "./tests",
	testMatch: "*.spec.js",
	timeout: 30_000,
	use: {
		baseURL: "http://localhost:3000",
		viewport: { width: 800, height: 600 },
	},
	projects: [{ name: "chromium", use: { browserName: "chromium" } }],
	webServer: {
		command: "npx serve -l 3000 -n",
		port: 3000,
		reuseExistingServer: true,
	},
});
