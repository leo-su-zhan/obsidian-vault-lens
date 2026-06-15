import * as esbuild from "esbuild";

const prod = process.argv[2] === "production";

const outfile = process.env.OUTFILE || "main.js";

const context = await esbuild.context({
	entryPoints: ["src/main.ts"],
	bundle: true,
	external: ["obsidian", "electron"],
	format: "cjs",
	target: "es2018",
	logLevel: "info",
	sourcemap: prod ? false : "inline",
	treeShaking: true,
	outfile,
});

if (prod) {
	await context.rebuild();
	process.exit(0);
} else {
	await context.watch();
}
