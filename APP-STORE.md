# Studento: App Store submission kit

Prepared 2026-10-25. Nothing here has been submitted. Placeholders to fill in: copyright name,
reviewer contact (name, email, phone) in `store.config.json`, and the contact email in
`docs/privacy.html`.

## What the app does on the network: nothing of ours
Verified by grepping `src`, `plugins` and `app.json` for `fetch`, `XMLHttpRequest`, `WebSocket`
and `http(s)://` on 2026-10-25:
- The shared-schedule server and the AI scan (`src/lib/api.ts`) are **removed**. Class names,
  rooms, custom days and the today-switch are kept on the device.
- Schedule scan = on-device text recognition (Apple Vision via `expo-text-extractor`) + a local
  parser (`src/lib/scheduleParser.ts`, unit-tested).
- Time comes from the device clock (`src/lib/nytime.ts`, no NTP).
- Bell alerts are local notifications; the push entitlement and the remote-notification
  background mode are stripped by `plugins/no-push.js`.
- Fonts and icons are bundled.
- The one remaining contact is Expo's update service (`updates.url` in `app.json`), used for
  over-the-air JavaScript updates. It receives no user data. Remove the `updates` block and
  `expo-updates` if the app must make zero outside requests.

## Privacy policy URL (needed by App Store Connect)
`docs/privacy.html` is ready. Options, cheapest first:
1. **GitHub Pages on this public repo**: repo Settings > Pages > Source "Deploy from a branch",
   branch `main`, folder `/docs`. URL becomes
   `https://theprojectmaker.github.io/studento-ios/privacy.html` (already in `store.config.json`).
2. Cloudflare Pages (any `*.pages.dev`), copy the file there.
3. Any site the user already owns.

## App Privacy answers (App Store Connect > App Privacy)
- **Data Not Collected.** Studento collects no data types. Photos are processed on-device and not
  stored by the app; notes/grades/schedule are user content saved only on the device.
- Tracking: No.

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
