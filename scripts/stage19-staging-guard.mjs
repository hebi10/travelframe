import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ID_PATTERN = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;

export const verifyStagingTarget = ({
  stageProjectId,
  approvedProjectId,
  productionProjectId,
  storageBucket,
  approvalFlag,
  serviceAccount,
  identityProvider,
  sourceHeadSha,
  approvedHeadSha
}) => {
  const projectId = String(stageProjectId ?? "").trim();
  if (!ID_PATTERN.test(projectId) || projectId.startsWith("demo-")) {
    throw new Error("A real, explicitly named staging Firebase project is required");
  }
  if (!productionProjectId || projectId === productionProjectId) {
    throw new Error("Production Firebase project cannot be used for staging verification");
  }
  if (projectId !== approvedProjectId || approvalFlag !== "true") {
    throw new Error("Target project must match the approved repository variable; explicit staging approval is required");
  }
  if (![projectId + ".appspot.com", projectId + ".firebasestorage.app"].includes(storageBucket)) {
    throw new Error("Staging Storage bucket must belong to the exact approved project");
  }
  if (typeof serviceAccount !== "string" || !serviceAccount.endsWith("@" + projectId + ".iam.gserviceaccount.com")) {
    throw new Error("Staging-only service account from the approved project is required");
  }
  if (!/^projects\/[0-9]+\/locations\/global\/workloadIdentityPools\/[a-zA-Z0-9_-]+\/providers\/[a-zA-Z0-9_-]+$/.test(identityProvider ?? "")) {
    throw new Error("A Workload Identity Federation provider is required");
  }
  if (
    typeof sourceHeadSha !== "string" ||
    !/^[a-f0-9]{40}$/.test(sourceHeadSha) ||
    sourceHeadSha !== approvedHeadSha
  ) {
    throw new Error("Staging deployment requires approval for this exact PR head SHA");
  }
  return { projectId, storageBucket };
};

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    const rc = JSON.parse(fs.readFileSync(".firebaserc", "utf8"));
    const config = verifyStagingTarget({
      stageProjectId: process.env.STAGE19_STAGING_PROJECT_ID,
      approvedProjectId: process.env.STAGE19_APPROVED_PROJECT_ID,
      productionProjectId: rc.projects?.default,
      storageBucket: process.env.STAGE19_STAGING_STORAGE_BUCKET,
      approvalFlag: process.env.STAGE19_STAGING_DEPLOY_APPROVED,
      serviceAccount: process.env.STAGE19_STAGING_SERVICE_ACCOUNT,
      identityProvider: process.env.STAGE19_STAGING_WIF_PROVIDER,
      sourceHeadSha: process.env.STAGE19_SOURCE_HEAD_SHA,
      approvedHeadSha: process.env.STAGE19_APPROVED_HEAD_SHA
    });
    console.log("Verified disposable staging-only deployment target: " + config.projectId);
  } catch (error) {
    console.error("Staging preflight blocked:", error instanceof Error ? error.message : "invalid configuration");
    process.exitCode = 1;
  }
}
