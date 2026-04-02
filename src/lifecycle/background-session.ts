import type { AvailableDesktopRuntime, ElectronWindow } from "../runtime/electron";

export interface BackgroundLifecycleSnapshot {
	closeInterceptionActive: boolean;
	macUnloadVetoArmed: boolean;
	pendingMacFullscreenBackground: boolean;
}

export interface BackgroundWindowManager {
	hideWindows(runInBackground: boolean): void;
	showWindows(): void;
}

export interface BeforeUnloadEventLike {
	preventDefault(): void;
	returnValue?: unknown;
	stopImmediatePropagation(): void;
}

export interface DomWindowLike {
	addEventListener(
		eventName: "beforeunload",
		listener: (event: BeforeUnloadEventLike) => void,
		useCapture?: boolean,
	): void;
	removeEventListener(
		eventName: "beforeunload",
		listener: (event: BeforeUnloadEventLike) => void,
		useCapture?: boolean,
	): void;
}

export interface TimerController {
	clearTimeout(timeoutId: unknown): void;
	setTimeout(callback: () => void, delay: number): unknown;
}

export interface BackgroundSessionDependencies {
	domWindow: DomWindowLike;
	timers: TimerController;
}

export interface CloseInterceptionOptions {
	canRecoverFromHiddenState: boolean;
	onCloseRequest(): void;
	runInBackground: boolean;
	windowManager: BackgroundWindowManager;
}

export class BackgroundSessionController {
	private beforeUnloadHandler: ((event: BeforeUnloadEventLike) => void) | null = null;
	private closeRequestHandler: (() => void) | null = null;
	private fullscreenBackgroundTimeout: unknown = null;
	private leaveFullScreenHandler: (() => void) | null = null;
	private snapshot = createEmptyBackgroundLifecycleSnapshot();
	private windowCloseHandler: ((event: { preventDefault?: () => void }) => void) | null = null;

	constructor(
		private readonly runtime: AvailableDesktopRuntime,
		private readonly dependencies: BackgroundSessionDependencies = {
			domWindow: window,
			timers: globalThis,
		},
	) {}

	applyCloseInterception(options: CloseInterceptionOptions): void {
		this.closeRequestHandler = () => options.onCloseRequest();

		if (this.shouldInterceptClose(options)) {
			this.enableCloseInterception(options.windowManager);
			return;
		}

		this.disableCloseInterception(options.windowManager);
	}

	backgroundCurrentSession(windowManager: BackgroundWindowManager): void {
		if (this.canHideMacApp() && this.tryBackgroundMacFullscreenWindow(windowManager)) {
			return;
		}

		if (this.canHideMacApp()) {
			this.hideMacApp(windowManager);
			return;
		}

		windowManager.hideWindows(true);
	}

	destroy(): void {
		this.cleanupRuntimeState();
	}

	disable(): void {
		this.cleanupRuntimeState();
	}

	getSnapshot(): BackgroundLifecycleSnapshot {
		return { ...this.snapshot };
	}

	isCurrentWindowFullScreen(): boolean {
		return this.isMacFullscreenWindow(this.runtime.currentWindow);
	}

	private shouldInterceptClose(options: CloseInterceptionOptions): boolean {
		return options.runInBackground && options.canRecoverFromHiddenState;
	}

	private disableCloseInterception(windowManager: BackgroundWindowManager): void {
		const wasIntercepting = this.snapshot.closeInterceptionActive;
		this.disable();

		if (wasIntercepting) {
			windowManager.showWindows();
		}
	}

	private enableCloseInterception(windowManager: BackgroundWindowManager): void {
		if (this.snapshot.closeInterceptionActive) {
			return;
		}

		this.snapshot.closeInterceptionActive = true;
		this.beforeUnloadHandler = (event: BeforeUnloadEventLike): void => {
			event.preventDefault();
			event.stopImmediatePropagation();
			// Electron/Chromium still honor returnValue for close vetoes in some unload paths.
			event.returnValue = false;
		};
		this.snapshot.macUnloadVetoArmed = this.runtime.platform === "darwin";
		this.windowCloseHandler = (event: { preventDefault?: () => void }): void => {
			event.preventDefault?.();
			this.closeRequestHandler?.();
		};
		this.registerCloseInterceptionListeners();
	}

	private cleanupRuntimeState(): void {
		this.snapshot.closeInterceptionActive = false;
		this.unregisterCloseInterceptionListeners();
		this.unregisterMacFullscreenLeaveHandler();
		this.resetPendingMacFullscreenBackground();
		this.closeRequestHandler = null;
		this.snapshot.macUnloadVetoArmed = false;
	}

