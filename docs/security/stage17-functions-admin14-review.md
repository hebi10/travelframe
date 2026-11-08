# Functions Firebase Admin 14.5.0 compatibility candidate (2026-11-08)

Current production source main 080b67887dcde866c332df29806c64590c779256. **Preview only; do not deploy Firebase Functions**.

Firebase Admin 14.4.0+ upgrades its optional Firestore and Storage dependencies, potentially resolving the remaining cloud SDK advisories. Node.js 22 is already configured. Existing Play Billing backend uses `google-auth-library@9.15.1` explicitly; it must remain unchanged until direct API compatibility is evaluated. Firebase Functions remains on 6.6 resolved under `^6.2.0`.

Generate a clean npm lock from npm registry in an isolated, read-only PR GitHub Actions job, collect npm audit before/after, test Functions runtime dependency loading, then attach exact generated lock to PR and remove the temporary workflow. Test current project billing, backup, roles, and Firestore/Storage with test doubles and, before any production deployment, isolated environment integration.

WARNING: Production Functions have not been deployed. No Play AAB/track changes. An npm audit drop is not proof that account ownership or billing is safe.
