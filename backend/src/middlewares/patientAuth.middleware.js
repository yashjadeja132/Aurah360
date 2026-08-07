import ApiError from '../libs/ApiError.js';
import PatientTokenService from '../services/PatientTokenService.js';
import Patient from '../models/Patient.model.js';
import { ENTITY_STATUS } from '../constants/index.js';

const tokenService = new PatientTokenService();

/**
 * Authenticates patient portal JWT (separate from staff).
 * Sets req.patientAuth = { patientId } and req.patient.
 */
export const authenticatePatient = async (req, _res, next) => {
  try {
    const header = req.headers.authorization;
    const bearer = header?.startsWith('Bearer ') ? header.slice(7) : null;
    const token = bearer || req.cookies?.patient_access_token || null;

    if (!token) {
      throw ApiError.unauthorized('Patient authentication required');
    }

    let payload;
    try {
      payload = tokenService.verifyAccessToken(token);
    } catch (err) {
      const code = err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID';
      throw ApiError.unauthorized('Invalid or expired patient token', code);
    }

    const patient = await Patient.findOne({
      _id: payload.sub,
      deletedAt: null,
      portalEnabled: true,
      isActive: true,
      status: ENTITY_STATUS.ACTIVE,
    });

    if (!patient) {
      throw ApiError.unauthorized('Patient account not available');
    }

    req.patientAuth = { patientId: patient._id.toString() };
    req.patient = patient;
    next();
  } catch (error) {
    next(error);
  }
};

/** Ensures the resource patientId matches the authenticated patient. */
export function assertOwnPatient(resourcePatientId, authPatientId) {
  const a = resourcePatientId?.toString?.() || String(resourcePatientId || '');
  const b = authPatientId?.toString?.() || String(authPatientId || '');
  if (!a || !b || a !== b) {
    throw ApiError.forbidden('You can only access your own records');
  }
}

export default authenticatePatient;
