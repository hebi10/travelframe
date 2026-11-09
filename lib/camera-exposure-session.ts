type CameraExposureController = {
  setExposureBias: (exposure: number) => Promise<void>;
};

const isCameraOperationCanceled = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return /CameraControl\$OperationCanceledException\b/.test(message);
};

/** Owns exposure promises independently of VisionCamera's unhandled exposure prop updater. */
export function createCameraExposureSession(onError: (error: unknown) => void) {
  let controller: CameraExposureController | undefined;
  let desiredExposure: number | undefined;
  let appliedExposure: number | undefined;
  let generation = 0;

  const applyExposure = () => {
    if (!controller || desiredExposure === undefined || appliedExposure === desiredExposure) {
      return;
    }

    const requestController = controller;
    const requestGeneration = ++generation;
    appliedExposure = desiredExposure;
    const handleError = (error: unknown) => {
      const superseded = requestGeneration !== generation || requestController !== controller;
      // CameraX replaces in-flight exposure operations when exposure or the session changes.
      if (superseded && isCameraOperationCanceled(error)) {
        return;
      }
      onError(error);
    };

    try {
      void requestController.setExposureBias(desiredExposure).catch(handleError);
    } catch (error) {
      handleError(error);
    }
  };

  return {
    start(nextController: CameraExposureController) {
      if (controller === nextController) {
        return;
      }
      generation += 1;
      controller = nextController;
      appliedExposure = undefined;
      applyExposure();
    },
    stop() {
      generation += 1;
      controller = undefined;
      appliedExposure = undefined;
    },
    setExposureBias(exposure: number) {
      desiredExposure = exposure;
      applyExposure();
    }
  };
}
