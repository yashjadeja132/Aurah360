import mongoose from 'mongoose';

/**
 * Organization master — singleton profile the whole clinic runs under (ORG-001, ORG-006).
 * Branches inherit these defaults and may override only the fields marked overridable
 * in BranchService; this document itself is not multi-tenant.
 */
const organizationSchema = new mongoose.Schema(
  {
    legalName: { type: String, required: true, trim: true },
    displayName: { type: String, required: true, trim: true },
    gstNumber: { type: String, default: null, trim: true },
    panNumber: { type: String, default: null, trim: true },
    logo: { type: String, default: null },
    contactEmail: { type: String, default: null, trim: true, lowercase: true },
    contactPhone: { type: String, default: null, trim: true },
    privacyContactEmail: { type: String, default: null, trim: true, lowercase: true },
    grievanceContactEmail: { type: String, default: null, trim: true, lowercase: true },
    /** Source of truth for report/day-bucket timezone — beats CLINIC_DEFAULT_TIMEZONE.
     *  See src/config/orgRuntime.js for the precedence note. */
    timezone: { type: String, default: 'Asia/Kolkata' },
    /** India's FY starts in April. Drives `period=FY`/`FY_PREV` report ranges
     *  (src/helpers/reportFilters.helper.js). */
    financialYearStartMonth: { type: Number, default: 4, min: 1, max: 12 },
    /** Prefix for newly generated invoice numbers. Changing it does NOT renumber history —
     *  each prefix carries its own counter (src/helpers/invoiceNumber.helper.js). */
    invoicePrefix: { type: String, default: 'INV' },
    /** Rendered on the invoice + receipt print payloads (BillingService.getPrintData). */
    invoiceFooterNote: { type: String, default: null },
    /** Fields branches are allowed to override individually (ORG-006). */
    branchOverridableFields: {
      type: [String],
      default: ['workingHours', 'settings', 'holidayCalendar', 'notes'],
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, collection: 'organization' }
);

organizationSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id.toString(),
    legalName: this.legalName,
    displayName: this.displayName,
    gstNumber: this.gstNumber,
    panNumber: this.panNumber,
    logo: this.logo,
    contactEmail: this.contactEmail,
    contactPhone: this.contactPhone,
    privacyContactEmail: this.privacyContactEmail,
    grievanceContactEmail: this.grievanceContactEmail,
    timezone: this.timezone,
    financialYearStartMonth: this.financialYearStartMonth,
    invoicePrefix: this.invoicePrefix,
    invoiceFooterNote: this.invoiceFooterNote,
    branchOverridableFields: this.branchOverridableFields,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const Organization = mongoose.model('Organization', organizationSchema);

export default Organization;
