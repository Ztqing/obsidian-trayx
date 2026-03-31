import type { TrayXSettings } from "./settings";

export const COMMAND_ORDER = [
	"toggleVaultVisibility",
	"showVault",
	"hideVault",
	"relaunchApp",
	"closeVault",
	"showRuntimeDiagnostics",
] as const;

export type CommandKey = (typeof COMMAND_ORDER)[number];

export const COMMAND_IDS: Record<CommandKey, string> = {
	closeVault: "close-vault",
	hideVault: "hide-vault",
	relaunchApp: "relaunch-obsidian",
	showRuntimeDiagnostics: "show-runtime-diagnostics",
	showVault: "show-vault",
	toggleVaultVisibility: "toggle-vault-visibility",
};

export const TRAY_MENU_ORDER = [
	"showVault",
	"hideVault",
	"relaunchApp",
	"closeVault",
] as const;

export type TrayMenuKey = (typeof TRAY_MENU_ORDER)[number];

export const SETTING_ORDER = [
	"enableTrayIcon",
	"runInBackground",
	"hideOnLaunch",
	"launchOnStartup",
	"hideAppIcon",
] as const satisfies readonly (keyof TrayXSettings)[];
