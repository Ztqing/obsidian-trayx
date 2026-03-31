export const TRAY_OWNER_SCHEMA_VERSION = 1;
export const TRAY_OWNER_STORAGE_KEY = "trayx_tray_owner";

export interface TrayOwnerStorage {
	loadLocalStorage(key: string): unknown;
	saveLocalStorage(key: string, value: unknown): void;
}

export interface TrayOwnerState {
	ownerWindowId: number;
	schemaVersion: number;
	updatedAt: number;
}

export interface TrayOwnerSnapshot {
	currentWindowId: number | null;
	isTrayOwner: boolean;
	previousTrayOwnerDetected: boolean;
	trayOwnerWindowId: number | null;
}

export function createTrayOwnerSnapshot(currentWindowId: number | null): TrayOwnerSnapshot {
	return {
		currentWindowId,
		isTrayOwner: false,
		previousTrayOwnerDetected: false,
		trayOwnerWindowId: null,
	};
}

export function syncTrayOwnership(
	storage: TrayOwnerStorage,
	currentWindowId: number | null,
	liveWindowIds: ReadonlySet<number>,
	now = Date.now,
): TrayOwnerSnapshot {
	const storedOwner = loadTrayOwnerState(storage.loadLocalStorage(TRAY_OWNER_STORAGE_KEY));
	if (
		storedOwner &&
		storedOwner.schemaVersion === TRAY_OWNER_SCHEMA_VERSION &&
		liveWindowIds.has(storedOwner.ownerWindowId)
	) {
		return {
			currentWindowId,
			isTrayOwner: storedOwner.ownerWindowId === currentWindowId,
			previousTrayOwnerDetected: storedOwner.ownerWindowId !== currentWindowId,
			trayOwnerWindowId: storedOwner.ownerWindowId,
		};
	}

	return claimTrayOwnership(storage, currentWindowId, now);
}

export function claimTrayOwnership(
	storage: TrayOwnerStorage,
	currentWindowId: number | null,
	now = Date.now,
): TrayOwnerSnapshot {
	if (currentWindowId === null) {
		return createTrayOwnerSnapshot(currentWindowId);
	}

	const state: TrayOwnerState = {
		ownerWindowId: currentWindowId,
		schemaVersion: TRAY_OWNER_SCHEMA_VERSION,
		updatedAt: now(),
	};
	storage.saveLocalStorage(TRAY_OWNER_STORAGE_KEY, state);

	return {
		currentWindowId,
		isTrayOwner: true,
		previousTrayOwnerDetected: false,
		trayOwnerWindowId: state.ownerWindowId,
	};
}

export function releaseTrayOwnership(
	storage: TrayOwnerStorage,
	snapshot: TrayOwnerSnapshot,
): TrayOwnerSnapshot {
	if (!snapshot.isTrayOwner) {
		return snapshot;
	}

	storage.saveLocalStorage(TRAY_OWNER_STORAGE_KEY, null);
	return {
		...snapshot,
		isTrayOwner: false,
		previousTrayOwnerDetected: false,
		trayOwnerWindowId: null,
	};
}

export function loadTrayOwnerState(stored: unknown): TrayOwnerState | null {
	if (
		!stored ||
		typeof stored !== "object" ||
		!("ownerWindowId" in stored) ||
		!("schemaVersion" in stored) ||
		!("updatedAt" in stored) ||
		typeof stored.ownerWindowId !== "number" ||
		typeof stored.schemaVersion !== "number" ||
		typeof stored.updatedAt !== "number"
	) {
		return null;
	}

	return stored as TrayOwnerState;
}
