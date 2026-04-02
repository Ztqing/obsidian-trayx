import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const testsRoot = ".test-dist/tests";

const testFiles = collectTestFiles(testsRoot);

if (testFiles.length === 0) {
	throw new Error(`No compiled unit tests found under ${testsRoot}.`);
}

execFileSync(process.execPath, ["--test", ...testFiles], {
	stdio: "inherit",
});

function collectTestFiles(directory) {
	/** @type {string[]} */
	const files = [];

	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const entryPath = join(directory, entry.name);
		if (entry.isDirectory()) {
			files.push(...collectTestFiles(entryPath));
			continue;
		}

		if (entry.isFile() && entry.name.endsWith(".test.js")) {
			files.push(entryPath);
		}
	}

	return files.sort();
}
