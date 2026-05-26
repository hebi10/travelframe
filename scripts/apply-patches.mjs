import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

const expoCameraRoot = path.join(root, "node_modules", "expo-camera");
const reactNativeVisionCameraRoot = path.join(
  root,
  "node_modules",
  "react-native-vision-camera"
);
const packageJson = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8")
);

function readFrom(packageRoot, relativePath) {
  return fs.readFileSync(path.join(packageRoot, relativePath), "utf8");
}

function writeTo(packageRoot, relativePath, source) {
  fs.writeFileSync(path.join(packageRoot, relativePath), source);
}

function read(relativePath) {
  return readFrom(expoCameraRoot, relativePath);
}

function write(relativePath, source) {
  writeTo(expoCameraRoot, relativePath, source);
}

function insertAfter(source, anchor, insertion) {
  if (source.includes(insertion.trim())) {
    return source;
  }

  const index = source.indexOf(anchor);
  if (index < 0) {
    throw new Error(`Patch anchor not found: ${anchor}`);
  }

  return `${source.slice(0, index + anchor.length)}${insertion}${source.slice(
    index + anchor.length
  )}`;
}

function replaceOnce(source, search, replacement) {
  if (source.includes(replacement.trim())) {
    return source;
  }

  if (!source.includes(search)) {
    throw new Error(`Patch search block not found: ${search.slice(0, 80)}`);
  }

  return source.replace(search, replacement);
}

function replaceIfFound(source, search, replacement) {
  if (source.includes(replacement.trim())) {
    return source;
  }

  if (!source.includes(search)) {
    return source;
  }

  return source.replace(search, replacement);
}

function patchCameraViewModule() {
  const relativePath = "android/src/main/java/expo/modules/camera/CameraViewModule.kt";
  let source = read(relativePath);

  source = insertAfter(
    source,
    "import expo.modules.camera.records.CameraMode\n",
    "import expo.modules.camera.records.CameraFocusPoint\n"
  );

  source = insertAfter(
    source,
    `      Prop("zoom") { view, zoom: Float? ->
        zoom?.let {
          if (view.zoom != it) {
            view.zoom = it
          }
        } ?: run {
          if (view.zoom != 0f) {
            view.zoom = 0f
          }
        }
      }
`,
    `
      Prop("selectedLens") { view, selectedLens: String? ->
        if (view.selectedLens != selectedLens) {
          view.selectedLens = selectedLens
        }
      }
`
  );

  source = insertAfter(
    source,
    `      Prop("autoFocus") { view, autoFocus: FocusMode? ->
        autoFocus?.let {
          if (view.autoFocus != it) {
            view.autoFocus = it
          }
        } ?: run {
          if (view.autoFocus != FocusMode.OFF) {
            view.autoFocus = FocusMode.OFF
          }
        }
      }
`,
    `
      Prop("focusPoint") { view, focusPoint: CameraFocusPoint? ->
        view.focusPoint = focusPoint
      }

      Prop("focusLocked") { view, focusLocked: Boolean? ->
        view.focusLocked = focusLocked ?: false
      }

      Prop("exposureBias") { view, exposureBias: Float? ->
        view.exposureBias = exposureBias ?: 0f
      }
`
  );

  source = insertAfter(
    source,
    `      Prop("focusPoint") { view, focusPoint: CameraFocusPoint? ->
        view.focusPoint = focusPoint
      }
`,
    `
      Prop("focusLocked") { view, focusLocked: Boolean? ->
        view.focusLocked = focusLocked ?: false
      }
`
  );

  source = insertAfter(
    source,
    `      AsyncFunction("getAvailablePictureSizes") { view: ExpoCameraView ->
        return@AsyncFunction view.getAvailablePictureSizes()
      }
`,
    `
      AsyncFunction("getAvailableLenses") { view: ExpoCameraView ->
        return@AsyncFunction view.getAvailableLenses()
      }
`
  );

  source = insertAfter(
    source,
    `      AsyncFunction("getAvailableLenses") { view: ExpoCameraView ->
        return@AsyncFunction view.getAvailableLenses()
      }
`,
    `
      AsyncFunction("focusAtPoint") { view: ExpoCameraView, x: Float, y: Float, locked: Boolean ->
        view.focusAtPoint(x, y, locked)
      }

      AsyncFunction("setFocusLocked") { view: ExpoCameraView, locked: Boolean ->
        view.focusLocked = locked
      }

      AsyncFunction("setExposureBias") { view: ExpoCameraView, exposureBias: Float ->
        view.exposureBias = exposureBias
      }
`
  );

  write(relativePath, source);
}

