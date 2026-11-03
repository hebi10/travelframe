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
        ClickTarget click = null;
        String acknowledgement = null;
        int status = 1;
        try {
            if (args.length != 1 && (args.length != 3 || !"--click-label".equals(args[1]) || args[2].isEmpty())) {
                throw new IllegalArgumentException("Expected absolute unique output XML path [--click-label exact-label]");
            }
            File output = new File(args[0]);
            if (!output.isAbsolute() || output.exists()) throw new IOException("Output must be absolute and must not already exist: " + output);
            if (Process.myUid() != 2000) throw new SecurityException("Run this QA helper as Android shell UID 2000");
            File parent = output.getParentFile();
            if (parent == null || !parent.isDirectory()) throw new IOException("Output parent does not exist");

            // Standalone app_process has no ActivityThread to prepare the main
            // Looper. API 35 AccessibilityInteractionClient constructs a Handler
            // against getMainLooper() even on UiAutomation's callback thread.
            // Queries remain synchronous; the dedicated callback thread loops.
            if (Looper.getMainLooper() == null) Looper.prepareMainLooper();
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
            Snapshot snapshot;
            if (args.length == 3) {
                snapshot = acquireClick(automation, args[2], output);
                click = snapshot.click;
                try { click.perform(); } finally { publish(output, snapshot.render()); }
            } else {
                snapshot = snapshot(automation, null);
                publish(output, snapshot.render());
            }
            acknowledgement = (click == null ? "BODY_FRAME_QA_HIERARCHY_DUMPED " : "BODY_FRAME_QA_HIERARCHY_CLICKED ") + args[0];
            status = 0;
        } catch (Throwable error) {
            Throwable cause = error instanceof InvocationTargetException && error.getCause() != null ? error.getCause() : error;
            System.err.println("BODY_FRAME_QA_HIERARCHY_FAILED " + cause.getClass().getName() + ": " + cause.getMessage());
            cause.printStackTrace(System.err);
        } finally {
            if (click != null) click.recycle();
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
        }
        if (status == 0) { System.out.println(acknowledgement); System.out.flush(); }
        System.exit(status);
    }

    private static void publish(File output, String xml) throws IOException {
        File temporary = File.createTempFile("body-frame-qa-hierarchy-", ".xml.tmp", output.getParentFile());
        try {
            try (FileOutputStream stream = new FileOutputStream(temporary)) {
                stream.write(xml.getBytes(StandardCharsets.UTF_8));
                stream.flush();
                stream.getFD().sync();
            }
            if (!temporary.renameTo(output)) throw new IOException("Cannot publish hierarchy output: " + output);
        } finally {
            if (temporary.exists() && !temporary.delete()) System.err.println("BODY_FRAME_QA_HIERARCHY_TEMP_DELETE_FAILED " + temporary);
        }
    }

    private static final class Snapshot {
        final String xml;
        final ClickTarget click;
        Snapshot(String xml, ClickTarget click) { this.xml = xml; this.click = click; }
        String render() {
            if (click == null) return xml;
            StringBuilder metadata = new StringBuilder();
            attribute(metadata, "action", "accessibility-click");
            attribute(metadata, "requested-click-label", click.label);
            attribute(metadata, "click-target-bounds", click.bounds == null ? "" : click.bounds.toShortString());
            attribute(metadata, "candidate-count", Integer.toString(click.candidates));
            attribute(metadata, "enabled-candidate-count", Integer.toString(click.enabledCandidates));
            attribute(metadata, "fully-visible-candidate-count", Integer.toString(click.matches));
            attribute(metadata, "candidate-details", click.details);
            attribute(metadata, "acquisition-attempts", Integer.toString(click.attempts));
            attribute(metadata, "click-window-bounds", click.windowBounds.toShortString());
            attribute(metadata, "click-window-package", click.windowPackage);
            attribute(metadata, "click-action-count", Integer.toString(click.actions));
            attribute(metadata, "show-on-screen-action-count", Integer.toString(click.showActions));
            attribute(metadata, "show-on-screen-result", click.showResult);
            return new StringBuilder(xml).insert(xml.indexOf(">", xml.indexOf("<hierarchy")), metadata).toString();
        }
    }

    private static Snapshot snapshot(UiAutomation automation, String label) throws IOException {
        AccessibilityNodeInfo root = freshRoot(automation);
        ClickTarget click = null;
        try {
            if (label != null) {
                Rect window = new Rect(); root.getBoundsInScreen(window);
                click = new ClickTarget(label, window);
                click.windowPackage = String.valueOf(root.getPackageName());
            }
            StringBuilder xml = new StringBuilder(16384);
            xml.append("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><hierarchy rotation=\"0\" generated-at-ms=\"").append(System.currentTimeMillis()).append("\">");
            int[] count = {0};
            appendNode(xml, root, 0, 0, count, null, click, true);
            if (count[0] == 0) throw new IOException("No refreshed nodes in the active window");
            xml.append("</hierarchy>");
            return new Snapshot(xml.toString(), click);
        } catch (Throwable error) {
            if (click != null) click.recycle();
            throw error;
        } finally { root.recycle(); }
    }

    private static Snapshot acquireClick(UiAutomation automation, String label, File output) throws IOException {
        long deadline = SystemClock.uptimeMillis() + 5000;
        int attempts = 0, shows = 0;
        String showResult = "not-requested";
        while (true) {
            automation.clearCache();
            Snapshot current = snapshot(automation, label);
            ClickTarget target = current.click;
            boolean retained = false;
            try {
                target.attempts = ++attempts;
                target.showActions = shows;
                target.showResult = showResult;
                // Keep the actual queried tree and candidate geometry even on rejection.
                publish(output, current.render());
                publish(new File(output.getPath() + ".attempt-" + attempts + ".xml"), current.render());
                if (target.enabledCandidates > 1 || target.matches > 1) throw new IOException("Ambiguous exact-label accessibility targets: " + target.enabledCandidates);
                if (target.matches == 1) { retained = true; return current; }
                if (shows == 0 && !target.windowBounds.isEmpty() && target.enabledCandidates == 1 && target.revealNode != null) {
                    shows++;
                    target.showActions = shows;
                    showResult = Boolean.toString(target.revealNode.performAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_SHOW_ON_SCREEN.getId()));
                    target.showResult = showResult;
                    publish(output, current.render());
                }
                if (SystemClock.uptimeMillis() >= deadline) {
                    target.requireUnique();
                    throw new IOException("Accessibility target acquisition expired");
                }
            } finally { if (!retained) target.recycle(); }
            SystemClock.sleep(100);
        }
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

    private static void appendNode(StringBuilder xml, AccessibilityNodeInfo node, int index, int depth, int[] count, Rect scrollClip, ClickTarget click, boolean ancestorsEnabled) throws IOException {
        if (depth > MAX_DEPTH || count[0] >= MAX_NODES) throw new IOException("Accessibility hierarchy exceeds bounded traversal limits");
        if (!node.refresh()) return;
        boolean visible = node.isVisibleToUser();
        Rect rawBounds = new Rect();
        node.getBoundsInScreen(rawBounds);
        Rect bounds = new Rect(rawBounds);
        if (scrollClip != null && !bounds.intersect(scrollClip)) bounds.setEmpty();
        if (click == null && (!visible || bounds.isEmpty())) return;
        count[0]++;
        boolean enabled = ancestorsEnabled && node.isEnabled();
        if (click != null) click.consider(node, rawBounds, bounds, scrollClip, enabled);
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
        attribute(xml, "visible-to-user", Boolean.toString(visible));
        attribute(xml, "raw-bounds", "[" + rawBounds.left + "," + rawBounds.top + "][" + rawBounds.right + "," + rawBounds.bottom + "]");
        attribute(xml, "bounds", "[" + bounds.left + "," + bounds.top + "][" + bounds.right + "," + bounds.bottom + "]");
        xml.append('>');
        for (int childIndex = 0; childIndex < node.getChildCount(); childIndex++) {
            AccessibilityNodeInfo child = node.getChild(childIndex);
            if (child == null) continue;
            try { appendNode(xml, child, childIndex, depth + 1, count, childClip, click, enabled); } finally { child.recycle(); }
        }
        xml.append("</node>");
    }

    /** Retains one native accessibility target until ACTION_CLICK completes. */
    private static final class ClickTarget {
        final String label;
        final Rect windowBounds;
        AccessibilityNodeInfo node;
        Rect bounds;
        Rect scrollClip;
        int matches, candidates, enabledCandidates, attempts, actions, showActions;
        AccessibilityNodeInfo revealNode;
        String windowPackage = "", showResult = "not-requested";
        final StringBuilder details = new StringBuilder();

        ClickTarget(String label, Rect windowBounds) {
            this.label = label;
            this.windowBounds = new Rect(windowBounds);
        }

        private boolean exactLabel(AccessibilityNodeInfo candidate) {
            return label.contentEquals(candidate.getText() == null ? "" : candidate.getText())
                    || label.contentEquals(candidate.getContentDescription() == null ? "" : candidate.getContentDescription());
        }

        void consider(AccessibilityNodeInfo candidate, Rect raw, Rect visible, Rect clip, boolean ancestorsEnabled) {
            if (!candidate.isClickable() || !exactLabel(candidate)) return;
            candidates++;
            boolean enabled = candidate.isEnabled() && ancestorsEnabled;
            details.append("candidate=").append(candidates).append(" raw=").append(raw.toShortString())
                    .append(" clipped=").append(visible.toShortString()).append(" enabled=").append(enabled)
                    .append(" visible=").append(candidate.isVisibleToUser()).append(" ancestor-enabled=").append(ancestorsEnabled).append(';');
            // Hidden/offscreen nodes can expose SHOW_ON_SCREEN; never CLICK them.
            if (!enabled) return;
            enabledCandidates++;
            if (revealNode == null) revealNode = AccessibilityNodeInfo.obtain(candidate);
            if (!candidate.isVisibleToUser() || !raw.equals(visible) || raw.isEmpty() || !windowBounds.contains(raw)) return;
            matches++;
            if (node == null) {
                node = AccessibilityNodeInfo.obtain(candidate);
                bounds = new Rect(raw);
                scrollClip = clip == null ? null : new Rect(clip);
            }
        }

        void requireUnique() throws IOException {
            if (matches != 1) throw new IOException("Expected one fully visible enabled clickable exact-label target; found " + matches + " for " + label);
        }

        void perform() throws IOException {
            requireUnique();
            if (!node.refresh() || !node.isVisibleToUser() || !node.isEnabled() || !node.isClickable() || !exactLabel(node)) {
                throw new IOException("Accessibility target changed before click: " + label);
            }
            Rect current = new Rect();
            node.getBoundsInScreen(current);
            if (current.isEmpty() || !windowBounds.contains(current) || (scrollClip != null && !scrollClip.contains(current))) {
                throw new IOException("Accessibility target is no longer fully visible: " + label);
            }
            actions++;
            if (!node.performAction(AccessibilityNodeInfo.ACTION_CLICK)) throw new IOException("Native accessibility ACTION_CLICK rejected: " + label);
        }

        void recycle() { if (node != null) node.recycle(); if (revealNode != null) revealNode.recycle(); }
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
