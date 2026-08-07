import mongoose from 'mongoose';
import { REPORT_TYPE_LIST, DASHBOARD_TYPE_LIST } from '../enums/report.js';

const savedReportFilterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    scope: {
      type: String,
      enum: [...REPORT_TYPE_LIST, ...DASHBOARD_TYPE_LIST, 'analytics', 'kpis'],
      required: true,
      index: true,
    },
    filters: { type: mongoose.Schema.Types.Mixed, default: {} },
    isDefault: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'saved_report_filters' }
);

savedReportFilterSchema.index({ userId: 1, scope: 1, name: 1 });

const SavedReportFilter = mongoose.model('SavedReportFilter', savedReportFilterSchema);
export default SavedReportFilter;
