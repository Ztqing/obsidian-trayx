import type { TrayXSettings } from "./settings";
import { SETTING_ORDER, type CommandKey, type TrayMenuKey } from "./ui-metadata";

export type SupportedLocale = "en" | "zh";

export type RuntimeFailureReasonKey =
	| "desktop-only"
	| "electron-load-failed"
	| "remote-package-unavailable"
	| "no-usable-main-process-bridge"
	| "named-bridge-unavailable"
	| "bridge-disabled"
	| "bridge-missing-capabilities"
	| "using-bridge";

export interface RuntimeFailureReasonDescriptor {
	bridgeKind?: string;
	key: RuntimeFailureReasonKey;
	missingCapabilities?: readonly string[];
}

export interface SettingDefinition<Key extends keyof TrayXSettings = keyof TrayXSettings> {
	description: string;
	key: Key;
	name: string;
}

interface LocalizedStrings {
	commands: Record<CommandKey, string>;
	diagnostics: {
		bridge: string;
		closeIntercept: string;
		fullscreen: string;
		fullscreenClosePending: string;
		missing: string;
		mode: string;
		nonOwnerWindow: string;
		notReady: string;
		obsidian: string;
		off: string;
		on: string;
		platform: string;
		ready: string;
		restore: string;
		sources: string;
		tray: string;
		trayBounds: string;
		trayBridgeReady: string;
		trayIcon: string;
		trayIconEmpty: string;
		trayIconExists: string;
		trayIconTemplate: string;
		trayOwner: string;
		trayPath: string;
		unloadVeto: string;
		window: string;
	};
	notices: {
		trayCreationFailed: string;
	};
	runtime: {
		bridgeDisabled(bridgeKind: string, missingCapabilities: string): string;
		bridgeMissingCapabilities(bridgeKind: string, missingCapabilities: string): string;
		desktopOnly: string;
		electronLoadFailed: string;
		namedBridgeUnavailable(bridgeKind: string): string;
		noUsableMainProcessBridge: string;
		remotePackageUnavailable: string;
		usingBridge(bridgeKind: string): string;
	};
	settings: {
		enableTrayIconDescription: string;
		enableTrayIconName: string;
		hideAppIconMacDescription: string;
		hideAppIconName: string;
		hideAppIconOtherDescription: string;
		hideOnLaunchDescription: string;
		hideOnLaunchName: string;
		launchOnStartupDescription: string;
		launchOnStartupName: string;
		runInBackgroundDescription: string;
		runInBackgroundName: string;
	};
	trayMenu: Record<TrayMenuKey, string>;
}

type SettingNameKey =
	| "enableTrayIconName"
	| "runInBackgroundName"
	| "hideOnLaunchName"
	| "launchOnStartupName"
	| "hideAppIconName";

type SettingDescriptionKey =
	| "enableTrayIconDescription"
	| "runInBackgroundDescription"
	| "hideOnLaunchDescription"
	| "launchOnStartupDescription"
	| "hideAppIconMacDescription"
	| "hideAppIconOtherDescription";

const SETTING_TEXT_KEYS: Record<
	keyof TrayXSettings,
	{
		description:
			| SettingDescriptionKey
			| { isMacOS: SettingDescriptionKey; other: SettingDescriptionKey };
		name: SettingNameKey;
	}
> = {
	enableTrayIcon: {
		description: "enableTrayIconDescription",
		name: "enableTrayIconName",
	},
	hideAppIcon: {
		description: {
			isMacOS: "hideAppIconMacDescription",
			other: "hideAppIconOtherDescription",
		},
		name: "hideAppIconName",
	},
	hideOnLaunch: {
		description: "hideOnLaunchDescription",
		name: "hideOnLaunchName",
	},
	launchOnStartup: {
		description: "launchOnStartupDescription",
		name: "launchOnStartupName",
	},
	runInBackground: {
		description: "runInBackgroundDescription",
		name: "runInBackgroundName",
	},
};

