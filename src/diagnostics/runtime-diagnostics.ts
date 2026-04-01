import {
	getCurrentLocale,
	getLocalizedStrings,
	getRuntimeFailureReason,
	type SupportedLocale,
} from "../i18n";
import type { BackgroundLifecycleSnapshot } from "../lifecycle/background-session";
import type { RuntimeDiagnostics } from "../runtime/electron";
import type { TrayOwnerSnapshot } from "../tray/owner";
import type { RestorePath, RuntimeMode } from "../tray/restore-policy";
import type { TraySnapshot } from "../tray/service";

export interface RuntimeDiagnosticsPayload extends RuntimeDiagnostics {
	appIconHidden: boolean;
	closeInterceptionActive: boolean;
	currentWindowId: number | null;
	isFullScreen: boolean;
	isTrayOwner: boolean;
	macUnloadVetoArmed: boolean;
	mode: RuntimeMode;
	pendingMacFullscreenBackground: boolean;
	previousTrayOwnerDetected: boolean;
	resolvedTrayIconPath: string | null;
	restoreBlocker: string | null;
	restorePath: RestorePath;
	trayBounds: { height: number; width: number; x: number; y: number } | null;
	trayCreated: boolean;
	trayIconEmpty: boolean | null;
	trayIconExists: boolean;
	trayIconMode: TraySnapshot["trayIconMode"];
	trayIconTemplate: boolean | null;
	trayObjectCreated: boolean;
	trayOwnerWindowId: number | null;
	trayRefreshError: string | null;
}

export function buildRuntimeDiagnosticsPayload(options: {
	appIconHidden: boolean;
	backgroundSnapshot: BackgroundLifecycleSnapshot;
	isFullScreen: boolean;
	mode: RuntimeMode;
	ownerSnapshot: TrayOwnerSnapshot;
	restoreBlocker: string | null;
	restorePath: RestorePath;
	runtimeDiagnostics: RuntimeDiagnostics;
	traySnapshot: TraySnapshot;
}): RuntimeDiagnosticsPayload {
	return {
		...options.runtimeDiagnostics,
		appIconHidden: options.appIconHidden,
		closeInterceptionActive: options.backgroundSnapshot.closeInterceptionActive,
		currentWindowId: options.ownerSnapshot.currentWindowId,
		isFullScreen: options.isFullScreen,
		isTrayOwner: options.ownerSnapshot.isTrayOwner,
		macUnloadVetoArmed: options.backgroundSnapshot.macUnloadVetoArmed,
		mode: options.mode,
		pendingMacFullscreenBackground: options.backgroundSnapshot.pendingMacFullscreenBackground,
		previousTrayOwnerDetected: options.ownerSnapshot.previousTrayOwnerDetected,
		resolvedTrayIconPath: options.traySnapshot.resolvedTrayIconPath,
		restoreBlocker: options.restoreBlocker,
		restorePath: options.restorePath,
		trayBounds: options.traySnapshot.trayBounds,
		trayCreated: options.traySnapshot.trayCreated,
		trayIconEmpty: options.traySnapshot.trayIconEmpty,
		trayIconExists: options.traySnapshot.trayIconExists,
		trayIconMode: options.traySnapshot.trayIconMode,
		trayIconTemplate: options.traySnapshot.trayIconTemplate,
		trayObjectCreated: options.traySnapshot.trayObjectCreated,
		trayOwnerWindowId: options.ownerSnapshot.trayOwnerWindowId,
		trayRefreshError: options.traySnapshot.lastTrayError,
	};
}

export function formatRuntimeDiagnosticsSummary(
	diagnostics: RuntimeDiagnosticsPayload,
	runtimeAvailable: boolean,
	locale: SupportedLocale = getCurrentLocale(),
): string {
	const strings = getLocalizedStrings(locale).diagnostics;
	const segments = [
		`${strings.bridge}: ${diagnostics.bridgeKind}`,
		`${strings.platform}: ${diagnostics.platform}`,
	];

	if (diagnostics.hostVersion) {
		segments.push(`${strings.obsidian}: ${diagnostics.hostVersion}`);
	}

	if (diagnostics.missingCapabilities.length > 0) {
		segments.push(`${strings.missing}: ${diagnostics.missingCapabilities.join(", ")}`);
	}

	const sources = Object.entries(diagnostics.capabilitySources)
		.map(([capability, source]) => `${capability}=${source}`)
		.join(", ");
	if (sources) {
		segments.push(`${strings.sources}: ${sources}`);
	}

	segments.push(`${strings.tray}: ${diagnostics.trayCreated ? strings.ready : strings.notReady}`);
	if (diagnostics.trayOwnerWindowId !== null && diagnostics.trayOwnerWindowId !== undefined) {
		segments.push(`${strings.trayOwner}: ${diagnostics.trayOwnerWindowId}`);
	}
	if (diagnostics.currentWindowId !== null && diagnostics.currentWindowId !== undefined) {
		segments.push(`${strings.window}: ${diagnostics.currentWindowId}`);
	}
	if (diagnostics.isTrayOwner === false) {
		segments.push(strings.nonOwnerWindow);
	}
	if (diagnostics.trayIconMode) {
		segments.push(`${strings.trayIcon}: ${diagnostics.trayIconMode}`);
	}
	if (diagnostics.trayRefreshError) {
		segments.push(`${strings.trayError}: ${diagnostics.trayRefreshError}`);
	}
	if (diagnostics.resolvedTrayIconPath) {
		segments.push(`${strings.trayPath}: ${diagnostics.resolvedTrayIconPath}`);
	}
	if (typeof diagnostics.trayIconExists === "boolean") {
		segments.push(`${strings.trayIconExists}: ${diagnostics.trayIconExists}`);
	}
	if (diagnostics.trayIconEmpty !== null && diagnostics.trayIconEmpty !== undefined) {
		segments.push(`${strings.trayIconEmpty}: ${diagnostics.trayIconEmpty}`);
	}
	if (diagnostics.trayIconTemplate !== null && diagnostics.trayIconTemplate !== undefined) {
		segments.push(`${strings.trayIconTemplate}: ${diagnostics.trayIconTemplate}`);
	}
	if (diagnostics.trayBounds) {
		segments.push(
			`${strings.trayBounds}: ${diagnostics.trayBounds.width}x${diagnostics.trayBounds.height}@${diagnostics.trayBounds.x},${diagnostics.trayBounds.y}`,
		);
	}
	segments.push(`${strings.restore}: ${diagnostics.restorePath}`);
	if (diagnostics.restoreBlocker) {
		segments.push(`${strings.restoreBlocker}: ${diagnostics.restoreBlocker}`);
	}
	segments.push(
		`${strings.closeIntercept}: ${diagnostics.closeInterceptionActive ? strings.on : strings.off}`,
	);
	segments.push(
		`${strings.fullscreenClosePending}: ${diagnostics.pendingMacFullscreenBackground ? strings.on : strings.off}`,
	);
	segments.push(`${strings.fullscreen}: ${diagnostics.isFullScreen ? strings.on : strings.off}`);
	segments.push(`${strings.unloadVeto}: ${diagnostics.macUnloadVetoArmed ? strings.on : strings.off}`);
	segments.push(`${strings.mode}: ${diagnostics.mode}`);
	segments.push(
		runtimeAvailable
			? strings.trayBridgeReady
			: getRuntimeFailureReason(diagnostics, locale),
	);

	return segments.join(" | ");
}
