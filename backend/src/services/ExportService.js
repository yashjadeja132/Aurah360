import { EXPORT_FORMAT } from '../enums/report.js';

function escapeCsv(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToMatrix(columns, rows) {
  const header = columns.map((c) => c.label || c.key);
  const body = rows.map((row) =>
    columns.map((c) => {
      const v = typeof c.value === 'function' ? c.value(row) : row[c.key];
      return v ?? '';
    })
  );
  return [header, ...body];
}

export function toCsv(columns, rows) {
  const matrix = rowsToMatrix(columns, rows);
  return matrix.map((line) => line.map(escapeCsv).join(',')).join('\r\n');
}

/** Excel-compatible SpreadsheetML (opens in Excel without extra deps). */
export function toExcelXml(columns, rows, sheetName = 'Report') {
  const matrix = rowsToMatrix(columns, rows);
  const safeName = String(sheetName).replace(/[^a-zA-Z0-9 _-]/g, '').slice(0, 31) || 'Report';
  const cells = matrix
    .map(
      (line) =>
        `<Row>${line
          .map((cell) => {
            const n = Number(cell);
            if (cell !== '' && !Number.isNaN(n) && String(cell).trim() !== '') {
              return `<Cell><Data ss:Type="Number">${n}</Data></Cell>`;
            }
            const text = String(cell)
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;');
            return `<Cell><Data ss:Type="String">${text}</Data></Cell>`;
          })
          .join('')}</Row>`
    )
    .join('');

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="${safeName}">
  <Table>${cells}</Table>
 </Worksheet>
</Workbook>`;
}

/** PDF placeholder — real PDF renderer can replace this adapter later. */
export function toPdfPlaceholder(columns, rows, meta = {}) {
  return JSON.stringify(
    {
      placeholder: true,
      format: 'pdf',
      message: 'PDF export is a placeholder. Use CSV or Excel for now.',
      title: meta.title || 'Report',
      generatedAt: new Date().toISOString(),
      columns: columns.map((c) => c.label || c.key),
      rowCount: rows.length,
      previewRows: rows.slice(0, 5),
    },
    null,
    2
  );
}

export function exportReport({ format, columns, rows, meta = {} }) {
  const fmt = String(format || EXPORT_FORMAT.CSV).toLowerCase();
  if (fmt === EXPORT_FORMAT.EXCEL) {
    return {
      contentType: 'application/vnd.ms-excel',
      filename: `${meta.filename || 'report'}.xls`,
      body: toExcelXml(columns, rows, meta.sheetName || meta.title || 'Report'),
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
  return {
    contentType: 'text/csv; charset=utf-8',
    filename: `${meta.filename || 'report'}.csv`,
    body: toCsv(columns, rows),
  };
}

export default {
  toCsv,
  toExcelXml,
  toPdfPlaceholder,
  exportReport,
};
