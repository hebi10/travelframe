import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.CodeSigner;
import java.security.MessageDigest;
import java.security.cert.X509Certificate;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.Set;
import java.util.jar.JarEntry;
import java.util.jar.JarFile;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import org.w3c.dom.Element;

public class VerifyPlayBundle {
    public static void main(String[] args) throws Exception {
        if (args.length == 4 && args[0].equals("--manifest")) {
            verifyManifest(args[1], args[2], args[3]);
            return;
        }
        if (args.length != 5) throw new IllegalArgumentException("Expected bundle, fingerprint, manifest, versionCode and versionName");
        String fingerprint = args[1];
        Set<String> entries = new HashSet<>();
        boolean arm64 = false;
        try (JarFile bundle = new JarFile(args[0], true)) {
            var enumeration = bundle.entries();
            while (enumeration.hasMoreElements()) {
                JarEntry entry = enumeration.nextElement();
                if (!entries.add(entry.getName())) throw new SecurityException("Duplicate bundle ZIP entry");
                if (entry.isDirectory() || entry.getName().startsWith("META-INF/")) continue;
                try (InputStream stream = bundle.getInputStream(entry)) { stream.transferTo(java.io.OutputStream.nullOutputStream()); }
                CodeSigner[] signers = entry.getCodeSigners();
                if (signers == null || signers.length != 1) throw new SecurityException("Unsigned or multiply signed bundle payload");
                X509Certificate certificate = (X509Certificate) signers[0].getSignerCertPath().getCertificates().get(0);
                certificate.checkValidity();
                if (certificate.getSubjectX500Principal().getName().toLowerCase().contains("android debug")) throw new SecurityException("Debug certificate is forbidden");
                String actual = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(certificate.getEncoded()));
                if (!actual.equals(fingerprint)) throw new SecurityException("Bundle signer does not match the existing Play upload certificate");
                if (entry.getName().startsWith("base/lib/arm64-v8a/") && entry.getName().endsWith(".so") && entry.getSize() > 0) arm64 = true;
            }
            for (String required : new String[] {"BundleConfig.pb", "base/manifest/AndroidManifest.xml", "base/assets/index.android.bundle", "base/dex/classes.dex"}) {
                JarEntry entry = bundle.getJarEntry(required);
                if (entry == null || entry.getSize() <= 0) throw new SecurityException("Missing or empty release bundle content: " + required);
            }
            String javascript;
            try (InputStream stream = bundle.getInputStream(bundle.getJarEntry("base/assets/index.android.bundle"))) {
                javascript = new String(stream.readAllBytes(), java.nio.charset.StandardCharsets.ISO_8859_1);
            }
            for (String name : new String[] {"EXPO_PUBLIC_FIREBASE_API_KEY", "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN", "EXPO_PUBLIC_FIREBASE_PROJECT_ID", "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET", "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", "EXPO_PUBLIC_FIREBASE_APP_ID", "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID"}) {
                String value = System.getenv(name);
                if (value == null || value.isEmpty() || !javascript.contains(value)) throw new SecurityException("Production configuration is missing from the embedded bundle: " + name);
            }
        }
        if (!arm64) throw new SecurityException("ARM64 native libraries are missing");
        verifyManifest(args[2], args[3], args[4]);
        System.out.println("Verified every bundle payload signature, release contents and actual AAB manifest");
    }

    private static void verifyManifest(String manifestPath, String versionCode, String versionName) throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
        factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
        factory.setNamespaceAware(true);
        Element manifest = factory.newDocumentBuilder().parse(Path.of(manifestPath).toFile()).getDocumentElement();
        String android = "http://schemas.android.com/apk/res/android";
        if (!manifest.getAttribute("package").equals("com.haebi.photoguide")) throw new SecurityException("Wrong package ID");
        if (!manifest.getAttributeNS(android, "versionCode").equals(versionCode)) throw new SecurityException("Wrong Android versionCode");
        if (!manifest.getAttributeNS(android, "versionName").equals(versionName)) throw new SecurityException("Wrong Android versionName");
        var applications = manifest.getElementsByTagName("application");
        if (applications.getLength() != 1) throw new SecurityException("Expected one application manifest element");
        Element application = (Element) applications.item(0);
        if (application.hasAttributeNS(android, "debuggable") && !application.getAttributeNS(android, "debuggable").equals("false")) throw new SecurityException("Debuggable AAB is forbidden");
        if (application.hasAttributeNS(android, "testOnly") && !application.getAttributeNS(android, "testOnly").equals("false")) throw new SecurityException("Test-only AAB is forbidden");
    }
}