function patchExpoCameraView() {
  const relativePath = "android/src/main/java/expo/modules/camera/ExpoCameraView.kt";
  let source = read(relativePath);

  source = insertAfter(
    source,
    "import expo.modules.camera.records.CameraMode\n",
    "import expo.modules.camera.records.CameraFocusPoint\n"
  );
  source = replaceIfFound(
    source,
    "import androidx.camera.core.DisplayOrientedMeteringPointFactory\n",
    ""
  );

  source = insertAfter(
    source,
    `const val ANIMATION_SLOW_MILLIS = 100L
`,
    `const val CAMERA_LENS_ULTRA_WIDE = "builtInUltraWideCamera"
const val CAMERA_LENS_WIDE = "builtInWideAngleCamera"
`
  );

  source = insertAfter(
    source,
    `  var autoFocus: FocusMode = FocusMode.OFF
    set(value) {
      field = value
      camera?.cameraControl?.let {
        if (field == FocusMode.OFF) {
          it.cancelFocusAndMetering()
        } else {
          startFocusMetering()
        }
      }
    }
`,
    `
  var focusPoint: CameraFocusPoint? = null
    set(value) {
      field = value
      value?.let {
        startFocusMetering(it)
      }
    }

  var focusLocked: Boolean = false
    set(value) {
      field = value
      focusPoint?.let {
        startFocusMetering(it)
      }
    }

  var exposureBias: Float = 0f
    set(value) {
      field = value
      setCameraExposureBias(value)
    }
`
  );

  source = insertAfter(
    source,
    `  var focusPoint: CameraFocusPoint? = null
    set(value) {
      field = value
      value?.let {
        startFocusMetering(it)
      }
    }
`,
    `
  var focusLocked: Boolean = false
    set(value) {
      field = value
      focusPoint?.let {
        startFocusMetering(it)
      }
    }
`
  );

  source = insertAfter(
    source,
    `  var exposureBias: Float = 0f
    set(value) {
      field = value
      setCameraExposureBias(value)
    }
`,
    `
  fun focusAtPoint(pointX: Float, pointY: Float, locked: Boolean) {
    val nextPoint = CameraFocusPoint(
      pointX.coerceIn(0f, 1f),
      pointY.coerceIn(0f, 1f)
    )
    focusPoint = nextPoint
    focusLocked = locked
  }
`
  );

  source = replaceIfFound(
    source,
    `        if (field == FocusMode.OFF) {
          it.cancelFocusAndMetering()
        } else {
          startFocusMetering()
        }
`,
    `        if (field == FocusMode.OFF && focusPoint == null) {
          it.cancelFocusAndMetering()
        } else {
          focusPoint?.let {
            startFocusMetering(it)
          } ?: startFocusMetering()
        }
`
  );

  source = insertAfter(
    source,
    `  var zoom: Float = 0f
    set(value) {
      field = value
      setCameraZoom(value)
    }
`,
    `
  var selectedLens: String? = null
    set(value) {
      field = value
      setCameraZoom(zoom)
    }
`
  );

  source = insertAfter(
    source,
    "      setCameraZoom(zoom)\n",
    `      setCameraExposureBias(exposureBias)
      focusPoint?.let {
        startFocusMetering(it)
      }
`
  );

  source = replaceIfFound(
    source,
    `  private fun startFocusMetering() {
    camera?.let {
      val meteringPointFactory = DisplayOrientedMeteringPointFactory(
        previewView.display,
        it.cameraInfo,
        previewView.width.toFloat(),
        previewView.height.toFloat()
      )
      val action = FocusMeteringAction.Builder(
        meteringPointFactory.createPoint(1f, 1f),
        FocusMeteringAction.FLAG_AF
      )
        .build()
      it.cameraControl.startFocusAndMetering(action)
    }
  }
`,
    `  private fun startFocusMetering(point: CameraFocusPoint? = null) {
    camera?.let {
      if (previewView.width <= 0 || previewView.height <= 0) {
        return
      }

      val pointX = if (point == null) {
        previewView.width / 2f
      } else {
        point.x.coerceIn(0f, 1f) * previewView.width
      }
      val pointY = if (point == null) {
        previewView.height / 2f
      } else {
        point.y.coerceIn(0f, 1f) * previewView.height
      }
      val meteringPoint = previewView.meteringPointFactory.createPoint(pointX, pointY)
      val actionBuilder = FocusMeteringAction.Builder(
        meteringPoint,
        FocusMeteringAction.FLAG_AF or FocusMeteringAction.FLAG_AE or FocusMeteringAction.FLAG_AWB
      )
      if (focusLocked) {
        actionBuilder.disableAutoCancel()
      }
      val action = actionBuilder.build()
      it.cameraControl.startFocusAndMetering(action)
    }
  }

  private fun setCameraExposureBias(value: Float) {
    val currentCamera = camera ?: return
    val exposureState = currentCamera.cameraInfo.exposureState
    if (!exposureState.isExposureCompensationSupported) {
      return
    }

    val range = exposureState.exposureCompensationRange
    val clampedBias = value.coerceIn(-1f, 1f)
    val limit = if (clampedBias >= 0f) range.upper else -range.lower
    val targetIndex = (clampedBias * limit).roundToInt().coerceIn(range.lower, range.upper)
    currentCamera.cameraControl.setExposureCompensationIndex(targetIndex)
  }
`
  );

  source = replaceIfFound(
    source,
    `      val action = FocusMeteringAction.Builder(
        meteringPointFactory.createPoint(pointX, pointY),
        FocusMeteringAction.FLAG_AF or FocusMeteringAction.FLAG_AE
      )
        .build()
      it.cameraControl.startFocusAndMetering(action)
`,
    `      val actionBuilder = FocusMeteringAction.Builder(
        previewView.meteringPointFactory.createPoint(pointX, pointY),
        FocusMeteringAction.FLAG_AF or FocusMeteringAction.FLAG_AE or FocusMeteringAction.FLAG_AWB
      )
      if (focusLocked) {
        actionBuilder.disableAutoCancel()
      }
      val action = actionBuilder.build()
      it.cameraControl.startFocusAndMetering(action)
`
  );

  source = insertAfter(
    source,
    `  private fun setCameraExposureBias(value: Float) {
    val currentCamera = camera ?: return
    val exposureState = currentCamera.cameraInfo.exposureState
    if (!exposureState.isExposureCompensationSupported) {
      return
    }

    val range = exposureState.exposureCompensationRange
    val clampedBias = value.coerceIn(-1f, 1f)
    val limit = if (clampedBias >= 0f) range.upper else -range.lower
    val targetIndex = (clampedBias * limit).roundToInt().coerceIn(range.lower, range.upper)
    currentCamera.cameraControl.setExposureCompensationIndex(targetIndex)
  }
`,
    `
  fun getAvailableLenses(): List<String> {
    if (lensFacing != CameraType.BACK) {
      return emptyList()
    }

    val zoomState = camera?.cameraInfo?.zoomState?.value ?: return listOf(CAMERA_LENS_WIDE)
    return if (zoomState.minZoomRatio < 1f) {
      listOf(CAMERA_LENS_ULTRA_WIDE, CAMERA_LENS_WIDE)
    } else {
      listOf(CAMERA_LENS_WIDE)
    }
  }
`
  );

  source = replaceIfFound(
    source,
    `  private fun setCameraZoom(value: Float) {
    val maxZoomRatio = camera?.cameraInfo?.zoomState?.value?.maxZoomRatio ?: 1f
    val targetZoomRatio = max(1f, min(maxZoomRatio, value.coerceIn(0f, 1f) * maxZoomRatio))
    camera?.cameraControl?.setZoomRatio(targetZoomRatio)
  }
`,
    `  private fun setCameraZoom(value: Float) {
    val zoomState = camera?.cameraInfo?.zoomState?.value
    val minZoomRatio = zoomState?.minZoomRatio ?: 1f
    val maxZoomRatio = zoomState?.maxZoomRatio ?: 1f
    val usesUltraWideZoom =
      lensFacing == CameraType.BACK && selectedLens == CAMERA_LENS_ULTRA_WIDE && minZoomRatio < 1f
    val targetZoomRatio = if (usesUltraWideZoom) {
      minZoomRatio
    } else {
      max(1f, min(maxZoomRatio, value.coerceIn(0f, 1f) * maxZoomRatio))
    }
    camera?.cameraControl?.setZoomRatio(targetZoomRatio)
  }
`
  );

  write(relativePath, source);
}

