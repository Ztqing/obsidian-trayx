import * as assert from "node:assert/strict";
import { test } from "node:test";

import type { AvailableDesktopRuntime, ElectronNativeImage, ElectronTray } from "../src/runtime/electron";
import {
	TrayService,
	createEmptyTraySnapshot,
	createTrayMenuTemplateForLocale,
	type TrayActions,
} from "../src/tray/service";
import { FakeApp, FakeEventEmitter, FakeWindow } from "./helpers/fakes";

class FakeNativeImage implements ElectronNativeImage {
	templateImage = false;

	isTemplateImage(): boolean {
		return this.templateImage;
	}

	resize(): ElectronNativeImage {
		return this;
	}

	setTemplateImage(isTemplate: boolean): void {
		this.templateImage = isTemplate;
	}
}

class FakeTray extends FakeEventEmitter implements ElectronTray {
	contextMenu: unknown = null;
	destroyed = false;
	tooltip = "";

	constructor(readonly bounds = { height: 16, width: 16, x: 4, y: 8 }) {
		super();
	}

	destroy(): void {
		this.destroyed = true;
	}

	getBounds(): { height: number; width: number; x: number; y: number } {
		return this.bounds;
	}

	popUpContextMenu(menu?: unknown): void {
		this.contextMenu = menu ?? null;
	}

	setContextMenu(menu: unknown): void {
		this.contextMenu = menu;
	}

	setToolTip(toolTip: string): void {
		this.tooltip = toolTip;
	}
}

function createActions(): TrayActions & { calls: string[] } {
	const calls: string[] = [];

	return {
		calls,
		closeVault: () => calls.push("close"),
		hideVault: () => calls.push("hide"),
		relaunchApp: () => calls.push("relaunch"),
		showVault: () => calls.push("show"),
		toggleVaultVisibility: () => calls.push("toggle"),
	};
}

function createRuntime(
	platform: AvailableDesktopRuntime["platform"],
	TrayCtor: new (image: ElectronNativeImage | string) => ElectronTray,
): AvailableDesktopRuntime {
	return {
		available: true,
		app: new FakeApp(),
		BrowserWindow: {
			getAllWindows: () => [],
		},
		currentWindow: new FakeWindow(1),
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
			buildFromTemplate: (template) => ({ template }),
		},
		nativeImage: {
			createFromDataURL: () => new FakeNativeImage(),
			createFromPath: () => new FakeNativeImage(),
		},
		platform,
		Tray: TrayCtor,
	};
}

void test("createTrayMenuTemplate preserves the command ordering across locales", () => {
	const englishMenu = createTrayMenuTemplateForLocale(createActions(), "en");
	const chineseMenu = createTrayMenuTemplateForLocale(createActions(), "zh");

	assert.deepEqual(
		englishMenu.map((item) => item.label ?? item.type),
		["Show vault", "Hide vault", "separator", "Relaunch app", "Close vault"],
	);
	assert.deepEqual(
		chineseMenu.map((item) => item.label ?? item.type),
		["显示库", "隐藏库", "separator", "重新启动应用", "关闭库"],
	);
});

void test("TrayService refresh creates a tray and wires platform-specific click behavior", () => {
	const createdTrays: FakeTray[] = [];
	const createdInputs: Array<ElectronNativeImage | string> = [];
	class CapturingTray extends FakeTray {
		constructor(image: ElectronNativeImage | string) {
			super();
			createdInputs.push(image);
			createdTrays.push(this);
		}
	}

	const actions = createActions();
	const service = new TrayService(createRuntime("win32", CapturingTray), "/tmp/trayx-plugin");

	const result = service.refresh({
		actions,
		enabled: true,
		isOwner: true,
		toolTip: "TrayX: Demo",
	});

	assert.equal(result.ok, true);
	assert.ok(createdInputs[0] instanceof FakeNativeImage);
	assert.deepEqual(service.getSnapshot(), {
		resolvedTrayIconPath: null,
		trayBounds: { height: 16, width: 16, x: 4, y: 8 },
		trayCreated: true,
		trayIconEmpty: null,
		trayIconExists: false,
		trayIconMode: "data-url",
		trayIconTemplate: null,
		trayObjectCreated: true,
	});
	assert.equal(createdTrays[0]?.tooltip, "TrayX: Demo");

	createdTrays[0]?.emit("click");
	assert.deepEqual(actions.calls, ["toggle"]);
});

void test("TrayService uses the absolute tray template path on macOS", () => {
	const createdInputs: Array<ElectronNativeImage | string> = [];
	class CapturingTray extends FakeTray {
		constructor(image: ElectronNativeImage | string) {
			super();
			createdInputs.push(image);
		}
	}

	const service = new TrayService(createRuntime("darwin", CapturingTray), "/tmp/trayx-plugin");

	const result = service.refresh({
		actions: createActions(),
		enabled: true,
		isOwner: true,
		toolTip: "TrayX: Demo",
	});

	assert.equal(result.ok, true);
	assert.equal(createdInputs[0], "/tmp/trayx-plugin/trayTemplate.png");
	assert.deepEqual(service.getSnapshot(), {
		resolvedTrayIconPath: "/tmp/trayx-plugin/trayTemplate.png",
		trayBounds: { height: 16, width: 16, x: 4, y: 8 },
		trayCreated: true,
		trayIconEmpty: null,
		trayIconExists: false,
		trayIconMode: "file-template",
		trayIconTemplate: true,
		trayObjectCreated: true,
	});
});

void test("TrayService keeps asset diagnostics when tray construction fails", () => {
	class ThrowingTray {
		constructor(image: ElectronNativeImage | string) {
			void image;
			throw new Error("tray failed");
		}
	}

	const service = new TrayService(createRuntime("darwin", ThrowingTray as never), "/tmp/trayx-plugin");

	const result = service.refresh({
		actions: createActions(),
		enabled: true,
		isOwner: true,
		toolTip: "TrayX: Demo",
	});

	assert.equal(result.ok, false);
	assert.equal(result.error?.message, "tray failed");
	assert.deepEqual(service.getSnapshot(), {
		resolvedTrayIconPath: "/tmp/trayx-plugin/trayTemplate.png",
		trayBounds: null,
		trayCreated: false,
		trayIconEmpty: null,
		trayIconExists: false,
		trayIconMode: "file-template",
		trayIconTemplate: true,
		trayObjectCreated: false,
	});

	service.destroy();
	assert.deepEqual(service.getSnapshot(), createEmptyTraySnapshot());
});
