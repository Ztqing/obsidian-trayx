import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import * as path from "path";

import type { AvailableDesktopRuntime, ElectronNativeImage } from "../runtime/electron";

const MACOS_TRAY_ICON_BASE64 =
	"iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAABC0lEQVR42mNgwA+0gHgaA5nAHIgfAPF/IDYhVbMnEL+Baj4NxKVA3EWs5gAg/grVDMJ5QHwMyg4hxoCdSJrvAHESEP+D8h8DsSAhA64gGbAYiGcg8b8DsRI+zRxAnAHEv6AaeoB4C5IBfwkFaBYQTwLiXqiGuVBX/EfChbg0swHxeah/o4D4PtT2KKQYAeG7QCyEzQAfJEUrgdgSiLOBOBOI44G4Fil2ZhAK/RtQzTD+byCeCcRpUP5CbAbMQ9LwCBoe/9FwCxC34YoJHiDeAFUISjiVWAx4D8RS+GIBZMgeIG4C4kNYDAAlJAFCCYkbiPWBeBUQHwXiV0gGrCMnV4oDsRcQrwViDXRJAMiJYFc6hS8nAAAAAElFTkSuQmCC";
const MACOS_TRAY_ICON_2X_BASE64 =
	"iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAACVElEQVR42sWXXyieURzH36uh1BCFJmpKYhKu/Ll0YaVsaa3FDcsi5V/KxrK1i5Wi1LJabFltartZrZZGrmSrRShJrEUIycXLGhK+p77q9HSec57nfZ733anPxfM+5/19v8/v/M6/QMBbSwNfwZPAf2iFYBVcgL/gViTFy8Euxa+oj5T4fXBoEReUgtugNpzizeBUIb7C929BMFzD8VwhfEUTSAD7fJ4D8X4JR4Ehjfgf9rEa/OCXgQaNuKAdXFcUpaDTDwMfNeIHTHWHzftjkO/VwIzGwGf2WdT08TQ9RWo3NcHrQBY40/Rp9GIglWm2C14AHhhq5LHXIagC/xSBT7kXdBkMvPIiXgaiwSObArsBug0GJkIVF8JrYJTP7yyBz0EOi0xnQEzPxFAM3JWC1LIgNyzBq0GRwUDIM2FKCrDDpfahJfAbroKbBgPLINaNeIliavXx3TqfT8AP/vaSm5DOxFM3BsYUAfaYhTvgHkgHMdJ/kkAl+ML6sP7/iMNlbFk84ai+okY6DbWBER7JPoFeSaBCUS+CWSdDMaBJ4zC4BrZt3p8zAykgE/x2OyMSNMEvuC+I9tMw3uKsmMFMyaenFtPXJxuKaYn9xh1MvV/s2yWZj3JSAy80QRfZZ9KBAUEPh2weFLuZBYM2AccdbL8y+8xqeigL0WtFwGesk6BDA55PRSNSILEw5VqWaCe0et2O3zPQdz5/cyEuFp+bfpyKR1lEZS6/fsHvu4GogWkW4RbPBDoDY+G8JcWBbF7VhmhKvjUFmbGINTHf80A/zTjaeC4BjPSbsTqzwkgAAAAASUVORK5CYII=";
const MACOS_TRAY_ICON_DATA_URL = `data:image/png;base64,${MACOS_TRAY_ICON_BASE64}`;
const MACOS_TRAY_ICON_FILENAME = "trayTemplate.png";
const MACOS_TRAY_ICON_RETINA_FILENAME = "trayTemplate@2x.png";

const WINDOWS_TRAY_ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 1024 1024">
	<path d="M825.683285 791.051243a2941.372556 2941.031364 0 0 0 79.241815-125.985102 34.545678 34.545678 0 0 0-2.644237-38.384086c-22.006876-29.214555-64.144074-88.496644-87.089228-143.385888-23.584889-56.339309-27.124755-143.940325-27.29535-186.674608a72.801818 72.801818 0 0 0-15.268337-44.781434l-136.391454-173.325476a159.6778 159.6778 0 0 1-3.241323 23.158399c-4.520792 21.45244-13.093238 42.819581-22.859856 63.973478-5.714964 12.368206-12.368206 25.589391-19.021448 38.981172l-13.221185 26.698265c-22.006876 45.549116-42.521038 94.97929-48.278651 153.109856-5.288474 53.737721 1.961853 116.431729 34.758923 191.110103 5.45907 0.469139 10.960789 1.066225 16.462508 1.876555a271.375492 271.375492 0 0 1 141.850524 64.186723c39.06647 33.692698 74.37983 81.971349 102.997299 149.271447zM349.891208 962.969302c3.113376 0.511788 6.226752 0.85298 9.382776 0.85298 33.266208 1.023576 89.349624 3.923707 134.770793 12.368206 37.104617 6.823838 110.588818 27.29535 171.022431 44.994679 46.188851 13.477079 93.742469-23.371644 100.438359-70.967911 4.861984-34.716274 14.074165-73.995989 30.920515-110.034382l-0.42649 0.213245c-28.57482-79.753602-64.911755-131.273576-103.039948-164.155944a225.826376 225.826376 0 0 0-118.478881-53.609774c-65.679437-9.212181-125.899804 8.103307-163.772103 19.192043 22.68926 94.595449 15.694827 205.951949-60.774803 321.189507zM236.189013 424.269971c-0.980927 4.264899-2.388343 8.40185-4.1796 12.368206L120.482317 685.324409a68.323674 68.323674 0 0 0 13.349132 75.574002l175.543223 180.831697c89.690816-132.254503 76.597577-256.74689 35.654551-353.986577-31.048461-73.782744-78.132941-131.401523-108.754912-163.388262zM397.70072 597.936639c26.229126-7.804764 68.49427-19.831778 117.071464-22.774558-29.129257-73.569499-36.166339-137.884169-30.536673-195.204405 6.567944-66.191225 29.85429-121.421661 52.671496-168.463491 4.819335-10.022512 9.510724-19.362639 13.988867-28.318926 6.354699-12.666749 12.282908-24.608464 17.869925-36.678128 9.25483-20.045023 16.163965-37.744352 19.618533-54.164211 3.411919-16.206614 3.411919-30.707269-0.597085-44.482891-4.051654-13.86092-12.666749-28.788065-29.00131-45.207924a68.238376 68.238376 0 0 0-62.907253 15.353634l-211.112477 189.873282a68.323674 68.323674 0 0 0-21.878929 40.601834l-18.211117 120.696628c28.660118 25.162901 99.286837 98.77505 142.234366 200.919368 3.838409 8.956287 7.463572 18.339064 10.790193 27.849788z" fill="#000000"/>
