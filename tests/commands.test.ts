import * as assert from "node:assert/strict";
import { test } from "node:test";

import { getCommandDefinitions, registerCommands } from "../src/commands";
import { FakeCommandPlugin } from "./helpers/fakes";

void test("getCommandDefinitions keeps command ids stable while localizing names", () => {
	assert.deepEqual(
		getCommandDefinitions("en").map((command) => ({
			id: command.id,
			name: command.name,
		})),
		[
			{ id: "toggle-vault-visibility", name: "Toggle vault visibility" },
			{ id: "show-vault", name: "Show vault" },
			{ id: "hide-vault", name: "Hide vault" },
			{ id: "relaunch-obsidian", name: "Relaunch app" },
			{ id: "close-vault", name: "Close vault" },
			{ id: "show-runtime-diagnostics", name: "Show runtime diagnostics" },
		],
	);

	assert.deepEqual(
		getCommandDefinitions("zh").map((command) => ({
			id: command.id,
			name: command.name,
		})),
		[
			{ id: "toggle-vault-visibility", name: "切换库可见性" },
			{ id: "show-vault", name: "显示库" },
			{ id: "hide-vault", name: "隐藏库" },
			{ id: "relaunch-obsidian", name: "重新启动应用" },
			{ id: "close-vault", name: "关闭库" },
			{ id: "show-runtime-diagnostics", name: "显示运行时诊断" },
		],
	);
});

void test("registerCommands wires each command callback to the matching plugin method", () => {
	const plugin = new FakeCommandPlugin();

	registerCommands(plugin as unknown as Parameters<typeof registerCommands>[0]);

	assert.deepEqual(
		plugin.commands.map((command) => command.id),
		getCommandDefinitions("en").map((command) => command.id),
	);

	for (const command of plugin.commands) {
		command.callback();
	}

	assert.deepEqual(plugin.calls, [
		"toggleVaultVisibility",
		"showVault",
		"hideVault",
		"relaunchApp",
		"closeVault",
		"showRuntimeDiagnostics",
	]);
});
