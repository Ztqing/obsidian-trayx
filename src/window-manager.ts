import type { AvailableDesktopRuntime, ElectronWindow } from "./runtime/electron";
import {
	attachTrackedWindow,
	detachTrackedWindow,
	isDestroyed,
	isElectronWindow,
} from "./window-tracker";

export class WindowManager {
	private readonly managedWindows = new Set<ElectronWindow>();
	private readonly maximizedWindows = new Set<ElectronWindow>();
	private readonly windowCleanup = new Map<ElectronWindow, Array<() => void>>();
	private readonly cleanupCallbacks: Array<() => void> = [];
	private isStarted = false;
	private skipTaskbar = false;
	private focusHandler: (() => void) | null = null;

	constructor(private readonly runtime: AvailableDesktopRuntime) {}

	start(focusHandler?: () => void): void {
		if (this.isStarted) {
			return;
		}

		this.isStarted = true;
		this.focusHandler = focusHandler ?? null;

		const onWindowCreated = (window: unknown): void => {
			if (isElectronWindow(window)) {
				this.trackWindow(window);
			}
		};

		this.trackWindow(this.runtime.currentWindow);
		this.runtime.currentWindow.webContents.on("did-create-window", onWindowCreated);
		this.cleanupCallbacks.push(() => {
			this.runtime.currentWindow.webContents.removeListener("did-create-window", onWindowCreated);
		});
	}

	getWindows(): ElectronWindow[] {
		return [...this.managedWindows].filter((window) => !isDestroyed(window));
	}

	hasVisibleWindows(): boolean {
		return this.getWindows().some((window) => window.isVisible());
	}

	needsDockRestore(): boolean {
		return this.getWindows().length > 0 && !this.hasVisibleWindows();
	}

	setSkipTaskbar(skipTaskbar: boolean): void {
		this.skipTaskbar = skipTaskbar;
		for (const window of this.getWindows()) {
			window.setSkipTaskbar(skipTaskbar);
		}
	}

	showWindows(): void {
		const windows = this.getWindows();
		for (const window of windows) {
			if (window.isMinimized()) {
				window.restore();
			}

			window.show();
			if (this.maximizedWindows.has(window)) {
				window.maximize();
			}
		}

		windows[0]?.focus();
	}

	hideWindows(runInBackground: boolean): void {
		for (const window of this.getWindows()) {
			void this.hideWindow(window, runInBackground);
		}
	}

	toggleWindows(runInBackground: boolean): void {
		if (this.hasVisibleWindow()) {
			this.hideWindows(runInBackground);
			return;
		}

		this.showWindows();
	}

	destroy(): void {
		for (const cleanup of this.cleanupCallbacks.splice(0)) {
			cleanup();
		}

		for (const window of [...this.windowCleanup.keys()]) {
			this.detachWindow(window);
		}

		this.managedWindows.clear();
		this.maximizedWindows.clear();
		this.focusHandler = null;
		this.isStarted = false;
	}

	private hasVisibleWindow(): boolean {
		return this.hasVisibleWindows();
	}

	private trackWindow(window: ElectronWindow): void {
		attachTrackedWindow({
			focusHandler: this.focusHandler,
			onDetachWindow: (window) => this.detachWindow(window),
			skipTaskbar: this.skipTaskbar,
			state: {
				managedWindows: this.managedWindows,
				maximizedWindows: this.maximizedWindows,
				windowCleanup: this.windowCleanup,
			},
			window,
		});
	}

	private detachWindow(window: ElectronWindow): void {
		detachTrackedWindow(
			{
				managedWindows: this.managedWindows,
				maximizedWindows: this.maximizedWindows,
				windowCleanup: this.windowCleanup,
			},
			window,
		);
	}

	private async hideWindow(window: ElectronWindow, runInBackground: boolean): Promise<void> {
		if (window.isFocused()) {
			window.blur();
		}

		if (!runInBackground) {
			window.minimize();
			return;
		}

		window.hide();
	}
}
