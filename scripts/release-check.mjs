import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

const requiredAssets = [
	"main.js",
	"manifest.json",
	"styles.css",
];

const missingAssets = requiredAssets.filter((assetPath) => !existsSync(assetPath));
if (missingAssets.length > 0) {
	throw new Error(`Missing release assets: ${missingAssets.join(", ")}`);
}

try {
	execFileSync("git", ["ls-files", "--error-unmatch", "main.js"], {
		stdio: "ignore",
	});
	throw new Error("main.js must remain untracked in Git.");
} catch (error) {
	const message = error instanceof Error ? error.message : String(error);
	if (message === "main.js must remain untracked in Git.") {
		throw error;
	}
}
