import mongoose from 'mongoose';
import {
  REPORT_TYPE_LIST,
  REPORT_RUN_STATUS,
  REPORT_RUN_STATUS_LIST,
  EXPORT_FORMAT_LIST,
} from '../enums/report.js';

const reportRunSchema = new mongoose.Schema(
  {
    reportType: { type: String, enum: REPORT_TYPE_LIST, required: true, index: true },
    format: { type: String, enum: EXPORT_FORMAT_LIST, default: 'csv' },
    filters: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: REPORT_RUN_STATUS_LIST,
      default: REPORT_RUN_STATUS.QUEUED,
      index: true,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    scheduledReportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ScheduledReport',
      default: null,
    },
    rowCount: { type: Number, default: 0 },
    resultSummary: { type: mongoose.Schema.Types.Mixed, default: null },
    exportPayload: { type: String, default: null },
    failedReason: { type: String, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'report_runs' }
);

const ReportRun = mongoose.model('ReportRun', reportRunSchema);
export default ReportRun;
