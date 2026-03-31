import * as assert from "node:assert/strict";
import { test } from "node:test";

import type { AvailableDesktopRuntime } from "../src/runtime/electron";
import { TrayImageError, buildTrayImage } from "../src/tray/assets";
import { FakeApp } from "./helpers/fakes";

class FakeNativeImage {
	templateImage = false;
	lastResize:
		| { height?: number; quality?: "good" | "better" | "best"; width: number }
		| null = null;

	constructor(private readonly empty = false) {}

	isEmpty(): boolean {
		return this.empty;
	}

	resize(options: { height?: number; quality?: "good" | "better" | "best"; width: number }): FakeNativeImage {
		this.lastResize = options;
		return this;
	}

	setTemplateImage(isTemplate: boolean): void {
		this.templateImage = isTemplate;
	}

	isTemplateImage(): boolean {
		return this.templateImage;
	}
}

function createRuntime(platform: AvailableDesktopRuntime["platform"], nativeImageFactory?: FakeNativeImage) {
	const dataUrlImage = nativeImageFactory ?? new FakeNativeImage(false);
	const pathImage = nativeImageFactory ?? new FakeNativeImage(false);
	let lastDataUrl = "";
	let lastPath = "";

	return {
		runtime: {
			available: true,
			app: new FakeApp(),
			BrowserWindow: {
				getAllWindows: () => [],
			},
			currentWindow: {
				id: 1,
				blur(): void {},
				destroy(): void {},
				focus(): void {},
				hide(): void {},
				isFocused: () => false,
				isMaximized: () => false,
				isMinimized: () => false,
				isVisible: () => true,
				maximize(): void {},
				minimize(): void {},
				on(): void {},
				removeListener(): void {},
				restore(): void {},
				setSkipTaskbar(): void {},
				show(): void {},
				webContents: {
					on(): void {},
					removeListener(): void {},
				},
			},
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
				createFromDataURL: (dataUrl: string) => {
					lastDataUrl = dataUrl;
					return dataUrlImage;
				},
				createFromPath: (assetPath: string) => {
					lastPath = assetPath;
					return pathImage;
				},
			},
			platform,
			Tray: class {
				destroy(): void {}
				on(): void {}
				popUpContextMenu(): void {}
				removeListener(): void {}
				setToolTip(): void {}
			},
		} satisfies AvailableDesktopRuntime,
		getLastDataUrl: () => lastDataUrl,
		getLastPath: () => lastPath,
		pathImage,
	};
}

void test("buildTrayImage resolves the macOS asset path and marks template images", () => {
	const { runtime, getLastPath, pathImage } = createRuntime("darwin");

	const result = buildTrayImage(runtime, "/tmp/trayx-plugin", () => true);

	assert.equal(result.snapshot.trayIconMode, "file-template");
	assert.equal(result.snapshot.resolvedTrayIconPath, "/tmp/trayx-plugin/trayTemplate.png");
	assert.equal(result.snapshot.trayIconExists, true);
	assert.equal(result.snapshot.trayIconEmpty, false);
	assert.equal(result.snapshot.trayIconTemplate, true);
	assert.equal(result.trayInput, "/tmp/trayx-plugin/trayTemplate.png");
	assert.equal(getLastPath(), "/tmp/trayx-plugin/trayTemplate.png");
	assert.equal(pathImage.templateImage, true);
});

void test("buildTrayImage uses a resized data-url icon on non-macOS platforms", () => {
	const { runtime, getLastDataUrl } = createRuntime("win32");

	const result = buildTrayImage(runtime, "/tmp/trayx-plugin");

	assert.equal(result.snapshot.trayIconMode, "data-url");
	assert.equal(result.trayInput, result.image);
	assert.match(getLastDataUrl(), /^data:image\/svg\+xml;base64,/);
});

void test("buildTrayImage preserves asset diagnostics when the macOS icon is empty", () => {
	const { runtime } = createRuntime("darwin", new FakeNativeImage(true));

	assert.throws(
		() => buildTrayImage(runtime, "/tmp/trayx-plugin", () => false),
		(error: unknown) => {
			assert.ok(error instanceof TrayImageError);
			assert.equal(error.snapshot.resolvedTrayIconPath, "/tmp/trayx-plugin/trayTemplate.png");
			assert.equal(error.snapshot.trayIconExists, false);
			assert.equal(error.snapshot.trayIconEmpty, true);
			assert.equal(error.snapshot.trayIconTemplate, false);
			return true;
		},
	);
});
