import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import vm from "node:vm";

const states = [];
let stateIndex = 0;
let effect;
let authChange;
let finishA;
const auth = { currentUser: null };
const free = { plan: "free" };
const exports = {};
const react = {
  createContext: () => ({ Provider: "Provider" }), useContext: () => null,
  useEffect: fn => { effect = fn; }, useMemo: fn => fn(), useCallback: fn => fn,
  useRef: value => ({ current: value }),
  useState: initial => { const index = stateIndex++; states[index] = initial; return [initial, value => { states[index] = value; }]; }
};
const modules = {
  react,
  "react/jsx-runtime": { jsx: () => null, jsxs: () => null },
  "react-native": {},
  "@/lib/firebase": { firebaseAuth: auth, firestore: {}, isFirebaseConfigured: true },
  "firebase/auth": { onAuthStateChanged: (_, callback) => { authChange = callback; return () => {}; } },
  "firebase/firestore": { doc: () => ({}), setDoc: async () => {}, serverTimestamp: () => null },
  "@/lib/subscription": {
    freeSubscription: free,
    isPremiumSubscription: () => false,
    getUserSubscriptionState: user => user.uid === "A" ? new Promise(resolve => { finishA = resolve; }) : Promise.resolve({ verifiedSubscription: { plan: "B" }, cachedSubscription: { plan: "B" }, subscriptionStatus: "verified" })
  },
  "@/lib/local-library-owner": { checkLocalLibraryAccess: async uid => uid === "B" ? "locked" : "allowed" },
  "@/lib/google-auth": {}
};
vm.runInNewContext(ts.transpileModule(fs.readFileSync("lib/auth-context.tsx", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 }
}).outputText, { exports, require: name => { assert.ok(modules[name], name); return modules[name]; } });
exports.AuthProvider({ children: null });
const cleanup = effect();
const user = uid => ({ uid, email: `${uid}@example.test`, providerData: [], metadata: {}, emailVerified: true });
auth.currentUser = user("A");
const first = authChange(auth.currentUser);
for (let i = 0; i < 8; i++) await Promise.resolve();
assert.ok(finishA, "A subscription request is pending");
auth.currentUser = user("B");
await authChange(auth.currentUser);
assert.equal(states[5], "locked", "another owner must remain gated");
finishA({ verifiedSubscription: { plan: "A" }, cachedSubscription: { plan: "A" }, subscriptionStatus: "verified" });
await first;
assert.equal(states[1].plan, "B", "late A response cannot replace B subscription");
assert.equal(states[5], "locked");
cleanup();
console.log("ok - owner gate and subscription remain bound to the latest auth session");
