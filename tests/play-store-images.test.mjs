import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { validateStoreManifest, validateRgbPng, replaceStoreImages, verifyPreparedStoreImages, decodeBundledStoreImages } from "../scripts/publish-play-store-images.mjs";

const manifest = JSON.parse(fs.readFileSync("docs/release-assets/play-phone-six-20261109.json", "utf8"));
const png = (width=1080, height=1920) => {
  const bytes = Buffer.alloc(64);
  Buffer.from([137,80,78,71,13,10,26,10]).copy(bytes);
  bytes.write("IHDR", 12);
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  bytes[24] = 8;
  bytes[25] = 2;
  return bytes;
};

test("store listing manifest is pinned to one app, one language, one image type, six distinct images", () => {
  assert.equal(validateStoreManifest(manifest).assets.length, 6);
  for (const bad of [
    { ...manifest, packageName: "another.package" },
    { ...manifest, language: "en-US" },
    { ...manifest, imageType: "featureGraphic" },
    { ...manifest, assets: manifest.assets.slice(0, 5) },
    { ...manifest, assets: manifest.assets.map((a,i)=>i===4?{...a,fileId:manifest.assets[0].fileId}:a) },
    { ...manifest, assets: manifest.assets.map((a,i)=>i===0?{...a,outputName:"../escape.png"}:a) }
  ]) assert.throws(() => validateStoreManifest(bad));
});

test("only RGB 1080x1920 PNG passes release media integrity check", () => {
  assert.doesNotThrow(() => validateRgbPng(png(), 1080, 1920));
  for (const buffer of [Buffer.alloc(64), png(941,1672), (()=>{const b=png();b[25]=6;return b;})()])
    assert.throws(() => validateRgbPng(buffer, 1080, 1920));
});

test("six prepared images require exact checksums and image provenance", () => {
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),"body-frame-play-shots-"));
  try{
    const sha=awaitSha(png());
    const rows=manifest.assets.map(a=>({index:a.index,fileName:a.outputName,sha256:sha,bytes:64}));
    fs.writeFileSync(path.join(folder,"images-manifest.json"),JSON.stringify({packageName:manifest.packageName,language:manifest.language,imageType:manifest.imageType,images:rows}));
    for (const asset of manifest.assets) fs.writeFileSync(path.join(folder,asset.outputName),png());
    assert.equal(verifyPreparedStoreImages(manifest,folder).length,6);
    fs.writeFileSync(path.join(folder,manifest.assets[1].outputName),Buffer.alloc(64));
    assert.throws(()=>verifyPreparedStoreImages(manifest,folder));
  } finally { fs.rmSync(folder,{recursive:true,force:true}); }
});
function awaitSha(bytes) {
  return requireSha(bytes);
}
import crypto from "node:crypto";
function requireSha(bytes) {return crypto.createHash("sha256").update(bytes).digest("hex")}

test("publisher changes only Korean phone screenshots and checks independent readback", async () => {
  const calls=[];
  let edits=0, uploads=0, staged=false, committed=false;
  const response=(data,status=200)=>({ok:status<300,status,text:async()=>JSON.stringify(data),arrayBuffer:async()=>new Uint8Array(0).buffer});
  const mocked=async(url,opts)=>{
    calls.push({url,method:opts.method});
    if(url.endsWith("/edits") && opts.method==="POST") return response({id:"edit"+(++edits)});
    if(url.endsWith("/listings") && opts.method==="GET") return response({listings:[{language:"ko-KR"},{language:"en-US"}]});
    if(url.includes("/upload/androidpublisher/")) {
      assert.equal(opts.method,"POST");
      assert.equal(opts.headers["Content-Type"],"image/png");
      uploads++;
      return response({image:{id:"new"+uploads}});
    }
    if(url.endsWith("/phoneScreenshots") && opts.method==="DELETE"){staged=true;return response({});}
    if(url.endsWith("/phoneScreenshots") && opts.method==="GET")
      return response({images:committed || (staged && uploads===6)?Array.from({length:6},(_,i)=>({id:"new"+(i+1)})):[{id:"old"}]});
    if(url.includes(":commit")){committed=true;return response({});}
    if(opts.method==="DELETE")return response({});
    throw Error("Unexpected endpoint/method");
  };
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),"body-frame-play-receipt-"));
  try {
    const assets=manifest.assets.map(a=>({index:a.index,name:a.outputName,sha256:"ee".repeat(32),bytes:png()}));
    const result=await replaceStoreImages(manifest,assets,"fixture-token",path.join(folder,"receipt.json"),mocked);
    assert.equal(result.status,"committed-and-read-back");
    assert.deepEqual(result.oldIds,["old"]);
    assert.deepEqual(result.newIds,["new1","new2","new3","new4","new5","new6"]);
    assert.equal(calls.filter(c=>c.url.includes(":commit")).length,1);
    assert.equal(calls.filter(c=>c.url.includes("/upload/androidpublisher/")).length,6);
    assert.ok(calls.every(c=>!c.url.includes("/tracks/")&&!c.url.includes("/bundles")));
  }finally{fs.rmSync(folder,{recursive:true,force:true});}
});

test("publisher does not commit when Korean listing is absent", async () => {
  const calls=[];
  const response=data=>({ok:true,status:200,text:async()=>JSON.stringify(data)});
  const mocked=async(url,opts)=>{
    calls.push({url,method:opts.method});
    if(url.endsWith("/edits") && opts.method==="POST")return response({id:"edit1"});
    if(url.endsWith("/listings") && opts.method==="GET")return response({listings:[{language:"en-US"}]});
    if(opts.method==="DELETE")return response({});
    throw Error("Unexpected request in safe abort");
  };
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"body-frame-play-abort-"));
  try{
    const assets=manifest.assets.map(a=>({index:a.index,bytes:png(),sha256:"ee".repeat(32)}));
    await assert.rejects(replaceStoreImages(manifest,assets,"fixture-token",path.join(dir,"receipt.json"),mocked),/Korean Play store listing/);
    assert.ok(!calls.some(c=>c.url.includes(":commit")));
    assert.ok(calls.some(c=>c.method==="DELETE"));
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});


test("six repository screenshot assets decode to exactly the approved Drive source checksums", () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"body-frame-approved-shots-"));
  try {
    decodeBundledStoreImages(manifest,dir,"assets/play-store/2026-11-09");
    assert.equal(fs.readdirSync(dir).filter(name=>name.endsWith(".png")).length,6);
    for(const a of manifest.assets) {
      const file=path.join(dir,String(a.index).padStart(2,"0")+".png");
      const raw=fs.readFileSync(file);
      validateRgbPng(raw,a.sourceWidth,a.sourceHeight);
      assert.equal(requireSha(raw),a.sourceSha256);
    }
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});
