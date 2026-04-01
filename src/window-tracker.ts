import type { ElectronWindow } from "./runtime/electron";

export interface WindowTrackingState {
	managedWindows: Set<ElectronWindow>;
	maximizedWindows: Set<ElectronWindow>;
	windowCleanup: Map<ElectronWindow, Array<() => void>>;
}

export interface WindowTrackerCallbacks {
	onFocus?(): void;
	onTopologyChange?(): void;
}

export interface AttachTrackedWindowOptions {
	callbacks: WindowTrackerCallbacks | null;
	onDetachWindow(window: ElectronWindow): void;
	skipTaskbar: boolean;
	state: WindowTrackingState;
	window: ElectronWindow;
}

export function attachTrackedWindow(options: AttachTrackedWindowOptions): boolean {
	if (options.state.managedWindows.has(options.window) || isDestroyed(options.window)) {
		return false;
	}

	options.state.managedWindows.add(options.window);
	options.window.setSkipTaskbar(options.skipTaskbar);

	if (options.window.isMaximized()) {
		options.state.maximizedWindows.add(options.window);
	}

	const cleanup: Array<() => void> = [];
	const addWindowListener = (eventName: string, listener: (...args: unknown[]) => void): void => {
		options.window.on(eventName, listener);
		cleanup.push(() => options.window.removeListener(eventName, listener));
	};

	addWindowListener("maximize", () => options.state.maximizedWindows.add(options.window));
	addWindowListener("unmaximize", () => options.state.maximizedWindows.delete(options.window));
	addWindowListener("closed", () => {
		options.onDetachWindow(options.window);
		options.callbacks?.onTopologyChange?.();
	});

	if (options.callbacks?.onFocus) {
		addWindowListener("focus", () => options.callbacks?.onFocus?.());
	}

	options.state.windowCleanup.set(options.window, cleanup);
	return true;
}

export function detachTrackedWindow(
	state: WindowTrackingState,
	window: ElectronWindow,
): void {
	state.managedWindows.delete(window);
	state.maximizedWindows.delete(window);

	const cleanup = state.windowCleanup.get(window);
	if (!cleanup) {
		return;
	}

	for (const dispose of cleanup) {
		dispose();
	}

	state.windowCleanup.delete(window);
}

export function isDestroyed(window: ElectronWindow): boolean {
	return typeof window.isDestroyed === "function" ? window.isDestroyed() : false;
}

export function isElectronWindow(value: unknown): value is ElectronWindow {
	return (
		typeof value === "object" &&
		value !== null &&
		typeof (value as ElectronWindow).show === "function" &&
		typeof (value as ElectronWindow).hide === "function" &&
		typeof (value as ElectronWindow).webContents === "object"
	);
}
