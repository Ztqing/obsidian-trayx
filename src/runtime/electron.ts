import {
	formatRuntimeFailureReason,
	type RuntimeFailureReasonDescriptor,
} from "../i18n";
import {
	type BridgeProbeResult,
	type CapabilitySource,
	type DesktopPlatform,
	type RemoteBridgeNamespace,
	type RequiredCapabilityName,
	chooseBestFailure,
	createDiagnostics,
	createUnavailableProbe,
	isDisabledBridgeError,
	pickAvailableBridge,
	readBridgeBuiltin,
	readBridgeNamespace,
	readCapability,
	readCurrentWindow,
	readHostRemoteNamespace,
	readHostVersion,
	readOptionalBridgeBuiltin,
	readNativeImage,
	resolveNativeImageCapability,
	toErrorMessage,
} from "./probe-helpers";

export interface ElectronEventEmitter {
	on(eventName: string, listener: (...args: unknown[]) => void): void;
	once?(eventName: string, listener: (...args: unknown[]) => void): void;
	removeListener(eventName: string, listener: (...args: unknown[]) => void): void;
}

export type ElectronWebContents = ElectronEventEmitter;

export interface ElectronWindow extends ElectronEventEmitter {
	id: number;
	webContents: ElectronWebContents;
	blur(): void;
	destroy(): void;
	focus(): void;
	hide(): void;
	isFullScreen?(): boolean;
	isDestroyed?(): boolean;
	isFocused(): boolean;
	isMaximized(): boolean;
	isMinimized(): boolean;
	isSimpleFullScreen?(): boolean;
	isVisible(): boolean;
	maximize(): void;
	minimize(): void;
	restore(): void;
	setFullScreen?(fullScreen: boolean): void;
	setSimpleFullScreen?(fullScreen: boolean): void;
	setSkipTaskbar(skip: boolean): void;
	show(): void;
}

export interface ElectronAppDock {
	hide(): void;
	show(): void;
}

export interface ElectronApp {
	dock?: ElectronAppDock;
	exit(exitCode?: number): void;
	getVersion?(): string;
	hide?(): void;
	isHidden?(): boolean;
	on?(eventName: string, listener: (...args: unknown[]) => void): void;
	quit(): void;
	relaunch(): void;
	removeListener?(eventName: string, listener: (...args: unknown[]) => void): void;
	setLoginItemSettings(settings: LoginItemSettings): void;
	show?(): void;
}

export interface LoginItemSettings {
	openAtLogin: boolean;
	openAsHidden?: boolean;
}

export interface ElectronNativeImage {
	addRepresentation?(options: {
		buffer?: Buffer;
		dataURL?: string;
		height?: number;
		scaleFactor?: number;
		width?: number;
	}): void;
	isEmpty?(): boolean;
	isTemplateImage?(): boolean;
	resize(options: { height?: number; quality?: "good" | "better" | "best"; width: number }): ElectronNativeImage;
	setTemplateImage(isTemplate: boolean): void;
}

export interface ElectronNativeImageStatic {
	createFromDataURL(dataUrl: string): ElectronNativeImage;
	createFromPath?(path: string): ElectronNativeImage;
}

export interface MenuItemConstructorOptions {
	click?: () => void;
	label?: string;
	type?: "normal" | "separator";
}

export type ElectronMenu = Record<string, unknown>;

export interface ElectronMenuStatic {
	buildFromTemplate(template: MenuItemConstructorOptions[]): ElectronMenu;
}

export interface ElectronTray extends ElectronEventEmitter {
	destroy(): void;
	getBounds?(): { height: number; width: number; x: number; y: number };
	popUpContextMenu(menu?: ElectronMenu): void;
	setContextMenu?(menu: ElectronMenu): void;
	setToolTip(toolTip: string): void;
}

export interface ElectronTrayConstructor {
	new (image: ElectronNativeImage | string): ElectronTray;
}

export interface ElectronBrowserWindowStatic {
	getAllWindows(): ElectronWindow[];
}

export type MainProcessBridgeKind =
	| "@electron/remote"
	| "electron.remote"
	| "host.remote"
	| "none";

export interface RuntimeDiagnostics {
	bridgeKind: MainProcessBridgeKind;
	capabilitySources: Partial<Record<RequiredCapabilityName, CapabilitySource>>;
	electronModuleLoaded: boolean;
	failureReason: string;
	failureReasonDescriptor?: RuntimeFailureReasonDescriptor;
	hostVersion?: string;
	missingCapabilities: string[];
	notes: string[];
	platform: DesktopPlatform;
}

