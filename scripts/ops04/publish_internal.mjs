import fs from "node:fs";
import path from "node:path";
import {createPublisher, publishRelease, verifyArtifactMetadata} from "../publish-play-release.mjs";
const dir="ops04-input";
const e=process.env;
function requireValue(ok,message) { if(!ok) throw new Error("OPS-04: "+message); }
const meta=JSON.parse(fs.readFileSync(path.join(dir,"build-provenance.json"),"utf8"));
const pin=String(e.ANDROID_UPLOAD_CERT_SHA256||"").replaceAll(":","").toLowerCase();
requireValue(meta.repository==="hebi10/travelframe" && meta.sourceSha===e.EXPECTED_MAIN_SHA
  && String(meta.runId)===e.BUILD_RUN_ID && meta.packageId==="com.haebi.photoguide"
  && meta.versionCode===Number(e.VERSION_CODE) && meta.versionName===e.VERSION_NAME
  && meta.uploadCertificateSha256===pin, "Original immutable build metadata mismatch");
const plan={sourceSha:meta.sourceSha, workflowSha:meta.workflowSha,
  runId:meta.runId, runAttempt:meta.runAttempt, versionCode:meta.versionCode,
  versionName:meta.versionName, lastPlayVersionCode:meta.confirmedPreviousPlayVersionCode,
  certificateSha256:meta.uploadCertificateSha256, logicalTrack:"internal",apiTrack:e.PLAY_INTERNAL_TRACK};
const files=verifyArtifactMetadata(dir,plan);
if(process.argv[2]==="check"){
  requireValue(["internal","qa"].includes(e.PLAY_INTERNAL_TRACK),"Internal track must be an existing internal or qa API track");
  console.log("Original build provenance and mapping verified. No Play edit requested.");
}else if(process.argv[2]==="publish"){
  requireValue(e.DEPLOY_MODE==="publish" && e.FINAL_RELEASE_APPROVED==="true"
    && e.APPROVAL_PHRASE==="PUBLISH_VERIFIED_INTERNAL_AAB","Explicit approval required");
  requireValue(["internal","qa"].includes(e.PLAY_INTERNAL_TRACK),"Unknown internal track");
  const token=e.PLAY_ACCESS_TOKEN;
  requireValue(Boolean(token),"App-scoped Play access token missing");
  fs.mkdirSync("ops04-verified",{recursive:true});
  const receipt=path.join("ops04-verified","play-release.json");
  const result=await publishRelease(createPublisher(token),plan,files.aab,files.mapping,
    value=>fs.writeFileSync(receipt,JSON.stringify(value,null,2)+"\n"));
  requireValue(result.status==="committed-and-read-back","Play readback incomplete");
  console.log("Internal Play API commit and readback confirmed; tester installability is separately checked.");
}else{
  throw new Error("OPS-04 expects check or publish");
}
