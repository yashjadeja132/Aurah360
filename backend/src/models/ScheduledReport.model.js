import mongoose from 'mongoose';
import {
  REPORT_TYPE_LIST,
  SCHEDULE_FREQUENCY_LIST,
  EXPORT_FORMAT_LIST,
} from '../enums/report.js';

const scheduledReportSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    reportType: { type: String, enum: REPORT_TYPE_LIST, required: true, index: true },
    frequency: { type: String, enum: SCHEDULE_FREQUENCY_LIST, required: true, index: true },
    format: { type: String, enum: EXPORT_FORMAT_LIST, default: 'csv' },
    filters: { type: mongoose.Schema.Types.Mixed, default: {} },
    recipients: [{ type: String, trim: true }],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    isActive: { type: Boolean, default: true, index: true },
    lastRunAt: { type: Date, default: null },
    nextRunAt: { type: Date, default: null },
    lastRunStatus: { type: String, default: null },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true, collection: 'scheduled_reports' }
);

scheduledReportSchema.index({ isActive: 1, nextRunAt: 1 });

const ScheduledReport = mongoose.model('ScheduledReport', scheduledReportSchema);
export default ScheduledReport;
