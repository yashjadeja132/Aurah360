import ExcelJS from 'exceljs';
import { exportReport, toCsv, toPdfPlaceholder } from '../ExportService.js';
import { EXPORT_FORMAT } from '../../enums/report.js';

/** Module 18 export — reuses Module 16 CSV/PDF helpers; adds true .xlsx via exceljs. */
class AnalyticsExportService {
  async export({ format, columns, rows, meta = {} }) {
    const fmt = String(format || EXPORT_FORMAT.CSV).toLowerCase();

    if (fmt === EXPORT_FORMAT.EXCEL || fmt === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet(meta.sheetName || meta.title || 'Report');
      sheet.columns = columns.map((c) => ({
        header: c.label || c.key,
        key: c.key,
        width: 18,
      }));
      for (const row of rows) {
        const out = {};
        for (const c of columns) {
          out[c.key] = typeof c.value === 'function' ? c.value(row) : row[c.key];
        }
        sheet.addRow(out);
      }
      const buffer = await workbook.xlsx.writeBuffer();
      return {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        filename: `${meta.filename || 'report'}.xlsx`,
        body: Buffer.from(buffer),
        isBuffer: true,
      };
    }

    if (fmt === EXPORT_FORMAT.PDF) {
      return {
        contentType: 'application/json',
        filename: `${meta.filename || 'report'}.pdf.json`,
        body: toPdfPlaceholder(columns, rows, meta),
        placeholder: true,
      };
    }

    // Prefer Module 16 CSV helper
    return exportReport({
      format: EXPORT_FORMAT.CSV,
      columns,
      rows,
      meta: { ...meta, filename: meta.filename || 'report' },
    });
  }

  toCsvTable(columns, rows) {
    return toCsv(columns, rows);
  }
}

export default AnalyticsExportService;
