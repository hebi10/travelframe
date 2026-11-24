type CameraZoomController = {
  setZoom: (zoom: number) => Promise<void>;
};

const isCameraOperationCanceled = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return /CameraControl\$OperationCanceledException\b/.test(message);
};

/** Owns zoom promises independently of VisionCamera's unhandled zoom prop updater. */
export function createCameraZoomSession(onError: (error: unknown) => void) {
  let controller: CameraZoomController | undefined;
  let desiredZoom: number | undefined;
  let appliedZoom: number | undefined;
  let generation = 0;

  const applyZoom = () => {
    if (!controller || desiredZoom === undefined || appliedZoom === desiredZoom) {
      return;
    }

    const requestController = controller;
    const requestGeneration = ++generation;
    appliedZoom = desiredZoom;
    const handleError = (error: unknown) => {
      const superseded = requestGeneration !== generation || requestController !== controller;
      // CameraX cancels an in-flight zoom when a newer zoom or session replaces it.
      if (superseded && isCameraOperationCanceled(error)) {
        return;
      }
      onError(error);
    };

    try {
      void requestController.setZoom(desiredZoom).catch(handleError);
    } catch (error) {
      handleError(error);
    }
  };

  return {
    start(nextController: CameraZoomController) {
      if (controller === nextController) {
        return;
      }
      generation += 1;
      controller = nextController;
      appliedZoom = undefined;
      applyZoom();
    },
    stop() {
      generation += 1;
      controller = undefined;
      appliedZoom = undefined;
    },
    setZoom(zoom: number) {
      desiredZoom = zoom;
      applyZoom();
    }
  };
}
