import android.accessibilityservice.AccessibilityServiceInfo;
import android.app.UiAutomation;
import android.graphics.Rect;
import android.os.HandlerThread;
import android.os.Looper;
import android.os.Process;
import android.os.SystemClock;
import android.view.accessibility.AccessibilityNodeInfo;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.lang.reflect.Constructor;
import java.lang.reflect.InvocationTargetException;
import java.nio.charset.StandardCharsets;

/**
 * Disposable emulator QA helper, invoked by shell UID through app_process.
 * Uses no app dependencies and never calls waitForIdle or changes device settings.
 *
 * Bootstrapping reflects AOSP's hidden UiAutomation(Looper,
 * IUiAutomationConnection), UiAutomationConnection(), connect(int), and disconnect().
 * These are not SDK APIs: runtime denial is an explicit failure, never a legacy dump fallback.
 * Tree inspection itself uses public AccessibilityNodeInfo APIs.
 */
public final class BodyFrameQaHierarchy {
    private static final int MAX_NODES = 20000;
    private static final int MAX_DEPTH = 128;

    private BodyFrameQaHierarchy() {}

    public static void main(String[] args) {
        HandlerThread thread = null;
        UiAutomation automation = null;
        File temporary = null;
        String acknowledgement = null;
        int status = 1;
        try {
            if (args.length != 1) throw new IllegalArgumentException("Expected one absolute, unique output XML path");
            File output = new File(args[0]);
            if (!output.isAbsolute() || output.exists()) throw new IOException("Output must be absolute and must not already exist: " + output);
            if (Process.myUid() != 2000) throw new SecurityException("Run this QA helper as Android shell UID 2000");
            File parent = output.getParentFile();
            if (parent == null || !parent.isDirectory()) throw new IOException("Output parent does not exist");

            thread = new HandlerThread("BodyFrameQaHierarchy");
            thread.start();
            Class<?> connectionClass = Class.forName("android.app.UiAutomationConnection");
            Constructor<?> connectionConstructor = connectionClass.getDeclaredConstructor();
            connectionConstructor.setAccessible(true);
            Object connection = connectionConstructor.newInstance();
            Class<?> connectionInterface = Class.forName("android.app.IUiAutomationConnection");
            Constructor<UiAutomation> constructor = UiAutomation.class.getDeclaredConstructor(Looper.class, connectionInterface);
            constructor.setAccessible(true);
            automation = constructor.newInstance(thread.getLooper(), connection);
            UiAutomation.class.getMethod("connect", int.class).invoke(automation, UiAutomation.FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES);

            AccessibilityServiceInfo info = automation.getServiceInfo();
            if (info == null) throw new IOException("UiAutomation connected without service information");
            info.flags |= AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS | AccessibilityServiceInfo.FLAG_INCLUDE_NOT_IMPORTANT_VIEWS;
            info.notificationTimeout = 0;
            automation.setServiceInfo(info);
            AccessibilityNodeInfo root = freshRoot(automation);
            StringBuilder xml = new StringBuilder(16384);
            xml.append("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><hierarchy rotation=\"0\" generated-at-ms=\"").append(System.currentTimeMillis()).append("\">");
            int[] count = {0};
            try {
                appendNode(xml, root, 0, 0, count, null);
            } finally {
                root.recycle();
            }
            if (count[0] == 0) throw new IOException("No refreshed visible nodes in the active window");
            xml.append("</hierarchy>");
            temporary = File.createTempFile("body-frame-qa-hierarchy-", ".xml.tmp", parent);
            try (FileOutputStream stream = new FileOutputStream(temporary)) {
                stream.write(xml.toString().getBytes(StandardCharsets.UTF_8));
                stream.flush();
                stream.getFD().sync();
            }
            if (!temporary.renameTo(output)) throw new IOException("Cannot publish hierarchy output: " + output);
            temporary = null;
            acknowledgement = "BODY_FRAME_QA_HIERARCHY_DUMPED " + args[0];
            status = 0;
        } catch (Throwable error) {
            Throwable cause = error instanceof InvocationTargetException && error.getCause() != null ? error.getCause() : error;
            System.err.println("BODY_FRAME_QA_HIERARCHY_FAILED " + cause.getClass().getName() + ": " + cause.getMessage());
            cause.printStackTrace(System.err);
        } finally {
            if (automation != null) {
                try {
                    UiAutomation.class.getMethod("disconnect").invoke(automation);
                } catch (Throwable error) {
                    System.err.println("BODY_FRAME_QA_HIERARCHY_DISCONNECT_FAILED " + error);
                    status = 1;
                }
            }
            if (thread != null) {
                thread.quitSafely();
                try { thread.join(2000); } catch (InterruptedException error) { Thread.currentThread().interrupt(); status = 1; }
            }
            if (temporary != null && !temporary.delete()) System.err.println("BODY_FRAME_QA_HIERARCHY_TEMP_DELETE_FAILED " + temporary);
        }
        if (status == 0) { System.out.println(acknowledgement); System.out.flush(); }
        System.exit(status);
    }

