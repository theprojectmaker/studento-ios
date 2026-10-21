# Studento: TestFlight checklist

Status as of 2026-10-21. **No EAS build has been run.** Free plan = 15 iOS builds/month shared by three apps, so
ask before every build.

## Already done
- Bundle ID `com.solyapps.studento`, EAS project `@solomonsasson/studento`, runtimeVersion policy `appVersion`
- `ITSAppUsesNonExemptEncryption: false` (no export-compliance prompt)
- App icon is 1024x1024 RGB with no alpha channel (App Store requirement)
- Camera + photo permission strings written for the schedule scan
- Widget + Live Activity extension configured (`com.solyapps.studento.widgets`, app group `group.com.solyapps.studento`)
- Period 3 test mode now defaults OFF (still in Settings > Test)
- Error boundary, photo memory release, throttled foreground refresh
- tsc, lint, 15 unit tests pass

## Before the first build
1. `npx expo install --check` then `npx expo install --fix` — 4 SDK 57 patch updates are pending
   (expo, expo-router, expo-widgets, @expo/ui). Restart Metro after.
2. `npx expo-doctor` must be 21/21.
3. Apple side: the user signs in to EAS/Apple themselves (never type their credentials). An Apple Developer
   membership and an App Store Connect app record for `com.solyapps.studento` are needed.
4. First build must be a **real** build to see: home-screen widget, Lock Screen Live Activity, and background
   refresh. None of these work in Expo Go.
5. Build: `npx eas-cli@latest build --platform ios --profile production` (autoIncrement is on), then
   `npx eas-cli@latest submit --platform ios --latest`.

## Test on the TestFlight build
- First launch shows the welcome screen; "Scan my schedule" is recommended
- Scan a photo several times in a row; the app must stay open
- Allow notifications; "Welcome to Period N" and "ends in 5 min" fire at the right NY times
- Add the widget (small/medium/large + Lock Screen); start and end the Live Activity
- Rotate an iPad: landscape is one stacked column
- Settings > Warnings while open: flash, spoken line, buzz at the 5-minute mark

## Known gaps
- No privacy-policy URL yet (needed before a public App Store release, not for internal TestFlight)
- The shared schedule/class names sync via `studento.greatneck.workers.dev`; the workers.dev name has drifted
  before, so re-verify it (`API_BASE` in `src/lib/api.ts`) before building
- The website's chime sounds are not ported