	private hideMacApp(windowManager: BackgroundWindowManager): void {
		this.resetPendingMacFullscreenBackground();
		if (!this.snapshot.closeInterceptionActive) {
			this.unregisterMacFullscreenLeaveHandler();
		}

		if (this.canHideMacApp()) {
			this.runtime.app.hide?.();
			return;
		}

		windowManager.hideWindows(true);
	}

	private canHideMacApp(): boolean {
		return this.runtime.platform === "darwin" && typeof this.runtime.app.hide === "function";
	}

	private registerCloseInterceptionListeners(): void {
		this.dependencies.domWindow.addEventListener(
			"beforeunload",
			this.beforeUnloadHandler as (event: BeforeUnloadEventLike) => void,
			true,
		);
		this.runtime.currentWindow.on(
			"close",
			this.windowCloseHandler as (event: { preventDefault?: () => void }) => void,
		);
	}

	private registerMacFullscreenLeaveHandler(windowManager: BackgroundWindowManager): void {
		if (this.runtime.platform !== "darwin" || this.leaveFullScreenHandler) {
			return;
		}

		this.leaveFullScreenHandler = () => {
			if (!this.snapshot.pendingMacFullscreenBackground) {
				return;
			}

			this.hideMacApp(windowManager);
		};
		this.runtime.currentWindow.on("leave-full-screen", this.leaveFullScreenHandler);
	}

	private unregisterCloseInterceptionListeners(): void {
		if (this.beforeUnloadHandler) {
			this.dependencies.domWindow.removeEventListener(
				"beforeunload",
				this.beforeUnloadHandler,
				true,
			);
			this.beforeUnloadHandler = null;
		}

		if (this.windowCloseHandler) {
			this.runtime.currentWindow.removeListener("close", this.windowCloseHandler);
			this.windowCloseHandler = null;
		}
	}

	private unregisterMacFullscreenLeaveHandler(): void {
		if (this.leaveFullScreenHandler) {
			this.runtime.currentWindow.removeListener("leave-full-screen", this.leaveFullScreenHandler);
			this.leaveFullScreenHandler = null;
		}
	}

	private tryBackgroundMacFullscreenWindow(windowManager: BackgroundWindowManager): boolean {
		const currentWindow = this.runtime.currentWindow;
		if (!this.isMacFullscreenWindow(currentWindow)) {
			return false;
		}

		if (this.exitNativeFullscreen(currentWindow) || this.exitSimpleFullscreen(currentWindow)) {
			this.snapshot.pendingMacFullscreenBackground = true;
			this.registerMacFullscreenLeaveHandler(windowManager);
			this.armFullscreenBackgroundTimeout(windowManager);
			return true;
		}

		return false;
	}

	private exitNativeFullscreen(window: ElectronWindow): boolean {
		if (
			typeof window.isFullScreen !== "function" ||
			!window.isFullScreen() ||
			typeof window.setFullScreen !== "function"
		) {
			return false;
		}

		window.setFullScreen(false);
		return true;
	}

	private exitSimpleFullscreen(window: ElectronWindow): boolean {
		if (
			typeof window.isSimpleFullScreen !== "function" ||
			!window.isSimpleFullScreen() ||
			typeof window.setSimpleFullScreen !== "function"
		) {
			return false;
		}

		window.setSimpleFullScreen(false);
		return true;
	}

	private armFullscreenBackgroundTimeout(windowManager: BackgroundWindowManager): void {
		this.clearFullscreenBackgroundTimeout();
		this.fullscreenBackgroundTimeout = this.dependencies.timers.setTimeout(() => {
			if (!this.snapshot.pendingMacFullscreenBackground) {
				return;
			}

			if (!this.isCurrentWindowFullScreen()) {
				this.hideMacApp(windowManager);
			}
		}, 1200);
	}

	private resetPendingMacFullscreenBackground(): void {
		this.snapshot.pendingMacFullscreenBackground = false;
		this.clearFullscreenBackgroundTimeout();
	}

	private clearFullscreenBackgroundTimeout(): void {
		if (this.fullscreenBackgroundTimeout !== null) {
			this.dependencies.timers.clearTimeout(this.fullscreenBackgroundTimeout);
			this.fullscreenBackgroundTimeout = null;
		}
	}

	private isMacFullscreenWindow(window: ElectronWindow): boolean {
		if (typeof window.isFullScreen === "function" && window.isFullScreen()) {
			return true;
		}

		return typeof window.isSimpleFullScreen === "function" && window.isSimpleFullScreen();
	}
}

export function createEmptyBackgroundLifecycleSnapshot(): BackgroundLifecycleSnapshot {
	return {
		closeInterceptionActive: false,
		macUnloadVetoArmed: false,
		pendingMacFullscreenBackground: false,
	};
}
