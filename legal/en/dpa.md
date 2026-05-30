<!--
DRAFT — NOT LEGAL ADVICE. Working draft for review and adaptation by a
qualified attorney before publication.

SECTIONS MOST NEEDING LAWYER REVIEW:
  - Section 1 (controller / processor allocation) — core legal framing; must be
    validated against applicable medical-data and data-protection law.
  - Section 5 (subprocessors) — keep the list accurate; review the legal basis
    for US-based subprocessors serving Latin American controllers.
  - Section 6 (breach notification timing) and Section 7 (return/deletion) —
    obligations and timeframes need legal sign-off.
-->

# Data Processing Agreement (DPA)

> **Draft — pending legal review.** This document is an early draft provided
> for review and adaptation. It is not a final or binding legal agreement and
> does not constitute legal advice.

**Last updated:** May 30, 2026

This Data Processing Agreement ("DPA") forms part of the Terms of Service
between you ("the Doctor") and Hisamed, and governs the processing of patient
personal data within the Service.

## 1. Roles of the parties

- **You (the Doctor) are the data controller.** You determine what patient data
  is collected and why, and you are responsible for having the lawful basis and
  any patient consent required to process it.
- **Hisamed is the data processor.** Hisamed is currently operated by **Angel
  Jaen as an individual sole trader** (not a company), and processes patient
  data only on your documented instructions to provide the Service.

## 2. Nature and purpose of processing

Hisamed processes patient data solely to provide **electronic health record
(EHR) functionality** — storing, displaying, organizing, and retrieving the
clinical records you create or upload, including generating documents and
managing attachments.

## 3. Categories of data subjects and data

- **Data subjects:** the Doctor's patients (and, incidentally, the Doctor's own
  account users).
- **Categories of data:** medical and clinical records; personal identifiers;
  demographic and contact information; and images or files attached to patient
  records.

This includes sensitive health data; both parties acknowledge it must be handled
with appropriate care.

## 4. Processor obligations

Hisamed will:

- process patient data **only on your instructions** and only to provide the
  Service — never for its own purposes, advertising, or AI model training;
- apply **reasonable technical and organizational security measures** (TLS in
  transit, argon2id password hashing, multi-tenant isolation tested by an
  automated suite), on a best-effort basis appropriate to an early-access pilot;
- ensure that people authorized to process the data are bound by
  confidentiality;
- restrict access to the data to what is strictly necessary to operate, secure,
  support, and debug the Service; and
- assist you, so far as reasonably possible, in responding to patient requests
  to exercise their rights.

Hisamed makes no HIPAA certification and provides no formal SLA during the
pilot.

## 5. Subprocessors

You authorize Hisamed to engage the following subprocessors. All store or process
data on infrastructure located in the **United States**:

| Subprocessor   | Role / data handled                                    | Location |
|----------------|--------------------------------------------------------|----------|
| **Supabase**   | Primary database — patient records and account data    | US East  |
| **Cloudflare** | R2 object storage — uploaded files and images          | US       |
| **Resend**     | Transactional email — e.g. account/password emails (no clinical content) | US |

Application hosting is provided on **DigitalOcean (US)**. We will give you notice
of any new or replacement subprocessor and impose data-protection obligations on
each subprocessor consistent with this DPA.

## 6. Personal data breach

If Hisamed becomes aware of a personal data breach affecting your patient data,
Hisamed will **notify you (the Doctor) without undue delay** after becoming
aware, with the information reasonably available, so that you can meet any
notification obligations you have as controller. *(Specific timeframe to be
confirmed in legal review.)*

## 7. Return and deletion of data

On termination of the Service or your account, or on your request, Hisamed will,
at your choice, make your patient data available for **export** and/or **delete**
it from active systems within a reasonable period, except where retention is
required by law. Residual copies in backups are purged on the normal backup
rotation cycle.

## 8. International transfers

Because all infrastructure is US-based (Section 5), patient data of data subjects
located in Latin America is transferred to and stored in the United States. The
Doctor acknowledges this and is responsible for any disclosures or consents this
requires under local law.

## 9. Liability and changes

The liability provisions and change process in the Terms of Service apply to this
DPA. In case of conflict between this DPA and the Terms regarding processing of
patient data, this DPA prevails.

## 10. Contact

Data-processing questions: **Angel Jaen — legal@hisamed.com**.
