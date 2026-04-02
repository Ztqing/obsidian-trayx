import {
	formatRuntimeFailureReason,
	type RuntimeFailureReasonDescriptor,
} from "../i18n";
import type {
	ElectronApp,
	ElectronBrowserWindowStatic,
	ElectronMenuStatic,
	ElectronNativeImageStatic,
	ElectronTrayConstructor,
	ElectronWindow,
	MainProcessBridgeKind,
	RuntimeDiagnostics,
} from "./electron";

export type DesktopPlatform = typeof process.platform;
export type UnknownFunction = (...args: unknown[]) => unknown;
export type CapabilitySource = "getBuiltin" | "missing" | "property" | "renderer-fallback";
export type RequiredCapabilityName =
	| "app"
	| "BrowserWindow"
	| "Menu"
	| "Tray"
	| "getCurrentWindow"
	| "nativeImage";

export interface RemoteBridgeNamespace extends Record<string, unknown> {
	getBuiltin?: UnknownFunction;
}

export interface AvailableBridgeProbeResult {
	available: true;
	app: ElectronApp;
	BrowserWindow: ElectronBrowserWindowStatic;
	currentWindow: ElectronWindow;
	diagnostics: RuntimeDiagnostics;
	Menu: ElectronMenuStatic;
	nativeImage: ElectronNativeImageStatic;
	Tray: ElectronTrayConstructor;
}

export interface UnavailableBridgeProbeResult {
	available: false;
	diagnostics: RuntimeDiagnostics;
}

export type BridgeProbeResult = AvailableBridgeProbeResult | UnavailableBridgeProbeResult;

export function asFunction(value: unknown): UnknownFunction | null {
	return typeof value === "function" ? (value as UnknownFunction) : null;
}