function patchCameraRecords() {
  const relativePath = "android/src/main/java/expo/modules/camera/records/CameraRecords.kt";
  let source = read(relativePath);

  source = insertAfter(
    source,
    `enum class FocusMode(val value: String) : Enumerable {
  ON("on"),
  OFF("off")
}
`,
    `
data class CameraFocusPoint(
  @Field val x: Float,
  @Field val y: Float
) : Record
`
  );

  write(relativePath, source);
}

function patchCameraTypes(relativePath) {
  let source = read(relativePath);

  source = insertAfter(
    source,
    relativePath.endsWith(".d.ts")
      ? `export type Point = {
    x: number;
    y: number;
};
`
      : `export type Point = {
  x: number;
  y: number;
};
`,
    relativePath.endsWith(".d.ts")
      ? `export type CameraFocusPoint = {
    x: number;
    y: number;
};
`
      : `
export type CameraFocusPoint = {
  x: number;
  y: number;
};
`
  );

  source = insertAfter(
    source,
    relativePath.endsWith(".d.ts")
      ? `    zoom?: number;
`
      : `  zoom?: number;
`,
    relativePath.endsWith(".d.ts")
      ? `    /**
     * Normalized point, from 0 to 1 on each axis, used for Android focus and exposure metering.
     * @platform android
     */
    focusPoint?: CameraFocusPoint | null;
    /**
     * Whether Android focus and exposure metering should remain locked at the current point.
     * @platform android
     */
    focusLocked?: boolean;
    /**
     * Normalized exposure compensation bias from -1 to 1.
     * @platform android
     */
    exposureBias?: number;
`
      : `  /**
   * Normalized point, from 0 to 1 on each axis, used for Android focus and exposure metering.
   * @platform android
   */
  focusPoint?: CameraFocusPoint | null;
  /**
   * Whether Android focus and exposure metering should remain locked at the current point.
   * @platform android
   */
  focusLocked?: boolean;
  /**
   * Normalized exposure compensation bias from -1 to 1.
   * @platform android
   */
  exposureBias?: number;
`
  );

  source = replaceIfFound(
    source,
    relativePath.endsWith(".d.ts")
      ? `    zoom?: number;
    ratio?: CameraRatio;
`
      : `  zoom?: number;
  ratio?: CameraRatio;
`,
    relativePath.endsWith(".d.ts")
      ? `    zoom?: number;
    focusPoint?: CameraFocusPoint | null;
    focusLocked?: boolean;
    exposureBias?: number;
    ratio?: CameraRatio;
`
      : `  zoom?: number;
  focusPoint?: CameraFocusPoint | null;
  focusLocked?: boolean;
  exposureBias?: number;
  ratio?: CameraRatio;
`
  );

  source = replaceIfFound(
    source,
    relativePath.endsWith(".d.ts")
      ? `    zoom?: number;
    focusPoint?: CameraFocusPoint | null;
    exposureBias?: number;
`
      : `  zoom?: number;
  focusPoint?: CameraFocusPoint | null;
  exposureBias?: number;
`,
    relativePath.endsWith(".d.ts")
      ? `    zoom?: number;
    focusPoint?: CameraFocusPoint | null;
    focusLocked?: boolean;
    exposureBias?: number;
`
      : `  zoom?: number;
  focusPoint?: CameraFocusPoint | null;
  focusLocked?: boolean;
  exposureBias?: number;
`
  );

  source = insertAfter(
    source,
    relativePath.endsWith(".d.ts")
      ? `    readonly getAvailableLenses: () => Promise<string[]>;
`
      : `  readonly getAvailableLenses: () => Promise<string[]>;
`,
    relativePath.endsWith(".d.ts")
      ? `    readonly focusAtPoint: (x: number, y: number, locked: boolean) => Promise<void>;
    readonly setFocusLocked: (locked: boolean) => Promise<void>;
    readonly setExposureBias: (exposureBias: number) => Promise<void>;
`
      : `  readonly focusAtPoint: (x: number, y: number, locked: boolean) => Promise<void>;
  readonly setFocusLocked: (locked: boolean) => Promise<void>;
  readonly setExposureBias: (exposureBias: number) => Promise<void>;
`
  );

  write(relativePath, source);
}

