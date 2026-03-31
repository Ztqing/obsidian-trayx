import { getCurrentLocale, getLocalizedStrings, type SupportedLocale } from "./i18n";
import type TrayXPlugin from "./main";
import { COMMAND_IDS, COMMAND_ORDER, type CommandKey } from "./ui-metadata";

interface CommandDefinition {
	handler: CommandKey;
	id: string;
	name: string;
}

export function getCommandDefinitions(
	locale: SupportedLocale = getCurrentLocale(),
): CommandDefinition[] {
	const commands = getLocalizedStrings(locale).commands;

	return COMMAND_ORDER.map((handler) => ({
		handler,
		id: COMMAND_IDS[handler],
		name: commands[handler],
	}));
}

export function registerCommands(plugin: TrayXPlugin): void {
	const handlers: Record<CommandKey, () => void> = {
		closeVault: () => plugin.closeVault(),
		hideVault: () => plugin.hideVault(),
		relaunchApp: () => plugin.relaunchApp(),
		showRuntimeDiagnostics: () => plugin.showRuntimeDiagnostics(),
		showVault: () => plugin.showVault(),
		toggleVaultVisibility: () => plugin.toggleVaultVisibility(),
	};

	for (const command of getCommandDefinitions()) {
		plugin.addCommand({
			callback: handlers[command.handler],
			id: command.id,
			name: command.name,
		});
	}
}
