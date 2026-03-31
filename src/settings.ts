export interface TrayXSettings {
	enableTrayIcon: boolean;
	runInBackground: boolean;
	hideOnLaunch: boolean;
	launchOnStartup: boolean;
	hideAppIcon: boolean;
}

export const DEFAULT_SETTINGS: TrayXSettings = {
	enableTrayIcon: true,
	runInBackground: true,
	hideOnLaunch: false,
	launchOnStartup: false,
	hideAppIcon: false,
};

export function loadTrayXSettings(data: unknown): TrayXSettings {
	const stored = isRecord(data) ? data : {};

	return {
		enableTrayIcon: readBoolean(stored.enableTrayIcon, DEFAULT_SETTINGS.enableTrayIcon),
		runInBackground: readBoolean(stored.runInBackground, DEFAULT_SETTINGS.runInBackground),
		hideOnLaunch: readBoolean(stored.hideOnLaunch, DEFAULT_SETTINGS.hideOnLaunch),
		launchOnStartup: readBoolean(stored.launchOnStartup, DEFAULT_SETTINGS.launchOnStartup),
		hideAppIcon: readBoolean(stored.hideAppIcon, DEFAULT_SETTINGS.hideAppIcon),
	};
}

function readBoolean(value: unknown, defaultValue: boolean): boolean {
	return typeof value === "boolean" ? value : defaultValue;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
