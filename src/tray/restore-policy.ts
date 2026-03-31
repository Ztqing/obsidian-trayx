export type RestorePath = "dock" | "none" | "tray";
export type RuntimeMode = "bridge-unavailable" | "foreground-only" | "safe-close-disabled" | "full";

export interface RestorePolicyInput {
	canUseDockRestore: boolean;
	currentWindowId: number | null;
	runInBackground: boolean;
	runtimeAvailable: boolean;
	trayCreated: boolean;
	trayOwnerWindowId: number | null;
}

export function getRestorePathAvailability(input: RestorePolicyInput): RestorePath {
	if (
		input.trayCreated ||
		(input.trayOwnerWindowId !== null && input.trayOwnerWindowId !== input.currentWindowId)
	) {
		return "tray";
	}

	if (input.canUseDockRestore) {
		return "dock";
	}

	return "none";
}

export function canRecoverFromHiddenState(input: RestorePolicyInput): boolean {
	return getRestorePathAvailability(input) !== "none";
}

export function canHideAppIconSafely(input: RestorePolicyInput): boolean {
	return getRestorePathAvailability(input) === "tray";
}

export function getRuntimeMode(input: RestorePolicyInput): RuntimeMode {
	const restorePath = getRestorePathAvailability(input);
	if (!input.runtimeAvailable) {
		return "bridge-unavailable";
	}

	if (!input.runInBackground) {
		return "foreground-only";
	}

	if (restorePath === "none") {
		return "safe-close-disabled";
	}

	return "full";
}
