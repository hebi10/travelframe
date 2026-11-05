import crypto from "node:crypto";

const ORIGINAL_SHA256 = "976f9e085017cd2068eff051f3c7c0ce81c3856ce363d52dbd5aed1232e83330";
const PATCHED_SHA256 = "7818196330a0f0a587123625b5c91031680d5a8c4de52e7d4832bff81c115ba7";

export function patchViewRecorderAndroidCallbacks(source, version) {
  if (version !== "0.4.1") throw new Error("ViewRecorder callback patch requires reviewed version 0.4.1");
  const digest = crypto.createHash("sha256").update(source).digest("hex");
  if (digest === PATCHED_SHA256) return source;
  if (digest !== ORIGINAL_SHA256) throw new Error("ViewRecorder callback patch found unsupported native source");

  const replaceOnce = (search, replacement) => {
    if (source.split(search).length !== 2) throw new Error("ViewRecorder callback patch anchor is missing or ambiguous");
    source = source.replace(search, () => replacement);
  };
  replaceOnce("import java.util.concurrent.TimeUnit\n", "import java.util.concurrent.TimeUnit\nimport java.util.concurrent.atomic.AtomicBoolean\n");
  replaceOnce("  private fun releaseSession(session: EncoderSession) {\n", "  private fun releaseSession(session: EncoderSession) {\n    session.codecStopped.set(true)\n");
  replaceOnce("      var audioEncoderInst: MediaCodec? = null\n", "      var audioEncoderInst: MediaCodec? = null\n      val codecStopped = AtomicBoolean(false)\n");
  replaceOnce("            eosLatch = eosLatch,\n", "            eosLatch = eosLatch,\n            codecStopped = codecStopped,\n");
  replaceOnce("  val eosLatch: CountDownLatch,\n", "  val eosLatch: CountDownLatch,\n  val codecStopped: AtomicBoolean,\n");
  replaceOnce('        Log.e(TAG, "startSession failed", t)\n', '        Log.e(TAG, "startSession failed", t)\n        codecStopped.set(true)\n');

  for (const method of ["onOutputBufferAvailable", "onOutputFormatChanged"]) {
    const signature = `            override fun ${method}(`;
    if (source.split(signature).length !== 2) throw new Error("ViewRecorder callback method is missing or ambiguous");
    const opening = "            ) {\n";
    const start = source.indexOf(opening, source.indexOf(signature)) + opening.length;
    const end = source.indexOf("\n            }", start);
    if (start < opening.length || end < start) throw new Error("ViewRecorder callback body is unsupported");
    const body = source.slice(start, end).split("\n").map((line) => line ? `  ${line}` : line).join("\n");
    source = `${source.slice(0, start)}              if (codecStopped.get()) return
              try {
${body}
              } catch (e: IllegalStateException) {
                if (e is MediaCodec.CodecException || !codecStopped.get()) throw e
              }${source.slice(end)}`;
  }
  return source;
}