</svg>
`;

export type TrayIconMode = "data-url" | "generated-template-path" | "none";

export interface TrayAssetSnapshot {
	resolvedTrayIconPath: string | null;
	trayIconEmpty: boolean | null;
	trayIconExists: boolean;
	trayIconMode: TrayIconMode;
	trayIconTemplate: boolean | null;
}

export interface TrayImageResult {
	image: ElectronNativeImage;
	trayInput: ElectronNativeImage | string;
	snapshot: TrayAssetSnapshot;
}

export class TrayImageError extends Error {
	constructor(
		message: string,
		readonly snapshot: TrayAssetSnapshot,
	) {
		super(message);
		this.name = "TrayImageError";
	}
}

export function createEmptyTrayAssetSnapshot(): TrayAssetSnapshot {
	return {
		resolvedTrayIconPath: null,
		trayIconEmpty: null,
		trayIconExists: false,
		trayIconMode: "none",
		trayIconTemplate: null,
	};
}

export function buildTrayImage(
	runtime: AvailableDesktopRuntime,
	pluginDir: string,
): TrayImageResult {
	if (runtime.platform === "darwin") {
		const trayIconPath = ensureMacOsTrayIconPath(pluginDir);
		const icon =
			runtime.nativeImage.createFromPath?.(trayIconPath) ??
			runtime.nativeImage.createFromDataURL(MACOS_TRAY_ICON_DATA_URL);
		const snapshotBeforeTemplate: TrayAssetSnapshot = {
			resolvedTrayIconPath: trayIconPath,
			trayIconEmpty: icon.isEmpty?.() ?? null,
			trayIconExists: existsSync(trayIconPath),
			trayIconMode: "generated-template-path",
			trayIconTemplate: true,
		};
		if (snapshotBeforeTemplate.trayIconEmpty) {
			throw new TrayImageError("Generated tray template image is empty.", snapshotBeforeTemplate);
		}

		icon.setTemplateImage(true);
		const snapshot: TrayAssetSnapshot = {
			...snapshotBeforeTemplate,
			trayIconTemplate: icon.isTemplateImage?.() ?? true,
		};
		return { image: icon, trayInput: trayIconPath, snapshot };
	}

	const image = runtime.nativeImage
		.createFromDataURL(toDataUrl(WINDOWS_TRAY_ICON_SVG))
		.resize({ width: 16, height: 16, quality: "best" });

	return {
		image,
		trayInput: image,
		snapshot: {
			...createEmptyTrayAssetSnapshot(),
			trayIconExists: true,
			trayIconMode: "data-url",
		},
	};
}

function toDataUrl(svg: string): string {
	return `data:image/svg+xml;base64,${Buffer.from(svg.trim()).toString("base64")}`;
}

function ensureMacOsTrayIconPath(pluginDir: string): string {
	const runtimeDir = path.join(
		tmpdir(),
		"trayx-runtime",
		createHash("sha1").update(pluginDir).digest("hex").slice(0, 12),
	);
	const trayIconPath = path.join(runtimeDir, MACOS_TRAY_ICON_FILENAME);
	const retinaTrayIconPath = path.join(runtimeDir, MACOS_TRAY_ICON_RETINA_FILENAME);

	mkdirSync(runtimeDir, { recursive: true });
	writeBase64IfNeeded(trayIconPath, MACOS_TRAY_ICON_BASE64);
	writeBase64IfNeeded(retinaTrayIconPath, MACOS_TRAY_ICON_2X_BASE64);

	return trayIconPath;
}

function writeBase64IfNeeded(filePath: string, base64: string): void {
	const buffer = Buffer.from(base64, "base64");

	if (existsSync(filePath)) {
		const existing = readFileSync(filePath);
		if (existing.equals(buffer)) {
			return;
		}
	}

	writeFileSync(filePath, buffer);
}
