const fs = require("fs");
const path = require("path");
const { withDangerousMod } = require("@expo/config-plugins");

module.exports = (config) => withDangerousMod(config, ["android", (result) => {
  if (result.modRequest.introspect) return result;
  const file = path.join(result.modRequest.platformProjectRoot, "app", "proguard-rules.pro");
  const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  const rules = [
    "-keep class com.google.android.gms.internal.consent_sdk.** { *; }",
    "-keep class com.google.android.ump.** { *; }"
  ];
  const missing = rules.filter((rule) => !current.includes(rule));
  if (missing.length > 0) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, `\n# Body Frame UMP consent\n${missing.join("\n")}\n`, "utf8");
  }
  return result;
}]);