export function asObject(value: unknown): Record<string, unknown> | null {
	return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

export function readBridgeNamespace(value: unknown): Record<string, unknown> | null {
	return asObject(value);
}

export function readHostRemoteNamespace(value: unknown): Record<string, unknown> | null {
	const globalScope = asObject(value);
	if (!globalScope) {
		return null;
	}

	const electronNamespace = asObject(globalScope.electron);
	return electronNamespace ? asObject(electronNamespace.remote) : null;
}

export function readNativeImage(
	value: unknown,
	platform: DesktopPlatform,
): ElectronNativeImageStatic | undefined {
	return isElectronNativeImageStatic(value, platform) ? value : undefined;
}

export function readHostVersion(app: ElectronApp | undefined): string | undefined {
	if (!app || typeof app.getVersion !== "function") {
		return undefined;
	}

	try {
		return app.getVersion();
	} catch {
		return undefined;
	}
}

export function createDiagnostics(options: {
	bridgeKind: MainProcessBridgeKind;
	capabilitySources?: Partial<Record<RequiredCapabilityName, CapabilitySource>>;
	electronModuleLoaded: boolean;
	failureReason: string;
	failureReasonDescriptor?: RuntimeFailureReasonDescriptor;
	hostVersion?: string;
	missingCapabilities?: RequiredCapabilityName[];
	notes: string[];
	platform: DesktopPlatform;
}): RuntimeDiagnostics {
	return {
		bridgeKind: options.bridgeKind,
		capabilitySources: options.capabilitySources ?? {},
		electronModuleLoaded: options.electronModuleLoaded,
		failureReason: options.failureReason,
		failureReasonDescriptor: options.failureReasonDescriptor,
		hostVersion: options.hostVersion,
		missingCapabilities: options.missingCapabilities ?? [],
		notes: options.notes,
		platform: options.platform,
	};
}

export function createUnavailableProbe(
	bridgeKind: MainProcessBridgeKind,
	platform: DesktopPlatform,
	options: {
		failureReason: string;
		failureReasonDescriptor?: RuntimeFailureReasonDescriptor;
		notes: string[];
	},
): UnavailableBridgeProbeResult {
	return {
		available: false,
		diagnostics: createDiagnostics({
			bridgeKind,
			electronModuleLoaded: true,
			failureReason: options.failureReason,
			failureReasonDescriptor: options.failureReasonDescriptor,
			notes: options.notes,
			platform,
		}),
	};
}

export function chooseBestFailure(attempts: BridgeProbeResult[]): UnavailableBridgeProbeResult {
	const preferredAttempt =
		attempts.find(
			(attempt): attempt is UnavailableBridgeProbeResult =>
				!attempt.available &&
				attempt.diagnostics.notes.some((note) => isDisabledBridgeError(note)),
		) ??
		attempts.find(
			(attempt): attempt is UnavailableBridgeProbeResult =>
				!attempt.available && attempt.diagnostics.bridgeKind === "@electron/remote",
		) ??
		attempts.find(
			(attempt): attempt is UnavailableBridgeProbeResult => !attempt.available,
		);

	return preferredAttempt ?? createUnavailableProbe("none", process.platform, {
		failureReason: formatRuntimeFailureReason({
			key: "no-usable-main-process-bridge",
		}),
		failureReasonDescriptor: {
			key: "no-usable-main-process-bridge",
		},
		notes: [],
	});
}

export function pickAvailableBridge(
	attempts: BridgeProbeResult[],
): AvailableBridgeProbeResult | undefined {
	return attempts.find(
		(attempt): attempt is AvailableBridgeProbeResult => attempt.available,
	);
}

export function resolveNativeImageCapability(options: {
	capabilitySources: Partial<Record<RequiredCapabilityName, CapabilitySource>>;
	mainProcessNativeImage: ElectronNativeImageStatic | undefined;
	missingCapabilities: RequiredCapabilityName[];
	notes: string[];
	rendererNativeImage: ElectronNativeImageStatic | undefined;
}): ElectronNativeImageStatic | undefined {
	if (options.mainProcessNativeImage) {
		options.capabilitySources.nativeImage = "property";
		return options.mainProcessNativeImage;
	}

	if (options.rendererNativeImage) {
		options.capabilitySources.nativeImage = "renderer-fallback";
		return options.rendererNativeImage;
	}

	options.missingCapabilities.push("nativeImage");
	options.capabilitySources.nativeImage = "missing";
	options.notes.push(
		"nativeImage is missing from both the main-process bridge and the renderer Electron module.",
	);
	return undefined;
}

export function readCapability<T>(
	name: RequiredCapabilityName,
	namespace: Record<string, unknown>,
	validate: (value: unknown) => value is T,
	notes: string[],
	missingCapabilities: RequiredCapabilityName[],
	bridgeErrors: string[],
	capabilitySources: Partial<Record<RequiredCapabilityName, CapabilitySource>>,
): T | undefined {
	try {
		const value = namespace[name];
		if (validate(value)) {
			capabilitySources[name] = "property";
			return value;
		}
	} catch (error) {
		bridgeErrors.push(`${name}: ${toErrorMessage(error)}`);
	}

	missingCapabilities.push(name);
	capabilitySources[name] = "missing";
	notes.push(`${name} is not available on the selected bridge.`);
	return undefined;
}

export function readBridgeBuiltin<T>(
	name: Extract<RequiredCapabilityName, "BrowserWindow" | "Menu">,
	namespace: RemoteBridgeNamespace,
	validate: (value: unknown) => value is T,
	notes: string[],
	missingCapabilities: RequiredCapabilityName[],
	bridgeErrors: string[],
	capabilitySources: Partial<Record<RequiredCapabilityName, CapabilitySource>>,
): T | undefined {
	const getBuiltin = asFunction(namespace.getBuiltin);
	if (getBuiltin) {
		try {
			const builtin = getBuiltin(name);
			if (validate(builtin)) {
				capabilitySources[name] = "getBuiltin";
				return builtin;
			}
		} catch (error) {
			bridgeErrors.push(`getBuiltin(${name}): ${toErrorMessage(error)}`);
		}
	}

	return readCapability(
		name,
		namespace,
		validate,
		notes,
		missingCapabilities,
		bridgeErrors,
		capabilitySources,
	);
}

export function readCurrentWindow(
	namespace: RemoteBridgeNamespace,
	validateWindow: (value: unknown) => value is ElectronWindow,
	notes: string[],
	missingCapabilities: RequiredCapabilityName[],
	bridgeErrors: string[],
	capabilitySources: Partial<Record<RequiredCapabilityName, CapabilitySource>>,
): ElectronWindow | undefined {
	const getCurrentWindow = asFunction(namespace.getCurrentWindow);
	if (!getCurrentWindow) {
		missingCapabilities.push("getCurrentWindow");
		capabilitySources.getCurrentWindow = "missing";
		notes.push("getCurrentWindow is not available on the selected bridge.");
		return undefined;
	}

	try {
		const candidate = getCurrentWindow();
		if (validateWindow(candidate)) {
			capabilitySources.getCurrentWindow = "property";
			return candidate;
		}
	} catch (error) {
		bridgeErrors.push(`getCurrentWindow: ${toErrorMessage(error)}`);
	}

	missingCapabilities.push("getCurrentWindow");
	capabilitySources.getCurrentWindow = "missing";
	notes.push("getCurrentWindow did not return a usable BrowserWindow proxy.");
	return undefined;
}

export function isDisabledBridgeError(message: string): boolean {
	const normalized = message.toLowerCase();
	return (
		(normalized.includes("disabled") && normalized.includes("webcontents")) ||
		normalized.includes("blocked remote.") ||
		normalized.includes("blocked remote.get") ||
		(normalized.includes("access") &&
			normalized.includes("denied") &&
			normalized.includes("remote"))
	);
}

export function toErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}

	return String(error);
}

function isElectronNativeImageStatic(
	value: unknown,
	platform: DesktopPlatform,
): value is ElectronNativeImageStatic {
	return (
		typeof value === "object" &&
		value !== null &&
		(platform === "darwin"
			? typeof (value as ElectronNativeImageStatic).createFromPath === "function"
			: typeof (value as ElectronNativeImageStatic).createFromDataURL === "function")
	);
}
