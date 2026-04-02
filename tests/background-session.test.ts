import * as assert from "node:assert/strict";
import { test } from "node:test";

import type { AvailableDesktopRuntime } from "../src/runtime/electron";
import { BackgroundSessionController } from "../src/lifecycle/background-session";
import {
	FakeApp,
	FakeDomWindow,
	FakeTimerController,
	FakeWindow,
	createBeforeUnloadEvent,
} from "./helpers/fakes";

function createRuntime(platform: AvailableDesktopRuntime["platform"], currentWindow: FakeWindow) {
	return {
		available: true,
		app: new FakeApp(),
		BrowserWindow: {
			getAllWindows: () => [currentWindow],
		},
		currentWindow,
		diagnostics: {
			bridgeKind: "host.remote",
			capabilitySources: {},
			electronModuleLoaded: true,
			failureReason: "ok",
			missingCapabilities: [],
			notes: [],
			platform,
		},
		Menu: {
			buildFromTemplate: () => ({}),
		},
		nativeImage: {
			createFromDataURL: () => ({
				resize: () => ({
					resize: () => {
						throw new Error("not used");
					},
					setTemplateImage: () => {},
				}),
				setTemplateImage: () => {},
			}),
			createFromPath: () => ({
				resize: () => ({
					resize: () => {
						throw new Error("not used");
					},
					setTemplateImage: () => {},
				}),
				setTemplateImage: () => {},
			}),
		},
		platform,
		Tray: class {
			destroy(): void {}
			on(): void {}
			popUpContextMenu(): void {}
			removeListener(): void {}
			setToolTip(): void {}
		},
	} satisfies AvailableDesktopRuntime;
}

void test("BackgroundSessionController toggles close interception listeners on and off", () => {
	const currentWindow = new FakeWindow(1);
	const domWindow = new FakeDomWindow();
	const windowManager = {
		hideWindows(): void {},
		showWindowsCalls: 0,
		showWindows(): void {
			this.showWindowsCalls += 1;
		},
	};
	const controller = new BackgroundSessionController(createRuntime("darwin", currentWindow), {
		domWindow,
		timers: new FakeTimerController(),
	});

	controller.applyCloseInterception({
		canRecoverFromHiddenState: true,
		onCloseRequest: () => windowManager.hideWindows(),
		runInBackground: true,
		windowManager,
	});

	assert.deepEqual(controller.getSnapshot(), {
		closeInterceptionActive: true,
		macUnloadVetoArmed: true,
		pendingMacFullscreenBackground: false,
	});
	assert.equal(domWindow.listenerCount(), 1);
	assert.equal(currentWindow.listenerCount("close"), 1);
	assert.equal(currentWindow.listenerCount("leave-full-screen"), 0);

	const beforeUnloadEvent = createBeforeUnloadEvent();
	domWindow.dispatchBeforeUnload(beforeUnloadEvent);
	assert.equal(beforeUnloadEvent.defaultPrevented, true);
	assert.equal(beforeUnloadEvent.stopImmediatePropagationCalled, true);
	assert.equal(beforeUnloadEvent.returnValue, false);

	controller.applyCloseInterception({
		canRecoverFromHiddenState: false,
		onCloseRequest: () => windowManager.hideWindows(),
		runInBackground: true,
		windowManager,
	});

	assert.deepEqual(controller.getSnapshot(), {
		closeInterceptionActive: false,
		macUnloadVetoArmed: false,
		pendingMacFullscreenBackground: false,
	});
	assert.equal(domWindow.listenerCount(), 0);
	assert.equal(currentWindow.listenerCount("close"), 0);
	assert.equal(windowManager.showWindowsCalls, 1);
});

void test("BackgroundSessionController keeps close interception listener registration idempotent", () => {
	const currentWindow = new FakeWindow(1);
	const domWindow = new FakeDomWindow();
	const windowManager = {
		hideWindows(): void {},
		showWindowsCalls: 0,
		showWindows(): void {
			this.showWindowsCalls += 1;
		},
	};
	const controller = new BackgroundSessionController(createRuntime("darwin", currentWindow), {
		domWindow,
		timers: new FakeTimerController(),
	});

	controller.applyCloseInterception({
		canRecoverFromHiddenState: true,
		onCloseRequest: () => windowManager.hideWindows(),
		runInBackground: true,
		windowManager,
	});
	controller.applyCloseInterception({
		canRecoverFromHiddenState: true,
		onCloseRequest: () => windowManager.hideWindows(),
		runInBackground: true,
		windowManager,
	});

	assert.equal(domWindow.listenerCount(), 1);
	assert.equal(currentWindow.listenerCount("close"), 1);
	assert.equal(currentWindow.listenerCount("leave-full-screen"), 0);

	controller.applyCloseInterception({
		canRecoverFromHiddenState: false,
		onCloseRequest: () => windowManager.hideWindows(),
		runInBackground: true,
		windowManager,
	});
	controller.disable();

	assert.equal(domWindow.listenerCount(), 0);
	assert.equal(currentWindow.listenerCount("close"), 0);
	assert.equal(windowManager.showWindowsCalls, 1);
});

