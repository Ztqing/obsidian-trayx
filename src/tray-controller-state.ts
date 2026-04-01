import {
	buildRuntimeDiagnosticsPayload,
	type RuntimeDiagnosticsPayload,
} from "./diagnostics/runtime-diagnostics";
import {
	createEmptyBackgroundLifecycleSnapshot,
	type BackgroundLifecycleSnapshot,
	type BackgroundWindowManager,
	type CloseInterceptionOptions,
} from "./lifecycle/background-session";
import type { AppLifecycleSettings } from "./lifecycle/app-lifecycle";
import type { RuntimeDiagnostics } from "./runtime/electron";
import type { TrayXSettings } from "./settings";
import type { TrayOwnerSnapshot } from "./tray/owner";
import {
	canHideAppIconSafely,
	canRecoverFromHiddenState,
	getRestorePathAvailability,
	getRuntimeMode,
	type RestorePolicyInput,
} from "./tray/restore-policy";
import {
	createEmptyTraySnapshot,
	type TrayActions,
	type TrayRefreshOptions,
	type TraySnapshot,
} from "./tray/service";

export type RestoreBlocker =
	| "hide-app-icon-unsafe"
	| "missing-tray-restore-path"
	| "non-owner-window"
	| "runtime-unavailable"
	| "tray-refresh-failed";

export interface TrayControllerDerivedState {
	canHideAppIconSafely: boolean;
	canRecoverFromHiddenState: boolean;
	restoreBlocker: RestoreBlocker | null;
	restorePolicyInput: RestorePolicyInput;
}

export function buildTrayControllerDerivedState(options: {
	hideAppIconRequested: boolean;
	appIconHidden: boolean;
	ownerSnapshot: TrayOwnerSnapshot;
	runInBackground: boolean;
	runtimeAvailable: boolean;
	runtimePlatform: RuntimeDiagnostics["platform"];
	traySnapshot: TraySnapshot;
}): TrayControllerDerivedState {
	const restorePolicyInput = buildRestorePolicyInput({
		appIconHidden: options.appIconHidden,
		ownerSnapshot: options.ownerSnapshot,
		runInBackground: options.runInBackground,
		runtimeAvailable: options.runtimeAvailable,
		runtimePlatform: options.runtimePlatform,
		traySnapshot: options.traySnapshot,
	});

	return {
		canHideAppIconSafely: canHideAppIconSafely(restorePolicyInput),
		canRecoverFromHiddenState: canRecoverFromHiddenState(restorePolicyInput),
		restoreBlocker: buildRestoreBlocker({
			hideAppIconRequested: options.hideAppIconRequested,
			ownerSnapshot: options.ownerSnapshot,
			restorePolicyInput,
			traySnapshot: options.traySnapshot,
		}),
		restorePolicyInput,
	};
}

export function buildTrayControllerDiagnostics(options: {
	appIconHidden: boolean;
	backgroundSnapshot?: BackgroundLifecycleSnapshot;
	isFullScreen: boolean;
	ownerSnapshot: TrayOwnerSnapshot;
	restorePolicyInput: RestorePolicyInput;
	runtimeDiagnostics: RuntimeDiagnostics;
	restoreBlocker: RestoreBlocker | null;
	traySnapshot?: TraySnapshot;
}): RuntimeDiagnosticsPayload {
	const traySnapshot = options.traySnapshot ?? createEmptyTraySnapshot();
	return buildRuntimeDiagnosticsPayload({
		appIconHidden: options.appIconHidden,
		backgroundSnapshot: options.backgroundSnapshot ?? createEmptyBackgroundLifecycleSnapshot(),
		isFullScreen: options.isFullScreen,
		mode: getRuntimeMode(options.restorePolicyInput),
		ownerSnapshot: options.ownerSnapshot,
		restoreBlocker: options.restoreBlocker,
		restorePath: getRestorePathAvailability(options.restorePolicyInput),
		runtimeDiagnostics: options.runtimeDiagnostics,
		traySnapshot,
	});
}

export function buildAppLifecycleSettingsFromState(
	settings: TrayXSettings,
	state: TrayControllerDerivedState,
): AppLifecycleSettings {
	return {
		canHideAppIconSafely: state.canHideAppIconSafely,
		hideAppIcon: settings.hideAppIcon,
		hideOnLaunch: settings.hideOnLaunch,
		launchOnStartup: settings.launchOnStartup,
		runInBackground: settings.runInBackground,
	};
}

export function buildCloseInterceptionOptionsFromState(
	settings: TrayXSettings,
	state: TrayControllerDerivedState,
	windowManager: BackgroundWindowManager,
): CloseInterceptionOptions {
	return {
		canRecoverFromHiddenState: state.canRecoverFromHiddenState,
		runInBackground: settings.runInBackground,
		windowManager,
	};
}

export function buildTrayRefreshOptions(options: {
	actions: TrayActions;
	ownerSnapshot: TrayOwnerSnapshot;
	settings: TrayXSettings;
	toolTip: string;
}): TrayRefreshOptions {
	return {
		actions: options.actions,
		enabled: options.settings.enableTrayIcon,
		isOwner: options.ownerSnapshot.isTrayOwner,
		toolTip: options.toolTip,
	};
}

function buildRestorePolicyInput(options: {
	appIconHidden: boolean;
	ownerSnapshot: TrayOwnerSnapshot;
	runInBackground: boolean;
	runtimeAvailable: boolean;
	runtimePlatform: RuntimeDiagnostics["platform"];
	traySnapshot: TraySnapshot;
}): RestorePolicyInput {
	return {
		canUseDockRestore:
			options.runtimeAvailable &&
			options.runtimePlatform === "darwin" &&
			!options.appIconHidden,
		currentWindowId: options.ownerSnapshot.currentWindowId,
		runInBackground: options.runInBackground,
		runtimeAvailable: options.runtimeAvailable,
		trayCreated: options.traySnapshot.trayCreated,
		trayOwnerWindowId: options.ownerSnapshot.trayOwnerWindowId,
	};
}

function buildRestoreBlocker(options: {
	hideAppIconRequested: boolean;
	ownerSnapshot: TrayOwnerSnapshot;
	restorePolicyInput: RestorePolicyInput;
	traySnapshot: TraySnapshot;
}): RestoreBlocker | null {
	if (!options.restorePolicyInput.runtimeAvailable) {
		return "runtime-unavailable";
	}

	if (options.traySnapshot.lastTrayError) {
		return "tray-refresh-failed";
	}

	if (
		!options.ownerSnapshot.isTrayOwner &&
		options.ownerSnapshot.trayOwnerWindowId !== null
	) {
		return "non-owner-window";
	}

	if (
		options.hideAppIconRequested &&
		!canHideAppIconSafely(options.restorePolicyInput)
	) {
		return "hide-app-icon-unsafe";
	}

	if (
		options.restorePolicyInput.runInBackground &&
		!canRecoverFromHiddenState(options.restorePolicyInput)
	) {
		return "missing-tray-restore-path";
	}

	return null;
}
