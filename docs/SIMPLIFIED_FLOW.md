# Aurah360 — Simplified Flow (vaibhav-development)

**Goal:** cut the current 19-module / 9-role system down to the real clinic flow.
The doctor described it in one breath — the software should match it in one screen each.

## Roles — 4 instead of 9

| New role | Who | What they do |
|---|---|---|
| **DOCTOR** | The doctor | Sees patient files in a queue, reads history, writes today's note, suggests report/test, writes prescription |
| **RECEPTIONIST** | Front desk staff | Registers patient (details + photos), collects fee, sends file to doctor's queue |
| **PHARMACY** | Staff at the medical store | Sees prescriptions as they're written, dispenses, marks done |
| **OWNER** | Clinic owner | Everything above + multi-clinic/doctor dropdown + reports |

Removed/merged: CASHIER → part of Receptionist. BRANCH_MANAGER → part of Owner. TECHNICIAN → dropped from the simple flow. ADMIN → same as Owner.

## The flow — exactly as the doctor works

1. **Patient arrives** → Receptionist opens **New Patient**: ONE form — name, age, phone, complaint, photos, fee collected. Returning patient → search by phone → "New Visit" on the same file.
2. The **file lands in the Doctor's Queue** — like a paper file placed on the table.
3. **Doctor opens the file** → past visits and old notes are right at the top → writes **today's note** (what the illness is).
4. Doctor picks one (or both): **Suggest report/test** or **Write prescription**.
5. The prescription **instantly appears on the Pharmacy screen** → staff at the medical dispenses → marks **Done**.
6. **Next visit:** same file opens, full history visible, AI summary on top — the doctor already knows everything before the patient sits down.

## Multi-clinic

Top bar: `[Clinic ▾] [Doctor ▾]` dropdowns. Owner can switch freely; staff are locked to their own clinic. Every list/queue/report filters by that selection.

## AI — the good part

- **File summary** before the patient enters: "Last visit 12 days ago · given Betnovate + Minoxidil · complaint: hair fall · improvement noted."
- **Prescription draft** generated from the doctor's diagnosis note — doctor approves/edits, never auto-sent.
- **Photo progress** comparison across visits (skin/hair before–after).
- Later: dictate the note by voice instead of typing.

## Screens after the cleanup

- **Reception:** Today's Queue · New Patient · Payments
- **Doctor:** My Queue · Patient File (everything happens inside the file)
- **Pharmacy:** Pending · Dispensed
- **Owner:** Dashboard + the dropdowns

Everything else — leads/CRM, loyalty, packages, treatment sessions, purchase orders, suppliers, analytics digests — comes **out of the menus**. Backend code stays for now; the UI is trimmed to the flow above.

## Build phases

1. Role trim + simple navigation (hide the noise)
2. Reception: one-form registration + fee + photo upload → doctor queue
3. Doctor: file view — history, today's note, report suggestion, prescription
4. Pharmacy screen (pending → dispensed)
5. Multi-clinic dropdowns + AI summary & prescription draft
