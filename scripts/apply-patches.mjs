import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

const expoCameraRoot = path.join(root, "node_modules", "expo-camera");

function read(relativePath) {
  return fs.readFileSync(path.join(expoCameraRoot, relativePath), "utf8");
}

function write(relativePath, source) {
  fs.writeFileSync(path.join(expoCameraRoot, relativePath), source);
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
    "      setCameraZoom(zoom)\n",
    `      setCameraExposureBias(exposureBias)
      focusPoint?.let {
        startFocusMetering(it)
      }
`
  );

  source = replaceOnce(
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
      val meteringPointFactory = DisplayOrientedMeteringPointFactory(
        previewView.display,
        it.cameraInfo,
        previewView.width.toFloat(),
        previewView.height.toFloat()
      )
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
      val actionBuilder = FocusMeteringAction.Builder(
        meteringPointFactory.createPoint(pointX, pointY),
        FocusMeteringAction.FLAG_AF or FocusMeteringAction.FLAG_AE
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

  source = replaceOnce(
    source,
    `      val action = FocusMeteringAction.Builder(
        meteringPointFactory.createPoint(pointX, pointY),
        FocusMeteringAction.FLAG_AF or FocusMeteringAction.FLAG_AE
      )
        .build()
      it.cameraControl.startFocusAndMetering(action)
`,
    `      val actionBuilder = FocusMeteringAction.Builder(
        meteringPointFactory.createPoint(pointX, pointY),
        FocusMeteringAction.FLAG_AF or FocusMeteringAction.FLAG_AE
      )
      if (focusLocked) {
        actionBuilder.disableAutoCancel()
      }
      val action = actionBuilder.build()
      it.cameraControl.startFocusAndMetering(action)
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

  write(relativePath, source);
}

if (fs.existsSync(expoCameraRoot)) {
  patchCameraViewModule();
  patchExpoCameraView();
  patchCameraRecords();
  patchCameraTypes("build/Camera.types.d.ts");
  patchCameraTypes("src/Camera.types.ts");
  console.info("applied local expo-camera Android focus patch");
}
