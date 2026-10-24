# StudyShelf V3 — Shared authenticated catalog manager

**Public:** `/index.html` and `app.js` on GitHub Pages. Products load from Firestore when Firebase is enabled.

**Admin:** `/admin/` uses Firebase Authentication (Google sign-in) + Firestore `admins/{UID}` role allowlist; editors can save listings immediately.

**Checkout:** Payhip, never StudyShelf. Existing sample: `https://payhip.com/b/alVth` (free).

**Begin:** Follow `SETUP_V3.md` in order. `firebase-config.js` starts with `enabled: false` so V2 demo catalog remains available while you configure Google Auth and Firestore. Install `firestore.rules` into the Firebase console **before** activating the web config. These database rules, not hiding the `/admin/` URL, enforce access controls.

**Security note:** Firebase web app config may be published. Service account private keys, Payhip passwords, and access tokens must not be published. Public sample PDFs under `assets/` are downloadable by anyone; only full paid notes should be in Payhip.

**Role revocation:** The project owner deletes the corresponding `admins/{UID}` document in Firestore to remove editor permissions. Only console administrators can assign roles.

**No automatic Payhip sync:** Product pricing and availability in Payhip must be confirmed manually for every published product. Firestore is not a payment processor.