export interface AvailableDesktopRuntime {
	available: true;
	app: ElectronApp;
	BrowserWindow: ElectronBrowserWindowStatic;
	currentWindow: ElectronWindow;
	diagnostics: RuntimeDiagnostics;
	Menu: ElectronMenuStatic;
	nativeImage: ElectronNativeImageStatic;
	platform: DesktopPlatform;
	Tray: ElectronTrayConstructor;
}

export interface UnavailableDesktopRuntime {
	available: false;
	diagnostics: RuntimeDiagnostics;
	platform: DesktopPlatform;
	reason: string;
}

export type DesktopRuntime = AvailableDesktopRuntime | UnavailableDesktopRuntime;

interface ElectronModule extends Record<string, unknown> {
	remote?: Record<string, unknown>;
}

export interface DesktopRuntimeEnvironment {
	globalScope?: unknown;
	isDesktopApp?: () => boolean;
	loadModule?: (moduleName: string) => unknown;
	logWarn?: (...args: unknown[]) => void;
	platform?: DesktopPlatform;
}

interface ResolvedDesktopRuntimeEnvironment {
	globalScope: unknown;
	isDesktopApp: () => boolean;
	loadModule: (moduleName: string) => unknown;
	logWarn: (...args: unknown[]) => void;
	platform: DesktopPlatform;
}

export function createDesktopRuntime(
	environment: DesktopRuntimeEnvironment = {},
): DesktopRuntime {
	const resolvedEnvironment = resolveRuntimeEnvironment(environment);
	const { platform } = resolvedEnvironment;

	if (!resolvedEnvironment.isDesktopApp()) {
		return createUnavailableRuntimeResult(platform, {
			electronModuleLoaded: false,
			failureReasonDescriptor: {
				key: "desktop-only",
			},
			notes: [],
		});
	}

	const electronLoad = loadElectronModule(resolvedEnvironment);
	if (!electronLoad.ok) {
		return createUnavailableRuntimeResult(platform, {
			electronModuleLoaded: false,
			failureReasonDescriptor: {
				key: "electron-load-failed",
			},
			notes: [electronLoad.error],
		});
	}

	const attempts = buildBridgeAttempts({
		electron: electronLoad.module,
		environment: resolvedEnvironment,
		platform,
	});
	const availableBridge = pickAvailableBridge(attempts);

	if (availableBridge) {
		return {
			available: true,
			app: availableBridge.app,
			BrowserWindow: availableBridge.BrowserWindow,
			currentWindow: availableBridge.currentWindow,
			diagnostics: availableBridge.diagnostics,
			Menu: availableBridge.Menu,
			nativeImage: availableBridge.nativeImage,
			platform,
			Tray: availableBridge.Tray,
		};
	}

	const failure = chooseBestFailure(attempts);
	resolvedEnvironment.logWarn("[TrayX] Runtime bridge unavailable.", failure.diagnostics);

	return {
		available: false,
		diagnostics: failure.diagnostics,
		platform,
		reason: failure.diagnostics.failureReason,
	};
}

function probeElectronRemotePackage(
	environment: ResolvedDesktopRuntimeEnvironment,
	platform: DesktopPlatform,
	rendererNativeImage: ElectronNativeImageStatic | undefined,
): BridgeProbeResult {
	const remoteLoad = loadOptionalModule(environment, "@electron/remote");
	if (!remoteLoad.ok) {
		const failureReasonDescriptor: RuntimeFailureReasonDescriptor = {
			key: "remote-package-unavailable",
		};
		return createUnavailableProbe("@electron/remote", platform, {
			failureReason: formatRuntimeFailureReason(failureReasonDescriptor),
			failureReasonDescriptor,
			notes: [remoteLoad.error],
		});
	}

	return probeNamedBridge(
		"@electron/remote",
		platform,
		readBridgeNamespace(remoteLoad.module),
		rendererNativeImage,
	);
}