void test("BackgroundSessionController backgrounds fullscreen macOS windows after leaving fullscreen", () => {
	const currentWindow = new FakeWindow(1);
	currentWindow.setFullScreen(true);
	currentWindow.setFullScreenCalls = [];
	const domWindow = new FakeDomWindow();
	const timers = new FakeTimerController();
	const runtime = createRuntime("darwin", currentWindow);
	const windowManager = {
		hideWindowsCalls: 0,
		hideWindows(): void {
			this.hideWindowsCalls += 1;
		},
		showWindows(): void {},
	};
	const controller = new BackgroundSessionController(runtime, {
		domWindow,
		timers,
	});

	controller.applyCloseInterception({
		canRecoverFromHiddenState: true,
		onCloseRequest: () => windowManager.hideWindows(),
		runInBackground: true,
		windowManager,
	});
	controller.backgroundCurrentSession(windowManager);

	assert.deepEqual(currentWindow.setFullScreenCalls, [false]);
	assert.equal(timers.pendingCount(), 1);
	assert.equal(controller.getSnapshot().pendingMacFullscreenBackground, true);

	currentWindow.setFullScreen(false);
	timers.runAll();

	assert.equal(runtime.app.hideCalls, 1);
	assert.equal(controller.getSnapshot().pendingMacFullscreenBackground, false);
});

void test("BackgroundSessionController backgrounds simple fullscreen macOS windows after leaving fullscreen", () => {
	const currentWindow = new FakeWindow(1);
	currentWindow.setSimpleFullScreen(true);
	currentWindow.setSimpleFullScreenCalls = [];
	const timers = new FakeTimerController();
	const runtime = createRuntime("darwin", currentWindow);
	const controller = new BackgroundSessionController(runtime, {
		domWindow: new FakeDomWindow(),
		timers,
	});
	const windowManager = {
		hideWindows(): void {},
		showWindows(): void {},
	};

	controller.applyCloseInterception({
		canRecoverFromHiddenState: true,
		onCloseRequest: () => windowManager.hideWindows(),
		runInBackground: true,
		windowManager,
	});
	controller.backgroundCurrentSession(windowManager);

	assert.deepEqual(currentWindow.setSimpleFullScreenCalls, [false]);
	assert.equal(timers.pendingCount(), 1);

	currentWindow.setSimpleFullScreen(false);
	currentWindow.emit("leave-full-screen");

	assert.equal(runtime.app.hideCalls, 1);
	assert.equal(timers.pendingCount(), 0);
	assert.equal(controller.getSnapshot().pendingMacFullscreenBackground, false);
});

void test("BackgroundSessionController keeps a fullscreen leave listener for direct backgrounding outside close interception", () => {
	const currentWindow = new FakeWindow(1);
	currentWindow.setFullScreen(true);
	currentWindow.setFullScreenCalls = [];
	const timers = new FakeTimerController();
	const runtime = createRuntime("darwin", currentWindow);
	const controller = new BackgroundSessionController(runtime, {
		domWindow: new FakeDomWindow(),
		timers,
	});
	const windowManager = {
		hideWindows(): void {},
		showWindows(): void {},
	};

	controller.backgroundCurrentSession(windowManager);

	assert.deepEqual(currentWindow.setFullScreenCalls, [false]);
	assert.equal(currentWindow.listenerCount("leave-full-screen"), 1);
	assert.equal(timers.pendingCount(), 1);

	currentWindow.setFullScreen(true);
	timers.runAll();
	assert.equal(runtime.app.hideCalls, 0);

	currentWindow.setFullScreen(false);
	currentWindow.emit("leave-full-screen");

	assert.equal(runtime.app.hideCalls, 1);
	assert.equal(currentWindow.listenerCount("leave-full-screen"), 0);
	assert.equal(controller.getSnapshot().pendingMacFullscreenBackground, false);
});

void test("BackgroundSessionController destroy clears fullscreen pending state even without close interception", () => {
	const currentWindow = new FakeWindow(1);
	currentWindow.setFullScreen(true);
	currentWindow.setFullScreenCalls = [];
	const timers = new FakeTimerController();
	const runtime = createRuntime("darwin", currentWindow);
	const controller = new BackgroundSessionController(runtime, {
		domWindow: new FakeDomWindow(),
		timers,
	});
	const windowManager = {
		hideWindows(): void {},
		showWindows(): void {},
	};

	controller.backgroundCurrentSession(windowManager);

	assert.equal(timers.pendingCount(), 1);
	assert.equal(controller.getSnapshot().pendingMacFullscreenBackground, true);

	controller.destroy();
	currentWindow.setFullScreen(false);
	timers.runAll();

	assert.equal(timers.pendingCount(), 0);
	assert.equal(controller.getSnapshot().pendingMacFullscreenBackground, false);
	assert.equal(runtime.app.hideCalls, 0);
});

void test("BackgroundSessionController disable clears fullscreen pending state even without close interception", () => {
	const currentWindow = new FakeWindow(1);
	currentWindow.setFullScreen(true);
	currentWindow.setFullScreenCalls = [];
	const timers = new FakeTimerController();
	const runtime = createRuntime("darwin", currentWindow);
	const controller = new BackgroundSessionController(runtime, {
		domWindow: new FakeDomWindow(),
		timers,
	});
	const windowManager = {
		hideWindows(): void {},
		showWindows(): void {},
	};

	controller.backgroundCurrentSession(windowManager);

	assert.equal(timers.pendingCount(), 1);
	assert.equal(controller.getSnapshot().pendingMacFullscreenBackground, true);

	controller.disable();
	currentWindow.setFullScreen(false);
	timers.runAll();

	assert.equal(timers.pendingCount(), 0);
	assert.equal(controller.getSnapshot().pendingMacFullscreenBackground, false);
	assert.equal(runtime.app.hideCalls, 0);
});
