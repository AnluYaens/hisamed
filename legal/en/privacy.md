<!--
DRAFT — NOT LEGAL ADVICE. Working draft for review and adaptation by a
qualified attorney before publication.

SECTIONS MOST NEEDING LAWYER REVIEW:
  - Section 2 & 9 (data subject / patient rights) — how access, correction, and
    deletion rights flow through the doctor (controller) vs. Hisamed (processor)
    under applicable medical-data law.
  - Section 4 (cross-border storage in the US) — disclosure adequacy for
    Latin American / Venezuelan data-protection rules.
  - Section 7 (retention periods) — must align with medical record-retention
    obligations in each doctor's jurisdiction.
-->

# Privacy Policy

> **Draft — pending legal review.** This document is an early draft provided
> for review and adaptation. It is not a final or binding legal document and
> does not constitute legal advice.

**Last updated:** May 30, 2026

This Privacy Policy explains how Hisamed handles personal data. It is addressed
to the **doctors** who use Hisamed and, indirectly, to **their patients**.

Because Hisamed is an EHR tool, most data in the system is patient data that the
doctor uploads. For that data the **doctor is the controller** and **Hisamed is
the processor** — see the Data Processing Agreement. This Policy describes how
we, as the operator of the platform, protect all data on the system.

## 1. Who we are

Hisamed is operated by **Angel Jaen as an individual sole trader** (not a
company). Privacy contact: **legal@hisamed.com**.

## 2. What data we collect

**Doctor account data:** name, email address, password (stored only as an
argon2id hash), clinic name and settings, and basic usage/technical logs needed
to run and secure the Service.

**Patient data, uploaded by the doctor:** medical records, clinical notes,
identifiers, demographic and contact details, and images or files attached to a
patient record. We do not decide what patient data is collected — the doctor
does, in their role as controller.

We do not sell personal data and we do not use patient data for advertising or
to train AI models.

## 3. How we use data

- to provide and operate the EHR functionality you request;
- to authenticate users and secure accounts;
- to maintain, debug, and improve the Service; and
- to communicate with you about the Service.

We process patient data only to provide the Service on the doctor's
instructions.

## 4. Where data is stored

**All data is stored on infrastructure located in the United States.** Doctors
and patients in Latin America should be aware their data leaves their country.
Specifically:

- **Application hosting:** DigitalOcean (US).
- **Database:** Supabase, US East region.
- **File / image storage:** Cloudflare R2.
- **Transactional email:** Resend (e.g. password resets).

## 5. How data is protected

- **Encryption in transit** via TLS for all connections.
- **Passwords hashed** with argon2id; we never store plaintext passwords.
- **Multi-tenant isolation:** each clinic's data is logically separated so one
  clinic cannot access another's. This isolation is covered by an automated
  test suite.

We are honest about our stage: security is **best-effort**, and the Service is
**not HIPAA-certified**. We apply reasonable safeguards appropriate to an
early-access pilot.

## 6. Who has access

- **Only the clinic's own authorized users** can access that clinic's patient
  data through the application.
- The operator (Angel Jaen) may access data only as strictly necessary to
  operate, support, secure, or debug the Service, and never for unrelated
  purposes.
- Subprocessors (Section 4) access data only to perform their infrastructure
  role. See the DPA for details.

## 7. Data retention

We retain doctor account data and patient records for as long as the account is
active. On account closure or pilot termination, data is returned and/or deleted
as described in the DPA. Doctors are responsible for any medical
record-retention obligations imposed by their own jurisdiction. *(Specific
retention periods to be confirmed in legal review.)*

## 8. Cookies and sessions

We use a small number of strictly necessary cookies to keep you signed in and to
secure the session. We do not use advertising or third-party tracking cookies.

## 9. Your rights

Patients generally exercise their rights (access, correction, deletion) through
their doctor, who is the controller of their data. Doctors can access, correct,
or delete the data in their account at any time, and can request export or full
deletion by contacting us.

If you are a patient and unsure who holds your records, contact your doctor
first; you may also contact us at legal@hisamed.com.

## 10. Changes to this Policy

We may update this Policy. Material changes will be notified by email or in-app.

## 11. Contact

Privacy questions: **Angel Jaen — legal@hisamed.com**.
