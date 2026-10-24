# StudyShelf V3 — launch readiness checklist

## Completed in the starter source
- [x] Existing responsive storefront retained.
- [x] Existing free Payhip Mathematics URL retained: https://payhip.com/b/alVth.
- [x] Public website supports Firestore's published-only live query once configured.
- [x] New secure-login dashboard source with two-editor workflow, live saving, drafts, conflict detection, backup export and one-time V2 import.
- [x] Firestore security rules supplied to restrict writes and unpublished product reads.
- [x] No tokens, merchant credentials, or paid PDF files embedded in the project.

## Complete with the client before relying on V3
- [ ] Client owns/controls Firebase project and approves developer access.
- [ ] Firebase Google sign-in provider and Authorized domains configured.
- [ ] Firestore security rules reviewed, installed and published.
- [ ] `firebase-config.js` set to enabled true with the correct Firebase web app config.
- [ ] GitHub Pages V3 deployment succeeded and both `/` and `/admin/` load.
- [ ] Client and developer sign in separately; their UIDs are manually added under `admins/{UID}` with appropriate role fields.
- [ ] An unrelated third account does not gain dashboard access.
- [ ] V2 Mathematics sample is imported once; public product list comes from Firestore.
- [ ] A draft product is private to logged-in editors, including when its ID is known.
- [ ] Both authorized editors can save a product and public storefront updates without a new GitHub commit.
- [ ] Editing conflict is rejected rather than silently overwriting another editor's update.
- [ ] Free Payhip sample checkout and PDF delivery verified.
- [ ] Real seller support email and seller-approved refund, privacy, and terms text provided.
- [ ] Displayed price, currency, product details and availability manually verified against Payhip.
- [ ] Paid transaction only after explicit client approval; verify fulfillment and merchant payout separately.
- [ ] Client agrees on backup policy and collaborator revocation procedure.

## Not implemented
Actual file uploads to Firebase Storage, new cover images, Payhip automatic API syncing, customer accounts, customer order management, payment processing, legal/compliance review, or production-grade audit trails.

Keep `testMode` true until the entire checklist is completed and verified on the real deployment.
