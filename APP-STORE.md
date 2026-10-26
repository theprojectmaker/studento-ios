# Studento: App Store submission kit

Prepared 2026-10-25. Nothing here has been submitted. Placeholders to fill in: copyright name,
reviewer contact (name, email, phone) in `store.config.json`, and the contact email in
`docs/privacy.html`.

## What the app does on the network
Verified 2026-10-25. Everything below is optional; the clock, alerts, widgets and themes work
offline.
- **Server**: https://studento-app.pages.dev (Cloudflare Pages Functions + D1; code in `server/`;
  a Pages domain does not drift). Admin kill switches for sign-ups, sharing and the reader
  (Settings > Admin on the owner account).
- **Accounts** (optional): username + password only. PBKDF2-SHA256 (100k iterations, the Workers
  runtime maximum), 16-byte salt; tokens stored hashed; rate limits on sign-up, login and the
  reader. In-app deletion (Settings > Account) removes the user, token and saved data at once
  (App Store 5.1.1(v)). The first account ever created is the owner: admin rights + the owner's
  classes pre-filled.
- **Shared schools and bell schedules**: searching and picking need no account; adding a school
  or publishing a schedule needs one.
- **Schedule reader**: signed in only. The photo (or typed text) goes to the server once and is
  not stored. The model (Gemini 2.5 Pro when the `GEMINI_API_KEY` Pages secret is set, else
  Cloudflare Workers AI) returns structured rows with a confidence per cell; the server validates
  times (ascending, non-overlapping) and cross-checks them against the chosen school's bells; the
  app highlights doubtful rows on the review screen, which the user confirms before saving.
  Signed out: on-device text recognition + a local parser instead.
- Time comes from the device clock; bell alerts are local notifications (push entitlement
  stripped by `plugins/no-push.js`); fonts and icons are bundled. Expo's update service is also
  contacted for over-the-air JavaScript updates (no user data).

## Privacy policy URL
Live at **https://studento-app.pages.dev/privacy** (source `server/public/privacy.html`; Pages
serves clean URLs, `/privacy.html` 308-redirects there). Contact: studentoclockapp@gmail.com.

## Reviewer contact phone (kept OUT of the public repo)
`store.config.json` is committed to a public repo, so the phone number lives only in the
gitignored `store.config.local.json` on this PC (`{"apple":{"review":{"phone":"..."}}}`).
`node scripts/store-config-merge.mjs` merges it into `.eas-metadata/store.config.json`
(gitignored), which `eas.json` names as `submit.production.ios.metadataPath`, so
`npx eas-cli@latest metadata:push --profile production` sends the full contact. Alternative:
type the phone by hand in App Store Connect > App Information > App Review contact.

## App Privacy answers (App Store Connect > App Privacy)
Data is collected only when the user creates an account. Declare:
- **Identifiers > User ID** (the username): collected, linked to the user, App Functionality.
- **User Content > Other User Content** (schedule, class names, settings saved to the account):
  collected, linked to the user, App Functionality.
- **User Content > Photos or Videos**: the scanned photo is sent to the server for App
  Functionality, linked to the user, and not retained (say so in the policy; it does).
- Contact Info (name, email, phone): **not collected**. Location, purchases, usage data,
  diagnostics: not collected.
- Tracking: **No**. Third parties: the AI provider receives the photo or text only to answer that
  request.

## Review notes
In `store.config.json` > `apple.review.notes`. No demo account. Mentions Settings > Test >
"Pretend it's Period 3" so a reviewer can see the countdown, widgets and Live Activity at any
hour.

## Export compliance
`ITSAppUsesNonExemptEncryption: false` is set in `app.json` (no custom encryption).

## Age rating
4+ (no objectionable content). Made for students; no accounts, so no COPPA data concerns.

## Screenshot plan
Use the TestFlight build with Settings > Test > "Pretend it's Period 3" on, Motion on.
Required sizes (upload the largest of each class; App Store Connect scales down):
- iPhone 6.9" (iPhone 16 Pro Max / 17 Pro Max): 1320 x 2868
- iPhone 6.5" (11 Pro Max / XS Max): 1284 x 2778 (optional if 6.9" provided)
- iPad 13" (iPad Pro M4): 2064 x 2752

Shots (same order for iPhone and iPad):
1. Clock screen, Train Station theme, Period 3 countdown "21:33", Classic layout.
2. Clock screen, Jackpot (casino reels) theme.
3. Clock screen, Gatsby (gold Art Deco) theme.
4. Themes screen (grid of boards).
5. Home Screen with the medium Studento widget + small Studento Clock widget.
6. Lock Screen with the Live Activity banner during a class.
7. Settings > Lock mode / "On the clock screen" options.
8. (iPad) Landscape clock screen.

Take them with the device's own screenshot (Side + Volume Up); the Lock Screen one needs the
Live Activity running (open the app during the test period, then lock the phone).

## App Store Connect fields not in store.config.json
- Primary category: Education. Secondary: Utilities.
- Content rights: no third-party content.
- Pricing: Free.
- Build: pick the 1.1.0 TestFlight build once it is processed.

## Submit with EAS Metadata (optional)
`npx eas-cli@latest metadata:push` uploads `store.config.json` (title, description, keywords,
review info, privacy URL). Screenshots are uploaded in App Store Connect by hand.