function probeNamedBridge(
	bridgeKind: Exclude<MainProcessBridgeKind, "none">,
	platform: DesktopPlatform,
	namespace: Record<string, unknown> | null,
	rendererNativeImage: ElectronNativeImageStatic | undefined,
): BridgeProbeResult {
	if (!namespace) {
		const failureReasonDescriptor: RuntimeFailureReasonDescriptor = {
			bridgeKind,
			key: "named-bridge-unavailable",
		};
		return createUnavailableProbe(bridgeKind, platform, {
			failureReason: formatRuntimeFailureReason(failureReasonDescriptor),
			failureReasonDescriptor,
			notes: [`${bridgeKind} is missing.`],
		});
	}

	const notes: string[] = [];
	const missingCapabilities: RequiredCapabilityName[] = [];
	const bridgeErrors: string[] = [];
	const capabilitySources: Partial<Record<RequiredCapabilityName, CapabilitySource>> = {};
	const bridge = namespace as RemoteBridgeNamespace;
	const app = readCapability(
		"app",
		namespace,
		(value): value is ElectronApp => isElectronApp(value),
		notes,
		missingCapabilities,
		bridgeErrors,
		capabilitySources,
	);
	const BrowserWindow = readBridgeBuiltin(
		"BrowserWindow",
		bridge,
		(value): value is ElectronBrowserWindowStatic => isElectronBrowserWindowStatic(value),
		notes,
		missingCapabilities,
		bridgeErrors,
		capabilitySources,
	);
	const Menu = readBridgeBuiltin(
		"Menu",
		bridge,
		(value): value is ElectronMenuStatic => isElectronMenuStatic(value),
		notes,
		missingCapabilities,
		bridgeErrors,
		capabilitySources,
	);
	const Tray = readCapability(
		"Tray",
		namespace,
		(value): value is ElectronTrayConstructor => isElectronTrayConstructor(value),
		notes,
		missingCapabilities,
		bridgeErrors,
		capabilitySources,
	);
	const currentWindow = readCurrentWindow(
		bridge,
		(value): value is ElectronWindow => isElectronWindow(value),
		notes,
		missingCapabilities,
		bridgeErrors,
		capabilitySources,
	);
	const nativeImage = resolveNativeImageCapability({
		capabilitySources,
		mainProcessNativeImage: readOptionalBridgeBuiltin(
			"nativeImage",
			bridge,
			(value): value is ElectronNativeImageStatic => readNativeImage(value) !== undefined,
			bridgeErrors,
			capabilitySources,
		),
		missingCapabilities,
		notes,
		rendererNativeImage,
	});

	const hostVersion = readHostVersion(app);
	const disabledBridge = bridgeErrors.some((message) => isDisabledBridgeError(message));
	if (!app || !BrowserWindow || !Menu || !Tray || !currentWindow || !nativeImage) {
		const failureReasonDescriptor: RuntimeFailureReasonDescriptor = {
			bridgeKind,
			key: disabledBridge ? "bridge-disabled" : "bridge-missing-capabilities",
			missingCapabilities,
		};

		return {
			available: false,
			diagnostics: createDiagnostics({
				bridgeKind,
				capabilitySources,
				electronModuleLoaded: true,
				failureReason: formatRuntimeFailureReason(failureReasonDescriptor),
				failureReasonDescriptor,
				hostVersion,
				missingCapabilities,
				notes: [...notes, ...bridgeErrors],
				platform,
			}),
		};
	}

	return {
		available: true,
		app,
		BrowserWindow,
		currentWindow,
		diagnostics: createDiagnostics({
			bridgeKind,
			capabilitySources,
			electronModuleLoaded: true,
			failureReason: formatRuntimeFailureReason({ bridgeKind, key: "using-bridge" }),
			failureReasonDescriptor: { bridgeKind, key: "using-bridge" },
			hostVersion,
			missingCapabilities,
			notes,
			platform,
		}),
		Menu,
		nativeImage,
		Tray,
	};
}

function buildBridgeAttempts(options: {
	electron: ElectronModule;
	environment: ResolvedDesktopRuntimeEnvironment;
	platform: DesktopPlatform;
}): BridgeProbeResult[] {
	const rendererNativeImage = readNativeImage(options.electron.nativeImage);
	return [
		probeElectronRemotePackage(options.environment, options.platform, rendererNativeImage),
		probeNamedBridge(
			"electron.remote",
			options.platform,
			readBridgeNamespace(options.electron.remote),
			rendererNativeImage,
		),
		probeNamedBridge(
			"host.remote",
			options.platform,
			readHostRemoteNamespace(options.environment.globalScope),
			rendererNativeImage,
		),
	];
}

