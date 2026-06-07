import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getStyleSheet } from "../dist/oridomi.js";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
await writeFile(resolve(rootDir, "dist", "oridomi.css"), `${getStyleSheet()}\n`);