function patchCameraViewWrapper() {
  let source = read("src/CameraView.tsx");

  source = replaceIfFound(
    source,
    `  CameraViewRef,
  ScanningOptions,
`,
    `  CameraViewRef,
  CameraFocusPoint,
  ScanningOptions,
`
  );

  source = insertAfter(
    source,
    `  async getAvailableLensesAsync(): Promise<string[]> {
    return (await this._cameraRef.current?.getAvailableLenses()) ?? [];
  }
`,
    `
  async focusAtPointAsync(point: CameraFocusPoint, locked = false): Promise<void> {
    return this._cameraRef.current?.focusAtPoint(point.x, point.y, locked);
  }

  async setFocusLockedAsync(locked: boolean): Promise<void> {
    return this._cameraRef.current?.setFocusLocked(locked);
  }

  async setExposureBiasAsync(exposureBias: number): Promise<void> {
    return this._cameraRef.current?.setExposureBias(exposureBias);
  }
`
  );

  write("src/CameraView.tsx", source);

  source = read("build/CameraView.js");
  source = insertAfter(
    source,
    `    async getAvailableLensesAsync() {
        return (await this._cameraRef.current?.getAvailableLenses()) ?? [];
    }
`,
    `    async focusAtPointAsync(point, locked = false) {
        return this._cameraRef.current?.focusAtPoint(point.x, point.y, locked);
    }
    async setFocusLockedAsync(locked) {
        return this._cameraRef.current?.setFocusLocked(locked);
    }
    async setExposureBiasAsync(exposureBias) {
        return this._cameraRef.current?.setExposureBias(exposureBias);
    }
`
  );
  write("build/CameraView.js", source);

  source = read("build/CameraView.d.ts");
  source = replaceIfFound(
    source,
    "CameraRecordingOptions, CameraViewRef, ScanningOptions",
    "CameraRecordingOptions, CameraViewRef, CameraFocusPoint, ScanningOptions"
  );
  source = insertAfter(
    source,
    `    getAvailableLensesAsync(): Promise<string[]>;
`,
    `    focusAtPointAsync(point: CameraFocusPoint, locked?: boolean): Promise<void>;
    setFocusLockedAsync(locked: boolean): Promise<void>;
    setExposureBiasAsync(exposureBias: number): Promise<void>;
`
  );
  write("build/CameraView.d.ts", source);
}

