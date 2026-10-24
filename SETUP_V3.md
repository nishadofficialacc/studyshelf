# StudyShelf V3 — Secure shared-management setup

This version works in demo mode with the existing `data/catalog.json` until Firebase is configured. Once Firebase is enabled, **Firestore is the source of truth** for products. GitHub remains the static website host; Payhip remains the checkout/download provider.

## Before you start
- Have permission from the client to configure this infrastructure.
- The client should control the Firebase project (or arrange appropriate admin access), Payhip merchant account, domain, and business data. Use eligible adult account holders where required by service terms.
- Keep the current V2 repository ZIP backup; avoid replacing the live store without testing.
- Never put a Firebase **service-account private key**, GitHub personal access token, Payhip password, or payment details in website source files.

## A. Firebase project (project owner)
1. Sign in to https://console.firebase.google.com/ and create a Firebase project named for the client, e.g. `studyshelf-client` (the project ID must be globally unique). Use the client's account as project owner.
2. Choose **Add app → Web** (the `</>` icon) and register a web app. Hosting can be skipped: GitHub Pages hosts the site.
3. Copy the Firebase **web app config** fields `apiKey`, `authDomain`, `projectId`, and `appId`. The public web app config isn't an administrative secret; Firestore rules are the security boundary. Do not copy any service-account JSON.
4. Under **Build → Authentication**, select **Get started**, then enable **Google** as a sign-in provider. Set the support email where prompted.
5. In Authentication settings, locate **Authorized domains** and add `nishadofficialacc.github.io`. Also add your client's final custom domain when it exists. A plain GitHub username or repo path is not an authorized domain.
6. Under **Build → Firestore Database**, create the database. Choose production/locked rules, not unrestricted test access. Region is a deployment decision; select based on expected customers and residency requirements.
7. Open **Firestore Database → Rules**, replace the default rules with the entire contents of `firestore.rules`, and **Publish** the rules. Read the file before publishing; don't use `allow read, write: if true`.

Console menu labels can shift over time. Firebase pricing and quota requirements may change; review them in the Firebase console before enabling billing. This starter does not require Firebase Hosting.

## B. Enable Firebase in the website (developer)
1. Open `firebase-config.js` in the project root.
2. Replace the four placeholders with the config fields from Firebase's **web app** setup (quoted JavaScript strings). Set `enabled: true`.
3. Do **not** insert any tokens into HTML or JavaScript; the web app config is the only Firebase configuration needed.
4. Upload the V3 files to the GitHub repository **root**. `index.html`, `app.js`, `firebase-config.js`, `styles.css`, `firestore.rules`, `admin/`, `data/`, and `assets/` must be at the appropriate paths. GitHub Pages remains `main` + `/(root)`.
5. Confirm the Pages deployment is successful before proceeding.

## C. Approve first editor (project owner in Firebase Console)
1. Visit `https://nishadofficialacc.github.io/studyshelf/admin/`.
2. Select **Continue with Google** and sign in as the client (or the developer, with client permission).
3. A signed-in-but-unapproved screen displays the **UID**. Copy it. **Do not** copy passwords or share sign-in codes.
4. In Firebase Console open **Firestore Database → Data**, start a collection named **`admins`**.
5. Create a document whose **Document ID** is the copied Firebase UID. Add a field named **`role`**, type **string**, value **`owner`** for the client or **`editor`** for the developer.
6. Refresh the `/admin/` page. It should now show the protected editor.
7. Repeat the sign-in + UID + manual role-document process for the second person. **Inviting someone to GitHub does not grant Firebase permissions.**

Important: only project administrators should create or edit `admins` documents in Firebase Console. The website cannot grant itself access; security rules forbid role changes from browsers.

## D. Bring across the Mathematics sample
1. Sign in to `/admin/` as an approved editor.
2. Click **Import V2 sample (once)**. This imports the saved free Mathematics listing and demo store settings from `data/catalog.json` to Firestore. It refuses to import if any product already exists, preventing accidental overwrites.
3. Open the public website in a separate/incognito browser. Verify the Mathematics card displays **FREE**.
4. Open Mathematics and follow `https://payhip.com/b/alVth` to ensure it reaches the correct Payhip listing.
5. Complete the authorized free sample download through Payhip, if it wasn't already tested.

## E. Add a shared draft and publish it
1. In `/admin/`, select **+ Add**. Enter a unique product ID such as `biology-cell-structure` and product details. Leave **Published on storefront** unticked.
2. Click **Save product to live database**. It should appear in the editor as **Draft**, but not on the public website, including in an incognito window.
3. The client creates the corresponding real product on Payhip, uploading the paid PDF there only, and gives you its verified product URL.
4. In the dashboard, edit the draft, verify displayed price and page count against Payhip, fill in `https://payhip.com/b/...`, tick **Published on storefront** and Save.
5. Reload the public website. The product should appear without a GitHub commit. Inspect its product card, preview (if present) and Payhip checkout link.

## F. Save store settings and hand over
1. Add the client's real support email in the Store settings panel. Keep **demo/test store** checked until launch readiness is verified.
2. Confirm currency reflects how the client lists products on Payhip. The storefront price is only a display value; Payhip is authoritative at checkout.
3. Export a catalog backup after meaningful changes; store it securely. There is no one-click restore in this starter dashboard.
4. Review Terms, Refunds, Privacy and Contact sections with the client before a public sales launch. The V3 template does **not** include fully reviewed legal policies, tax configurations, or payment reconciliation.
5. Test on a phone and a desktop. Verify that an **unapproved** Google account cannot open the editor and anonymous site visitors cannot read unpublished drafts through Firestore.

## Shared work rules
- The client owns Payhip product data, PDF contents, prices, legal claims, revenue and seller communication.
- The developer handles the frontend, technical changes, GitHub Pages deployment, and infrastructure maintenance by agreement.
- Either authorized editor can create/edit/publish products and store settings. If both are editing the same product, V3 blocks overwriting edits based on its last update timestamp. Coordinate major changes.
- When an editor leaves, the project owner **deletes that person's `admins/{UID}` Firestore document**. Their Google sign-in might continue to exist, but they lose catalog-editing access.

## Troubleshooting
- **Website still shows demo catalog:** `enabled` remains false; V3 loads local `data/catalog.json` in demo mode.
- **Website says Library unavailable:** check Firebase config, Firestore rules and network. Once enabled, V3 intentionally does not fall back to static products.
- **Google login rejected:** add the exact Pages host to Authorized domains and check Google sign-in provider.
- **Permission denied after signing in:** role document must be `admins/{exact auth UID}` with field `role: owner` or `role: editor`.
- **Public product doesn't appear:** it must be Published in Firestore and have a valid direct Payhip link. Check Firestore `products` and browser console.
- **Cannot save store settings:** verify role permissions and valid support email. Turning test mode off requires a nonempty email.
- **Editor cannot view a draft:** check owner/editor role; public reads are limited to published products.
- **Data migration conflict:** Import V2 sample only works with empty `products`. Back up existing items before making any manual changes.
- **Trying to upload full PDFs to GitHub:** don't. Full paid files belong in Payhip. Assets is public.

## Not included in this V3 starter
- Automatic sync of Payhip price and product status to Firestore; manually confirm displayed prices match Payhip.
- Customer sign-up or customer downloads on StudyShelf (Payhip handles checkout and delivery).
- File upload/cover image storage (covers use generated palettes, public sample files go to GitHub).
- Automated invoices, financial records, refunds, taxes, email automation, audit history or full editorial approvals.
- Firebase project/Google account creation, merchant verification or actual security test in your own Firebase project; you must perform setup and test steps above.