const STRINGS = {
	en: {
		commands: {
			closeVault: "Close vault",
			hideVault: "Hide vault",
			relaunchApp: "Relaunch app",
			showRuntimeDiagnostics: "Show runtime diagnostics",
			showVault: "Show vault",
			toggleVaultVisibility: "Toggle vault visibility",
		},
		diagnostics: {
			bridge: "Bridge",
			closeIntercept: "Close intercept",
			fullscreen: "Fullscreen",
			fullscreenClosePending: "Fullscreen close pending",
			missing: "Missing",
			mode: "Mode",
			nonOwnerWindow: "Non-owner window",
			notReady: "not ready",
			obsidian: "Obsidian",
			off: "off",
			on: "on",
			platform: "Platform",
			ready: "ready",
			restore: "Restore",
			sources: "Sources",
			tray: "Tray",
			trayBounds: "Tray bounds",
			trayBridgeReady: "Tray bridge is ready.",
			trayIcon: "Tray icon",
			trayIconEmpty: "Tray icon empty",
			trayIconExists: "Tray icon exists",
			trayIconTemplate: "Tray icon template",
			trayOwner: "Tray owner",
			trayPath: "Tray path",
			unloadVeto: "Unload veto",
			window: "Window",
		},
		notices: {
			trayCreationFailed: "Could not create the tray icon in this desktop build.",
		},
		runtime: {
			bridgeDisabled: (bridgeKind: string, missingCapabilities: string) =>
				`TrayX found ${bridgeKind}, but it is disabled for this plugin WebContents. Missing capabilities: ${missingCapabilities}.`,
			bridgeMissingCapabilities: (bridgeKind: string, missingCapabilities: string) =>
				`TrayX found ${bridgeKind}, but it is missing required capabilities: ${missingCapabilities}.`,
			desktopOnly: "TrayX is only available in the desktop app.",
			electronLoadFailed: "TrayX could not load Electron in this build of the app.",
			namedBridgeUnavailable: (bridgeKind: string) =>
				`TrayX could not find a usable ${bridgeKind} bridge in this desktop build.`,
			noUsableMainProcessBridge:
				"TrayX could not find a usable main-process Electron bridge in this desktop build.",
			remotePackageUnavailable:
				"TrayX could not find a usable main-process Electron bridge. `@electron/remote` is not available in this build.",
			usingBridge: (bridgeKind: string) => `TrayX is using ${bridgeKind}.`,
		},
		settings: {
			enableTrayIconDescription: "Show a system tray or menu bar icon for this vault.",
			enableTrayIconName: "Enable tray icon",
			hideAppIconMacDescription:
				"Hide the app from the dock while TrayX is active. This affects the whole app, not just this vault.",
			hideAppIconName: "Hide app icon",
			hideAppIconOtherDescription:
				"Hide the window from the taskbar while TrayX is active. Keep the tray icon enabled if you turn this on.",
			hideOnLaunchDescription:
				"Hide or minimize the window after startup, based on the current background behavior.",
			hideOnLaunchName: "Hide on launch",
			launchOnStartupDescription: "Open the app automatically when you sign in on this device.",
			launchOnStartupName: "Launch on startup",
			runInBackgroundDescription:
				"Hide the window instead of closing it when you close the app window.",
			runInBackgroundName: "Run in background",
		},
		trayMenu: {
			closeVault: "Close vault",
			hideVault: "Hide vault",
			relaunchApp: "Relaunch app",
			showVault: "Show vault",
		},
	},
	zh: {
		commands: {
			closeVault: "关闭库",
			hideVault: "隐藏库",
			relaunchApp: "重新启动应用",
			showRuntimeDiagnostics: "显示运行时诊断",
			showVault: "显示库",
			toggleVaultVisibility: "切换库可见性",
		},
		diagnostics: {
			bridge: "桥接",
			closeIntercept: "关闭拦截",
			fullscreen: "全屏",
			fullscreenClosePending: "全屏关闭待处理",
			missing: "缺失能力",
			mode: "模式",
			nonOwnerWindow: "当前窗口不是托盘所有者",
			notReady: "未就绪",
			obsidian: "Obsidian",
			off: "关",
			on: "开",
			platform: "平台",
			ready: "就绪",
			restore: "恢复路径",
			sources: "来源",
			tray: "托盘",
			trayBounds: "托盘边界",
			trayBridgeReady: "托盘桥接已就绪。",
			trayIcon: "托盘图标",
			trayIconEmpty: "托盘图标为空",
			trayIconExists: "托盘图标存在",
			trayIconTemplate: "托盘图标 template",
			trayOwner: "托盘所有者",
			trayPath: "托盘路径",
			unloadVeto: "卸载阻止",
			window: "窗口",
		},
		notices: {
			trayCreationFailed: "无法在当前桌面版中创建托盘图标。",
		},
		runtime: {
			bridgeDisabled: (bridgeKind: string, missingCapabilities: string) =>
				`TrayX 找到了 ${bridgeKind}，但它已对这个插件的 WebContents 禁用。缺失能力: ${missingCapabilities}。`,
			bridgeMissingCapabilities: (bridgeKind: string, missingCapabilities: string) =>
				`TrayX 找到了 ${bridgeKind}，但它缺少必需能力: ${missingCapabilities}。`,
			desktopOnly: "TrayX 仅在桌面版应用中可用。",
			electronLoadFailed: "TrayX 无法在当前应用构建中加载 Electron。",
			namedBridgeUnavailable: (bridgeKind: string) =>
				`TrayX 无法在当前桌面版中找到可用的 ${bridgeKind} bridge。`,
			noUsableMainProcessBridge:
				"TrayX 无法在当前桌面版中找到可用的主进程 Electron bridge。",
			remotePackageUnavailable:
				"TrayX 无法找到可用的主进程 Electron bridge。当前构建中没有 `@electron/remote`。",
			usingBridge: (bridgeKind: string) => `TrayX 正在使用 ${bridgeKind}。`,
		},
		settings: {
			enableTrayIconDescription: "为当前库显示系统托盘或菜单栏图标。",
			enableTrayIconName: "启用托盘图标",
			hideAppIconMacDescription:
				"TrayX 运行期间将应用从 Dock 中隐藏。这会影响整个应用，而不只是当前库。",
			hideAppIconName: "隐藏应用图标",
			hideAppIconOtherDescription:
				"TrayX 运行期间将窗口从任务栏中隐藏。启用此项时请保持托盘图标开启。",
			hideOnLaunchDescription: "启动后根据当前后台运行行为隐藏或最小化窗口。",
			hideOnLaunchName: "启动时隐藏",
			launchOnStartupDescription: "在此设备登录时自动打开应用。",
			launchOnStartupName: "登录时启动",
			runInBackgroundDescription: "关闭应用窗口时隐藏窗口，而不是直接关闭它。",
			runInBackgroundName: "后台运行",
		},
		trayMenu: {
			closeVault: "关闭库",
			hideVault: "隐藏库",
			relaunchApp: "重新启动应用",
			showVault: "显示库",
		},
	},
} satisfies Record<SupportedLocale, LocalizedStrings>;