function createUnavailableRuntimeResult(
	platform: DesktopPlatform,
	options: {
		electronModuleLoaded: boolean;
		failureReasonDescriptor: RuntimeFailureReasonDescriptor;
		notes: string[];
	},
): UnavailableDesktopRuntime {
	const diagnostics = createDiagnostics({
		bridgeKind: "none",
		electronModuleLoaded: options.electronModuleLoaded,
		failureReason: formatRuntimeFailureReason(options.failureReasonDescriptor),
		failureReasonDescriptor: options.failureReasonDescriptor,
		notes: options.notes,
		platform,
	});
	return {
		available: false,
		diagnostics,
		platform,
		reason: diagnostics.failureReason,
	};
}

function loadElectronModule(
	environment: ResolvedDesktopRuntimeEnvironment,
): { ok: true; module: ElectronModule } | { error: string; ok: false } {
	try {
		return { ok: true, module: environment.loadModule("electron") as ElectronModule };
	} catch (error) {
		return { error: toErrorMessage(error), ok: false };
	}
}

function detectDesktopApp(): boolean {
	try {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const obsidian = require("obsidian") as {
			Platform?: {
				isDesktopApp?: boolean;
			};
		};
		return Boolean(obsidian.Platform?.isDesktopApp);
	} catch {
		return false;
	}
}

function loadOptionalModule(
	environment: ResolvedDesktopRuntimeEnvironment,
	moduleName: string,
): { ok: true; module: unknown } | { error: string; ok: false } {
	try {
		return { ok: true, module: environment.loadModule(moduleName) };
	} catch (error) {
		return { error: `${moduleName}: ${toErrorMessage(error)}`, ok: false };
	}
}

function resolveRuntimeEnvironment(
	environment: DesktopRuntimeEnvironment,
): ResolvedDesktopRuntimeEnvironment {
	return {
		globalScope: environment.globalScope ?? globalThis,
		isDesktopApp: environment.isDesktopApp ?? detectDesktopApp,
		loadModule: environment.loadModule ?? loadRequiredModule,
		logWarn: environment.logWarn ?? ((...args) => console.warn(...args)),
		platform: environment.platform ?? process.platform,
	};
}

function loadRequiredModule(moduleName: string): unknown {
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	return require(moduleName);
}

function isElectronWindow(value: unknown): value is ElectronWindow {
	return (
		typeof value === "object" &&
		value !== null &&
		typeof (value as ElectronWindow).id === "number" &&
		typeof (value as ElectronWindow).blur === "function" &&
		typeof (value as ElectronWindow).focus === "function" &&
		typeof (value as ElectronWindow).show === "function" &&
		typeof (value as ElectronWindow).hide === "function" &&
		typeof (value as ElectronWindow).minimize === "function" &&
		typeof (value as ElectronWindow).restore === "function" &&
		typeof (value as ElectronWindow).maximize === "function" &&
		typeof (value as ElectronWindow).isFocused === "function" &&
		typeof (value as ElectronWindow).isVisible === "function" &&
		typeof (value as ElectronWindow).isMinimized === "function" &&
		typeof (value as ElectronWindow).isMaximized === "function" &&
		typeof (value as ElectronWindow).setSkipTaskbar === "function" &&
		typeof (value as ElectronWindow).on === "function" &&
		typeof (value as ElectronWindow).removeListener === "function" &&
		typeof (value as ElectronWindow).destroy === "function" &&
		isElectronWebContents((value as ElectronWindow).webContents)
	);
}

function isElectronWebContents(value: unknown): value is ElectronWebContents {
	return (
		typeof value === "object" &&
		value !== null &&
		typeof (value as ElectronWebContents).on === "function" &&
		typeof (value as ElectronWebContents).removeListener === "function"
	);
}

function isElectronApp(value: unknown): value is ElectronApp {
	return (
		typeof value === "object" &&
		value !== null &&
		typeof (value as ElectronApp).exit === "function" &&
		typeof (value as ElectronApp).quit === "function" &&
		typeof (value as ElectronApp).relaunch === "function" &&
		typeof (value as ElectronApp).setLoginItemSettings === "function"
	);
}

function isElectronBrowserWindowStatic(value: unknown): value is ElectronBrowserWindowStatic {
	return (
		(typeof value === "object" || typeof value === "function") &&
		value !== null &&
		typeof (value as ElectronBrowserWindowStatic).getAllWindows === "function"
	);
}

function isElectronMenuStatic(value: unknown): value is ElectronMenuStatic {
	return (
		(typeof value === "object" || typeof value === "function") &&
		value !== null &&
		typeof (value as ElectronMenuStatic).buildFromTemplate === "function"
	);
}

function isElectronTrayConstructor(value: unknown): value is ElectronTrayConstructor {
	return typeof value === "function";
}
