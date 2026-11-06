# Email to the District's Data Protection Officer

Great Neck lists Joseph Cangialosi as Data Protection Officer on its Data Privacy and
Security page (Office of Instructional Technology). Send to him; copy the Office of
Instructional Technology if the site lists a general address. Fill in the brackets.

Attach as PDFs (in `pdf/`):
1. Studento - Data Privacy and Security Plan
2. Studento - Parents Bill of Rights Supplement (signed)
3. Studento - Data Inventory and Security Summary

---

**To:** jcangialosi@greatneck.k12.ny.us
**Subject:** Studento (free bell-schedule app): Ed Law 2-d materials for vetting

Dear Mr. Cangialosi,

I'm a Great Neck parent (my son is at Great Neck North) and the developer of Studento, a
free app that counts down to the next bell and shows a student's own class schedule, with
widgets and quiet bell reminders. It is on the App Store now
(https://apps.apple.com/app/studento/id6825547011). The principal suggested I bring it to
your office, since the district vets both free and paid software under Education Law 2-d
before it is used with students.

I'd like to propose a small pilot at North High School this year. To make the vetting easy,
I've attached everything Part 121 and Board Policies #8625 and #8635 call for from a vendor:

1. **Data Privacy and Security Plan**: data inventory, where it is stored (Cloudflare, US),
   security measures (TLS in transit, encryption at rest, PBKDF2-SHA256 password hashing,
   one admin, kill switches), and breach notification to you within 7 days.
2. **Parents' Bill of Rights supplemental information**, filled in and signed.
3. **Data inventory and security summary**, verified against the current code.
4. Privacy policy: https://studento-app.pages.dev/privacy. Source code is public:
   https://github.com/theprojectmaker/studento-ios.

The short version: Studento needs nothing from the district and works fully without an
account. If a student chooses to create one, it holds only a student-chosen username and
their own class names and settings. No name, email, phone, location, ads, analytics or
trackers. Students can delete their account and all data inside the app. For a pilot I can
also ship it with account creation turned off.

Three questions so I fit your process:

1. Would you send me the district's Data Privacy Agreement (I see the free tools on the
   GNPS approved list carry a "District - Free" DPA)? I'll return it signed with the plan
   attached.
2. Which devices do North students use in school, iPads or Chromebooks? The iOS app can be
   pushed through Apple School Manager; I can provide a web version for Chromebooks.
3. For a pilot, would you prefer a TestFlight beta link for a few teachers and students, or
   the App Store build pushed to a pilot group of district iPads?

Happy to come in for a short demo or to answer anything from your team.

Thank you,
[Your name]
[Phone]
studentoclockapp@gmail.com