export function resolveLocale(appLanguage?: string | null): SupportedLocale {
	return typeof appLanguage === "string" && appLanguage.toLowerCase().startsWith("zh")
		? "zh"
		: "en";
}

export function getCurrentLocale(
	readLanguage: () => string | undefined = readConfiguredLanguage,
): SupportedLocale {
	return resolveLocale(readLanguage());
}

export function getLocalizedStrings(locale: SupportedLocale = getCurrentLocale()): LocalizedStrings {
	return STRINGS[locale];
}

export function getSettingDefinitions(options: {
	isMacOS: boolean;
	locale?: SupportedLocale;
}): SettingDefinition[] {
	const strings = getLocalizedStrings(options.locale).settings;

	return SETTING_ORDER.map((key) => {
		const fieldKeys = SETTING_TEXT_KEYS[key];
		const description =
			typeof fieldKeys.description === "string"
				? strings[fieldKeys.description]
				: strings[options.isMacOS ? fieldKeys.description.isMacOS : fieldKeys.description.other];

		return {
			description,
			key,
			name: strings[fieldKeys.name],
		};
	});
}

export function formatRuntimeFailureReason(
	descriptor: RuntimeFailureReasonDescriptor,
	locale: SupportedLocale = getCurrentLocale(),
): string {
	const runtimeStrings = getLocalizedStrings(locale).runtime;
	const bridgeKind = descriptor.bridgeKind ?? "unknown";
	const missingCapabilities = descriptor.missingCapabilities?.join(", ") ?? "";

	switch (descriptor.key) {
		case "desktop-only":
			return runtimeStrings.desktopOnly;
		case "electron-load-failed":
			return runtimeStrings.electronLoadFailed;
		case "remote-package-unavailable":
			return runtimeStrings.remotePackageUnavailable;
		case "no-usable-main-process-bridge":
			return runtimeStrings.noUsableMainProcessBridge;
		case "named-bridge-unavailable":
			return runtimeStrings.namedBridgeUnavailable(bridgeKind);
		case "bridge-disabled":
			return runtimeStrings.bridgeDisabled(bridgeKind, missingCapabilities);
		case "bridge-missing-capabilities":
			return runtimeStrings.bridgeMissingCapabilities(bridgeKind, missingCapabilities);
		case "using-bridge":
			return runtimeStrings.usingBridge(bridgeKind);
	}
}

export function getRuntimeFailureReason(
	diagnostics: {
		failureReason: string;
		failureReasonDescriptor?: RuntimeFailureReasonDescriptor;
	},
	locale: SupportedLocale = getCurrentLocale(),
): string {
	return diagnostics.failureReasonDescriptor
		? formatRuntimeFailureReason(diagnostics.failureReasonDescriptor, locale)
		: diagnostics.failureReason;
}

export function getTrayCreationFailureNotice(
	locale: SupportedLocale = getCurrentLocale(),
): string {
	return getLocalizedStrings(locale).notices.trayCreationFailed;
}

function readConfiguredLanguage(): string | undefined {
	try {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const obsidian = require("obsidian") as {
			getLanguage?: () => string;
		};
		return typeof obsidian.getLanguage === "function" ? obsidian.getLanguage() : undefined;
	} catch {
		return undefined;
	}
}
