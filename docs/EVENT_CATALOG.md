# Event Catalog

Domain events flow through `eventBus` (`backend/src/events/eventBus.js`).  
Notification subscriptions: `backend/src/notifications/eventSubscriptions.js`.

## Notification-mapped events

From `EVENT_TEMPLATE_MAP` / `DEFAULT_EVENT_CHANNELS`:

| Event | Template | Default channels |
|---|---|---|
| AppointmentCreated | APPOINTMENT_CONFIRMATION | IN_APP, SMS, WHATSAPP |
| AppointmentConfirmed | APPOINTMENT_CONFIRMATION | IN_APP, SMS |
| AppointmentReminder | APPOINTMENT_REMINDER | SMS, WHATSAPP, IN_APP |
| PatientCheckedIn | PATIENT_CHECKED_IN | IN_APP |
| ConsultationSigned | CONSULTATION_SIGNED | IN_APP |
| PrescriptionFinalized | PRESCRIPTION_READY | IN_APP, SMS |
| TreatmentPlanAccepted | TREATMENT_PLAN_ACCEPTED | IN_APP, EMAIL |
| InvoiceCreated / Finalized | INVOICE_GENERATED | IN_APP, EMAIL |
| InvoicePaid | INVOICE_PAID | IN_APP, SMS, EMAIL |
| TreatmentSessionCompleted | TREATMENT_SESSION_COMPLETED | IN_APP, WHATSAPP |
| TreatmentSessionReminder | TREATMENT_SESSION_REMINDER | SMS, IN_APP |
| LeadCreated | LEAD_CREATED | IN_APP |
| LeadConverted | LEAD_CONVERTED | IN_APP, EMAIL |
| FollowUpDue | LEAD_FOLLOW_UP | IN_APP, SMS |
| BirthdayWishes | BIRTHDAY_WISHES | WHATSAPP, SMS, IN_APP |

## Domain event groups

| Group | Events |
|---|---|
| CRM | LeadCreated, LeadAssigned, LeadConverted, FollowUpDue |
| Inventory | MedicineDispensed, StockAdjusted, LowStockDetected, NearExpiryDetected, GoodsReceived, StockConsumed |
| Billing | InvoiceCreated, InvoiceFinalized, PaymentRecorded, InvoicePaid |
| Treatment sessions | TreatmentSessionStarted, TreatmentSessionCompleted, TreatmentPlanCompleted |
| Patient portal | PatientLoggedIn, FeedbackSubmitted, DocumentDownloaded |
| Foundation | user.logged_in, user.logged_out |
| Notification lifecycle | NotificationQueued, NotificationSent, NotificationFailed |

## Socket.io events

`SOCKET_EVENTS` in `backend/src/socket/index.js`:

PatientCheckedIn, QueueUpdated, PatientCalled, QueueCompleted, DoctorStatusUpdated, ConsultationStarted/Completed/Locked, TreatmentSessionStarted/Completed, MedicineDispensed, StockAdjusted, LowStockDetected, NearExpiryDetected, LeadCreated/Assigned/Converted, FollowUpDue, NotificationReceived.
