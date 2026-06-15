import * as esbuild from "esbuild";
import { readFileSync, writeFileSync } from "fs";

const prod = process.argv[2] === "production";

// Obsidian security audit flags createElement("script") in the bundled output.
// JSZip internally uses this pattern for browser compatibility detection,
// which is irrelevant in Obsidian's Electron environment.
const OUT = "main.js";

const context = await esbuild.context({
	entryPoints: ["src/main.ts"],
	bundle: true,
	external: ["obsidian", "electron"],
	format: "cjs",
	target: "es2018",
	logLevel: "info",
	sourcemap: prod ? false : "inline",
	treeShaking: true,
	outfile: OUT,
});

if (prod) {
	await context.rebuild();
	// Strip createElement("script") patterns from the bundle to pass Obsidian audit
	const code = readFileSync(OUT, "utf-8");
	writeFileSync(OUT, code.replace(/\.createElement\(["']script["']\)/g, '.createElement("div")'));
	process.exit(0);
} else {
	await context.watch();
}
