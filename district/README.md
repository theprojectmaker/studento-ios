# Getting Studento onto students' devices in New York

Studento is a bell countdown clock. Everything it needs lives on the device. The optional
account holds a username and the student's own class names, nothing else. That makes the New
York paperwork short, but it still has to be done, and the order matters.

## The three things the principal was talking about

1. **Ed Law 2-d.** New York Education Law §2-d is the student-data-privacy law. A district can
   only use software that touches student data after the vendor signs the district's **Data
   Privacy Agreement (DPA)**.
2. **Parents' Bill of Rights.** Every DPA must carry a **Parents' Bill of Rights for Data Privacy
   and Security supplement** that the vendor fills in: what data, why, where it lives, how long,
   how it is protected, how to complain. That is the "P-something". Ours is drafted in
   `PARENTS-BILL-OF-RIGHTS-SUPPLEMENT.md`.
3. **Part 121.** NYSED regulation 8 NYCRR Part 121 is the rulebook that says how 2-d is applied
   (the NIST Cybersecurity Framework, the DPA contents, breach notice within 7 days, staff
   training). The district's data-protection officer checks vendors against it.

## Who decides

Not the principal. Great Neck's Data Privacy and Security page (Office of Instructional
Technology) names **Joseph Cangialosi, Data Protection Officer,
jcangialosi@greatneck.k12.ny.us**, and says software, free or paid, is vetted for 2-d before
use. The approved list lives on the RiconEdPSS DPICT portal (dpict.riconedpss.org, "Great Neck
Supplemental Information"): every free tool there (Blooket, Canva, Boomalang) carries a
"GNPS ... Data Privacy Agreement" marked "District - Free", so expect to sign the district's
own DPA. The portal is a published inventory, not an intake form; the email in
`EMAIL-TO-TECH-DIRECTOR.md` is the first step. Cite: Education Law §2-d, 8 NYCRR Part 121,
Board Policies #8625 (privacy of student data) and #8635 (security breach and notification),
and the Parents' Bill of Rights, Policy 5500-E.

## How the rollout works, in order

1. **App Store listing is live.** Districts can only push apps that are on the App Store (or
   delivered as a Custom App through Apple School Manager). TestFlight or sideloading never goes
   to students. See `../APP-STORE.md` for the submission state.
2. **The district vets the app.** Policy #8625 requires the contract to include the vendor's
   data privacy and security plan, accepted by the district: that is
   `DATA-PRIVACY-AND-SECURITY-PLAN.md`. Also attach the Parents' Bill of Rights supplement and
   `DATA-INVENTORY.md`, and link the privacy policy. They send their DPA; you sign it with the
   plan attached.
3. **Distribution.** The district adds Studento in **Apple School Manager** (Apps and Books,
   free licenses) and pushes it with their MDM (Great Neck uses Jamf or Mosyle on student iPads).
   Students either get it installed automatically or find it in the Self Service app. No
   accounts are needed for the app to work, so the district can roll it out with accounts off.
4. **Which devices.** New York's bell-to-bell phone ban (2025-26 onward) means students will not
   be using Studento on phones during school. It has to run on the school-issued device:
   iPads get the iOS app; Chromebooks need the web version. Ask the tech director which one the
   building uses before anything else.

## What makes this easy for them (say it in the email)

- No names, emails, phone numbers, photos of the student, location, or advertising ID.
- Works fully offline with no account. The account is optional and holds a username only.
- The schedule photo (optional reader) is sent once and never stored.
- Students can delete their account and all data in the app.
- Reports on shared content go to one admin; there is no chat or social feature.
- Data is in the United States (Cloudflare, US data centers), encrypted in transit (TLS) and at
  rest; passwords hashed with PBKDF2-SHA256.
- Free. No in-app purchases, no ads, no third-party trackers.

## Running it as a beta / pilot

The App Store build (1.1.0, approved 2026-11-05) is the pilot build; nothing new has to be
built for the paperwork. Two ways to pilot, pick with the DPO:

- **TestFlight public link** (fastest, no district IT work): App Store Connect > TestFlight >
  external group "Great Neck pilot" > enable the public link, and put it in the email. Up to
  10,000 testers, builds expire after 90 days, runs on personal iPads/iPhones. Good for
  teachers and a handful of volunteer students.
- **App Store build on district iPads** (the real rollout): IT adds Studento in Apple School
  Manager and scopes it to a pilot device group in Jamf/Mosyle. No TestFlight involved.

Either way, offer a pilot configuration with sign-ups off (the server's `signup` kill switch
under Settings > Admin) so no student creates an account before the DPA is signed.

## If they want the Chromebook version

The same app can ship as a web app at studento-app.pages.dev (sign-in, schedules and the reader
already run there). Say so if asked; it is a day of work to match the iOS screens.