function disableExpoCameraAndroidShutterSound() {
  const optionsPath = "android/src/main/java/expo/modules/camera/Options.kt";
  let optionsSource = read(optionsPath);
  optionsSource = replaceIfFound(
    optionsSource,
    "  @Field val shutterSound: Boolean = true,\n",
    "  @Field val shutterSound: Boolean = false,\n"
  );
  write(optionsPath, optionsSource);

  const cameraViewPath = "android/src/main/java/expo/modules/camera/ExpoCameraView.kt";
  let cameraViewSource = read(cameraViewPath);
  cameraViewSource = replaceIfFound(
    cameraViewSource,
    "import android.media.AudioManager\nimport android.media.MediaActionSound\n",
    ""
  );
  cameraViewSource = replaceIfFound(
    cameraViewSource,
    `    val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    val volume = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC)
    val hasShutterSound = options.shutterSound

`,
    ""
  );
  cameraViewSource = replaceIfFound(
    cameraViewSource,
    `          if (hasShutterSound && volume != 0) {
            MediaActionSound().play(MediaActionSound.SHUTTER_CLICK)
          }
`,
    ""
  );
  write(cameraViewPath, cameraViewSource);
}

function patchVisionCameraAndroidShutterSound() {
  if (!packageJson.dependencies?.["react-native-vision-camera"]) {
    console.info("react-native-vision-camera is not declared; skipping local VisionCamera patch");
    return;
  }

  if (!fs.existsSync(reactNativeVisionCameraRoot)) {
    console.info("react-native-vision-camera is not installed; skipping local VisionCamera patch");
    return;
  }

  const relativePath =
    "android/src/main/java/com/margelo/nitro/camera/hybrids/outputs/HybridPhotoOutput.kt";
  let source = readFrom(reactNativeVisionCameraRoot, relativePath);
  source = replaceIfFound(
    source,
    "      val enableShutterSound = (settings.enableShutterSound ?: true) || CameraInfo.mustPlayShutterSound()\n",
    "      val enableShutterSound = settings.enableShutterSound ?: true\n"
  );
  source = replaceIfFound(
    source,
    `      val enableShutterSound =
        (settings.enableShutterSound ?: true) || CameraInfo.mustPlayShutterSound()
`,
    `      val enableShutterSound = settings.enableShutterSound ?: true
`
  );
  source = replaceIfFound(source, "import androidx.camera.core.CameraInfo\n", "");
  writeTo(reactNativeVisionCameraRoot, relativePath, source);
  console.info("applied local VisionCamera Android shutter sound patch");
}

if (packageJson.dependencies?.["expo-camera"] && fs.existsSync(expoCameraRoot)) {
  patchCameraViewModule();
  patchExpoCameraView();
  patchCameraRecords();
  patchCameraTypes("build/Camera.types.d.ts");
  patchCameraTypes("src/Camera.types.ts");
  patchCameraViewWrapper();
  disableExpoCameraAndroidShutterSound();
  console.info("applied local expo-camera Android focus, shutter, and zoom patch");
} else {
  console.info("expo-camera is not declared or installed; skipping local expo-camera patch");
}

patchVisionCameraAndroidShutterSound();
