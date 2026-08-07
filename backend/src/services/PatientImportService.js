import ImportBatch from '../models/ImportBatch.model.js';
import PatientService from './PatientService.js';
import PatientDuplicateService from './PatientDuplicateService.js';
import ApiError from '../libs/ApiError.js';
import AuditService from './AuditService.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';
import { GENDER_LIST } from '../enums/gender.js';

const REQUIRED_FIELDS = ['firstName', 'lastName', 'mobile', 'gender', 'primaryBranchId'];

/**
 * Controlled CSV/API migration (PAT-008, §19.5). Two-phase: dry-run validates every row and
 * reports duplicate candidates/errors without writing; commit re-validates and creates rows,
 * stamping source system/id/import batch for reconciliation. Never auto-merges duplicates.
 */
class PatientImportService {
  constructor() {
    this.patientService = new PatientService();
    this.duplicateService = new PatientDuplicateService();
    this.auditService = new AuditService();
  }

  #validateRow(row, index) {
    const errors = [];
    for (const field of REQUIRED_FIELDS) {
      if (!row[field]) errors.push(`Row ${index}: missing "${field}"`);
    }
    if (row.gender && !GENDER_LIST.includes(row.gender)) {
      errors.push(`Row ${index}: invalid gender "${row.gender}"`);
    }
    return errors;
  }

  async dryRun(rows, sourceSystem, actorId) {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw ApiError.badRequest('At least one row is required');
    }

    let validRows = 0;
    let duplicateCandidates = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const rowErrors = this.#validateRow(row, i + 1);
      if (rowErrors.length) {
        errors.push(...rowErrors.map((message) => ({ row: i + 1, message })));
        continue;
      }
      validRows += 1;
      const matches = await this.duplicateService.findDuplicates({
        mobile: row.mobile,
        email: row.email,
        firstName: row.firstName,
        lastName: row.lastName,
        dateOfBirth: row.dateOfBirth,
      });
      if (matches.length) duplicateCandidates += 1;
    }

    const batch = await ImportBatch.create({
      sourceSystem,
      status: 'DRY_RUN',
      totalRows: rows.length,
      validRows,
      errorRows: rows.length - validRows,
      duplicateCandidates,
      rowErrors: errors,
      startedBy: actorId,
    });

    await this.auditService.record(AUDIT_ACTIONS.IMPORT_BATCH_DRY_RUN, {
      actorId,
      metadata: { batchId: batch._id.toString(), totalRows: rows.length, validRows, errorRows: rows.length - validRows },
    });

    return batch.toSafeObject();
  }

  async commit(batchId, rows, actorId, req = null) {
    const batch = await ImportBatch.findById(batchId);
    if (!batch) throw ApiError.notFound('Import batch not found');
    if (batch.status === 'IMPORTED' || batch.status === 'RECONCILED') {
      throw ApiError.conflict('Import batch already committed');
    }

    let committed = 0;
    const commitErrors = [];

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const rowErrors = this.#validateRow(row, i + 1);
      if (rowErrors.length) {
        commitErrors.push(...rowErrors.map((message) => ({ row: i + 1, message })));
        continue;
      }
      try {
        await this.patientService.create(
          {
            ...row,
            sourceSystem: batch.sourceSystem,
            sourceRecordId: row.sourceRecordId || null,
            importBatchId: batch._id,
            importConfidence: 'UNVERIFIED',
          },
          actorId,
          req
        );
        committed += 1;
      } catch (err) {
        commitErrors.push({ row: i + 1, message: err.message });
      }
    }

    batch.status = 'IMPORTED';
    batch.committedRows = committed;
    batch.rowErrors = [...batch.rowErrors, ...commitErrors];
    batch.committedAt = new Date();
    await batch.save();

    await this.auditService.record(AUDIT_ACTIONS.IMPORT_BATCH_COMMITTED, {
      actorId,
      metadata: { batchId, committed, errors: commitErrors.length },
      req,
    });

    return batch.toSafeObject();
  }

  async getBatch(batchId) {
    const batch = await ImportBatch.findById(batchId);
    if (!batch) throw ApiError.notFound('Import batch not found');
    return batch.toSafeObject();
  }
}

export default PatientImportService;
