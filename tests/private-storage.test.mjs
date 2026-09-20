import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const downloads = [];
const alice = { uid: "alice", getIdToken: async () => "id-token" };
const auth = { currentUser: alice };
const files = {
  cacheDirectory: "file:///cache/", makeDirectoryAsync: async () => {},
  getInfoAsync: async () => ({ exists: false }), deleteAsync: async () => {},
  downloadAsync: async (...args) => { downloads.push(args); return { uri: args[1], status: 200 }; }
};
const exports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync("lib/private-storage.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText, { exports, URL, Map, Date, Math, require: (name) => {
  if (name === "expo-file-system/legacy") return files;
  if (name === "@/lib/firebase") return { firebaseAuth: auth, firebaseStorage: { app: { options: { storageBucket: "app.example" } } } };
  throw new Error(name);
} });
const own = "https://firebasestorage.googleapis.com/v0/b/app.example/o/users%2Falice%2Fbackups%2Fa.jpg?alt=media&token=old-secret";
await exports.downloadPrivateFile(own, "file:///a.jpg");
assert.equal(new URL(downloads[0][0]).searchParams.has("token"), false);
assert.equal(downloads[0][2].headers.Authorization, "Firebase id-token");
await assert.rejects(exports.downloadPrivateFile(own.replace("alice", "bob"), "file:///b"));
await assert.rejects(exports.downloadPrivateFile(own.replace("app.example", "other.example"), "file:///b"));
await exports.downloadPrivateFile("https://example.com/public.jpg", "file:///public");
assert.equal(Object.keys(downloads.at(-1)[2].headers).length, 0);
auth.currentUser = null;
await assert.rejects(exports.resolvePrivateMediaUri(own));
auth.currentUser = { uid: "alice", getIdToken: async () => { auth.currentUser = { uid: "bob" }; return "alice-token"; } };
const count = downloads.length;
await assert.rejects(exports.downloadPrivateFile(own, "file:///late"));
assert.equal(downloads.length, count);
auth.currentUser = alice;
files.downloadAsync = async () => { auth.currentUser = null; return { uri: "file:///late", status: 200 }; };
await assert.rejects(exports.downloadPrivateFile(own, "file:///late"));
auth.currentUser = alice;
files.downloadAsync = async () => ({ uri: "file:///denied", status: 403 });
await assert.rejects(exports.downloadPrivateFile(own, "file:///denied"));
console.log("ok - private media owner, bearer removal, HTTP failure and auth race guards");
