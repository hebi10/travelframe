import java.nio.ByteBuffer
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference

private class Gate(val phase: String, val failure: IllegalStateException? = null) {
  val entered = CountDownLatch(1)
  val resume = CountDownLatch(1)
  fun visit(current: String) {
    if (phase != current) return
    entered.countDown()
    check(resume.await(5, TimeUnit.SECONDS)) { "Race was not released" }
    failure?.let { throw it }
  }
}

private class MediaFormat
private class MediaCodec {
  companion object {
    const val BUFFER_FLAG_CODEC_CONFIG = 2
    const val BUFFER_FLAG_END_OF_STREAM = 4
  }
  class CodecException : IllegalStateException("codec failure")
  class BufferInfo(val size: Int = 0, val flags: Int = 0)
  abstract class Callback {
    abstract fun onInputBufferAvailable(codec: MediaCodec, index: Int)
    abstract fun onOutputBufferAvailable(codec: MediaCodec, index: Int, info: BufferInfo)
    abstract fun onOutputFormatChanged(codec: MediaCodec, format: MediaFormat)
    abstract fun onError(codec: MediaCodec, e: CodecException)
  }
  @Volatile var stopped = false
  var gate: Gate? = null
  var reads = 0
  var releases = 0
  fun getOutputBuffer(index: Int): ByteBuffer {
    check(index == 7)
    reads++
    gate?.visit("read")
    check(!stopped) { "getOutputBuffer during stop" }
    return ByteBuffer.allocate(4)
  }
  fun releaseOutputBuffer(index: Int, render: Boolean) {
    check(index == 7 && !render)
    releases++
    gate?.visit("release")
    check(!stopped) { "releaseOutputBuffer during stop" }
  }
  fun stop() { stopped = true }
  fun release() { stopped = true }
}

private class MuxerState {
  var started = true
  var stopped = false
  var writes = 0
  var formats = 0
  var gate: Gate? = null
  fun writeOrBuffer(buf: ByteBuffer, info: MediaCodec.BufferInfo, isAudio: Boolean) {
    check(buf.capacity() == 4 && info.size == 4 && !isAudio)
    writes++
    gate?.visit("write")
    check(!stopped) { "muxer write during stop" }
  }
  fun registerTrack(format: MediaFormat, isAudio: Boolean) {
    check(!isAudio)
    formats++
    gate?.visit("format")
    check(!stopped) { "muxer format during stop" }
  }
}

private class Resource {
  fun release() {}
  fun releaseEgl() {}
  fun recycle() {}
  fun quitSafely() {}
}
private class Handler { fun post(action: () -> Unit) { action() } }
private class Muxer(private val state: MuxerState) {
  fun stop() { state.stopped = true }
  fun release() { state.stopped = true }
}
private class EncoderSession(
  val codecStopped: AtomicBoolean,
  val encoder: MediaCodec,
  val muxerState: MuxerState,
) {
  var audioStopped = false
  val audioEncoder: MediaCodec? = null
  val eglHandler = Handler()
  val egl = Resource()
  val muxer = Muxer(muxerState)
  val inputSurface = Resource()
  val bitmap = Resource()
  val callbackThread = Resource()
  val eglThread = Resource()
}
private object Log {
  fun d(tag: String, message: String) {}
  fun e(tag: String, message: String, error: Throwable) {}
}

private class RecorderHarness {
  val TAG = "fixture"
  val sessionId = "fixture"
  val codecStopped = AtomicBoolean(false)
  val codec = MediaCodec()
  val muxerState = MuxerState()
  val eosLatch = CountDownLatch(1)
  var codecError: MediaCodec.CodecException? = null
  val session = EncoderSession(codecStopped, codec, muxerState)
  val callback = __RECORDER_CALLBACK__

  __RELEASE_SESSION__

  fun stop() = releaseSession(session)
  fun output(flags: Int = 0, size: Int = 4) =
    callback.onOutputBufferAvailable(codec, 7, MediaCodec.BufferInfo(size, flags))
  fun format() = callback.onOutputFormatChanged(codec, MediaFormat())
}

private fun expectFailure(expected: Throwable, block: () -> Unit) {
  var actual: Throwable? = null
  try { block() } catch (error: Throwable) { actual = error }
  check(actual === expected) { "Active/codec error was swallowed or changed: $actual" }
}

fun main() {
  RecorderHarness().apply {
    output()
    check(codec.reads == 1 && codec.releases == 1 && muxerState.writes == 1)
    check(eosLatch.count == 1L)
    format()
    check(muxerState.formats == 1)
  }
  RecorderHarness().apply {
    output(MediaCodec.BUFFER_FLAG_CODEC_CONFIG)
    check(codec.reads == 0 && codec.releases == 1 && muxerState.writes == 0)
  }
  RecorderHarness().apply {
    output(MediaCodec.BUFFER_FLAG_END_OF_STREAM, 0)
    check(codec.releases == 1 && eosLatch.count == 0L)
  }
  RecorderHarness().apply {
    val error = MediaCodec.CodecException()
    callback.onError(codec, error)
    check(codecError === error && eosLatch.count == 0L)
  }
  for (phase in listOf("read", "release", "write", "format")) {
    RecorderHarness().apply {
      val error = IllegalStateException("active failure")
      val gate = Gate(phase, error)
      gate.resume.countDown()
      codec.gate = gate
      muxerState.gate = gate
      expectFailure(error) { if (phase == "format") format() else output() }
    }
  }
  for (phase in listOf("release", "read", "write", "format")) {
    for (codecFailure in listOf(false, true)) {
      val recorder = RecorderHarness()
      val error = if (codecFailure) MediaCodec.CodecException() else null
      val gate = Gate(phase, error)
      recorder.codec.gate = gate
      recorder.muxerState.gate = gate
      val failure = AtomicReference<Throwable?>()
      val callbackThread = Thread {
        try {
          if (phase == "format") recorder.format() else recorder.output()
        } catch (caught: Throwable) { failure.set(caught) }
      }
      callbackThread.start()
      check(gate.entered.await(5, TimeUnit.SECONDS)) { "Callback did not reach $phase" }
      recorder.stop()
      gate.resume.countDown()
      callbackThread.join(5000)
      check(!callbackThread.isAlive) { "Callback did not finish" }
      if (codecFailure) check(failure.get() === error) { "CodecException was swallowed during stop" }
      else check(failure.get() == null) { "Stop race escaped from $phase: ${failure.get()}" }
    }
  }
  RecorderHarness().apply {
    stop()
    output()
    output(MediaCodec.BUFFER_FLAG_CODEC_CONFIG)
    output(MediaCodec.BUFFER_FLAG_END_OF_STREAM, 0)
    format()
    check(codec.reads == 0 && codec.releases == 0 && muxerState.writes == 0 && muxerState.formats == 0)
  }
  println("ok - recorder callbacks preserve normal output, EOS and real errors while surviving queued/in-flight teardown races")
}