    private static AccessibilityNodeInfo freshRoot(UiAutomation automation) throws IOException {
        long deadline = SystemClock.uptimeMillis() + 3000;
        do {
            AccessibilityNodeInfo root = automation.getRootInActiveWindow();
            if (root != null) {
                if (root.refresh() && root.isVisibleToUser()) return root;
                root.recycle();
            }
            if (SystemClock.uptimeMillis() >= deadline) break;
            SystemClock.sleep(100);
        } while (true);
        throw new IOException("No refreshed visible active-window root within 3 seconds");
    }

    private static void appendNode(StringBuilder xml, AccessibilityNodeInfo node, int index, int depth, int[] count, Rect scrollClip) throws IOException {
        if (depth > MAX_DEPTH || count[0] >= MAX_NODES) throw new IOException("Accessibility hierarchy exceeds bounded traversal limits");
        if (!node.refresh() || !node.isVisibleToUser()) return;
        Rect rawBounds = new Rect();
        node.getBoundsInScreen(rawBounds);
        Rect bounds = new Rect(rawBounds);
        if (bounds.isEmpty() || (scrollClip != null && !bounds.intersect(scrollClip))) return;
        count[0]++;
        // Preserve overflow-visible ordinary View parents. Only scrolling
        // ancestors constrain descendant action bounds; retain raw geometry too.
        String className = String.valueOf(node.getClassName());
        Rect childClip = node.isScrollable() || className.contains("ScrollView") || className.contains("RecyclerView")
                ? new Rect(bounds) : scrollClip;
        xml.append("<node");
        attribute(xml, "index", Integer.toString(index));
        attribute(xml, "text", node.getText());
        attribute(xml, "resource-id", node.getViewIdResourceName());
        attribute(xml, "class", node.getClassName());
        attribute(xml, "package", node.getPackageName());
        attribute(xml, "content-desc", node.getContentDescription());
        attribute(xml, "checkable", Boolean.toString(node.isCheckable()));
        attribute(xml, "checked", Boolean.toString(node.isChecked()));
        attribute(xml, "clickable", Boolean.toString(node.isClickable()));
        attribute(xml, "enabled", Boolean.toString(node.isEnabled()));
        attribute(xml, "focusable", Boolean.toString(node.isFocusable()));
        attribute(xml, "focused", Boolean.toString(node.isFocused()));
        attribute(xml, "scrollable", Boolean.toString(node.isScrollable()));
        attribute(xml, "long-clickable", Boolean.toString(node.isLongClickable()));
        attribute(xml, "password", Boolean.toString(node.isPassword()));
        attribute(xml, "selected", Boolean.toString(node.isSelected()));
        attribute(xml, "visible-to-user", "true");
        attribute(xml, "raw-bounds", "[" + rawBounds.left + "," + rawBounds.top + "][" + rawBounds.right + "," + rawBounds.bottom + "]");
        attribute(xml, "bounds", "[" + bounds.left + "," + bounds.top + "][" + bounds.right + "," + bounds.bottom + "]");
        xml.append('>');
        for (int childIndex = 0; childIndex < node.getChildCount(); childIndex++) {
            AccessibilityNodeInfo child = node.getChild(childIndex);
            if (child == null) continue;
            try { appendNode(xml, child, childIndex, depth + 1, count, childClip); } finally { child.recycle(); }
        }
        xml.append("</node>");
    }

    private static void attribute(StringBuilder xml, String name, CharSequence value) {
        xml.append(' ').append(name).append("=\"").append(escape(value)).append('"');
    }

    static String escape(CharSequence value) {
        if (value == null) return "";
        StringBuilder out = new StringBuilder(value.length());
        for (int index = 0; index < value.length();) {
            int code = Character.codePointAt(value, index);
            index += Character.charCount(code);
            switch (code) {
                case '&': out.append("&amp;"); break;
                case '<': out.append("&lt;"); break;
                case '>': out.append("&gt;"); break;
                case '"': out.append("&quot;"); break;
                case '\t': out.append("&#9;"); break;
                case '\n': out.append("&#10;"); break;
                case '\r': out.append("&#13;"); break;
                default:
                    if ((code >= 0x20 && code <= 0xD7FF) || (code >= 0xE000 && code <= 0xFFFD) || (code >= 0x10000 && code <= 0x10FFFF)) out.appendCodePoint(code);
                    else out.append('\uFFFD');
            }
        }
        return out.toString();
    }
}
