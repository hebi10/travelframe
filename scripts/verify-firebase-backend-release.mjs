import path from "node:path";
import { fileURLToPath } from "node:url";

const PRODUCTION_PROJECT_ID = "travelframe-4e1fb";
const CONFIRM = "DEPLOY_TRAVELFRAME_FIREBASE_BACKEND";

export function verifyFirebaseBackendRelease(environment) {
  if (environment.GITHUB_REPOSITORY !== "hebi10/travelframe" ||
      environment.GITHUB_REF !== "refs/heads/main" ||
      environment.GITHUB_EVENT_NAME !== "workflow_dispatch") {
    throw new Error("Production Firebase backend deployment requires a manual main-branch workflow");
  }
  if (environment.FIREBASE_BACKEND_DEPLOY_MODE !== "deploy" ||
      environment.FIREBASE_BACKEND_CONFIRM !== CONFIRM) {
    throw new Error("Production Firebase backend deployment requires the exact manual confirmation");
  }
  if (environment.FIREBASE_BACKEND_RELEASE_APPROVED !== "true") {
    throw new Error("Production Firebase backend release approval variable is not enabled");
  }
  if (environment.FIREBASE_BACKEND_PROJECT_ID !== PRODUCTION_PROJECT_ID) {
    throw new Error("Production Firebase backend target does not match the reviewed project");
  }
  const account = environment.FIREBASE_BACKEND_SERVICE_ACCOUNT;
  if (typeof account !== "string" ||
      !/^[a-z0-9-]+@travelframe-4e1fb\.iam\.gserviceaccount\.com$/.test(account)) {
    throw new Error("A dedicated production-project Firebase backend service account is required");
  }
  const provider = environment.FIREBASE_BACKEND_WIF_PROVIDER;
  if (typeof provider !== "string" ||
      !/^projects\/[0-9]+\/locations\/global\/workloadIdentityPools\/[a-z0-9_-]+\/providers\/[a-z0-9_-]+$/i.test(provider)) {
    throw new Error("A valid GitHub OIDC Workload Identity Federation provider is required");
  }
  return { projectId: PRODUCTION_PROJECT_ID };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    const approved = verifyFirebaseBackendRelease(process.env);
    console.log("Approved main-only Firebase backend release target:", approved.projectId);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
