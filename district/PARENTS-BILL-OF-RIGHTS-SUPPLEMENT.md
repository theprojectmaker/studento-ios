# Parents' Bill of Rights for Data Privacy and Security — Supplemental Information

Required of every third-party contractor under New York Education Law §2-d and
8 NYCRR §121.3. Fill in the district name and sign where marked.

**Contractor:** Moses Sasson, doing business as Studento (studentoclockapp@gmail.com)
**Product:** Studento, a bell schedule countdown app for iOS, iPadOS and the web
**Educational agency:** Great Neck Public Schools (the District)

### 1. Exclusive purposes for which the student data will be used

Studento shows a countdown to the next bell and the student's own class schedule, sends
local bell reminders on the device, and (optionally) saves the student's schedule to an
account so it can be restored on another device. Student data is used for those purposes
only. It is never used for marketing, advertising, profiling, or sold or shared for any
commercial purpose.

### 2. Data the product collects

| Data element | Required? | Where it lives | Why |
|---|---|---|---|
| Class names, room numbers, chosen bell schedule, display settings | Yes, entered by the student | On the device only, unless the student signs in | Shows the countdown |
| Username and password (hashed) | No. Only if the student creates an account | Studento server (Cloudflare D1, United States) | Lets the student restore their schedule on another device |
| The student's schedule and settings | No. Only if signed in | Studento server | Same |
| A photo or typed text of the schedule | No. Only if the student uses the schedule reader | Sent to the server and an AI provider for one request, then discarded. Never stored. | Turns the photo into a schedule |
| Reports about shared content (reason, note) | No | Studento server | Lets an admin remove bad shared content |

Not collected: name, email, phone, date of birth, student ID, grade level, location,
photos of the student, contacts, advertising identifiers, device identifiers, analytics or
usage events, or any PII under FERPA. Usernames are chosen by the student; the District
should instruct students not to use their real names.

### 3. Subcontractors

| Subcontractor | What they receive | Purpose |
|---|---|---|
| Cloudflare, Inc. (US) | Account data and schedules (encrypted) | Hosting and database |
| Groq, Inc. (US), Google LLC (US) | The schedule photo or text for one request, not retained | Schedule reader (optional) |
| Expo (650 Industries, US) | No student data; app update files only | Over-the-air app updates |
| Apple Inc. | App distribution only; Apple's own terms apply | App Store |

Each subcontractor is bound by its own data-processing terms and by this supplement's
restrictions. No subcontractor receives data about who the student is.

### 4. Duration of the agreement and what happens to the data when it ends

The agreement runs for the school year in which it is signed and renews annually unless
either party ends it. When it ends, the District may ask for every account created under
it to be deleted; Studento will delete them within 30 days and confirm in writing. Students
can also delete their own account and all server data at any time from inside the app
(Settings > Account > Delete my account). Data on the device is removed when the app is
deleted.

### 5. How a parent, student or eligible student may challenge the accuracy of data

Every data element is entered and editable by the student in the app. A parent or student
may also email studentoclockapp@gmail.com, or contact the District's Data Protection
Officer, to request a correction or deletion. Requests are answered within 10 business days.

### 6. Where the data is stored and how it is protected

Server data is stored in the United States in Cloudflare's network. Data is encrypted in
transit (TLS 1.2+) and at rest. Passwords are never stored; they are hashed with
PBKDF2-SHA256 and a per-user salt. Access tokens are stored hashed. Sign-up, sign-in and the
schedule reader are rate-limited. Studento follows the NIST Cybersecurity Framework as
required by 8 NYCRR §121.5: least-privilege access (one administrator), no shared
credentials, logged administrative actions, and dependency updates each release.

### 7. Encryption

Encrypted in transit and at rest as described above, meeting the standard in Education Law
§2-d(5)(f)(5).

### 8. Breach notification

Studento will notify the District of any unauthorized release of student data within seven
calendar days of discovery, in the most expedient way possible and without unreasonable
delay, and will cooperate with the District's own notifications under Education Law
§2-d(6) and 8 NYCRR §121.10.

### 9. Training

The sole administrator with access to the server has completed data-privacy and security
training and reviews it annually.

### 10. Complaints

Parents may file a complaint about a possible breach or unauthorized release with the
District's Data Protection Officer, or with the New York State Education Department Chief
Privacy Officer at privacy@nysed.gov, or by mail to the Chief Privacy Officer, New York
State Education Department, 89 Washington Avenue, Albany, NY 12234.

Signed: ______________________________ Date: ______________
Moses Sasson, Studento
