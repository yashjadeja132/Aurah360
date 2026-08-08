import ApiError from '../libs/ApiError.js';
import AuditService from './AuditService.js';
import ConsentService from './ConsentService.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';
import { CONSENT_PURPOSE } from '../enums/privacy.js';
import { findRestrictedBodyRegionTerm } from '../helpers/bodyRegion.helper.js';
import { assertContentMatchesClaim, normalizeMimeType } from '../helpers/fileSignature.helper.js';

/**
 * A clinical photo is an image, never a document. Multer's upload filter is shared with
 * patient-document upload and therefore also allows application/pdf — the photo paths screen
 * again here so a PDF can never be persisted as a ClinicalPhoto row.
 */
export const ALLOWED_PHOTO_MIME_TYPES = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

/**
 * IMG-003/PRV-001 (P0) — THE single source of truth for the clinical-photo capture policy.
 *
 * Every path that persists patient imagery (consultation capture AND treatment-session capture)
 * calls this one service, so the consent gate, the restricted-body-area gate and the image-type
 * screen cannot drift between them. This exists precisely because the session path previously
 * had none of the three: it wrote ClinicalPhoto rows with consentVerified left at the model
 * default of false, and those rows were then listed and served like verified ones.
 *
 * Nothing here trusts a client-supplied `consentVerified` flag; the append-only ConsentGrant log
 * is the only authority. Blocks are audited so a refused capture is investigable.
 */
class ClinicalPhotoPolicyService {
  constructor() {
    this.auditService = new AuditService();
    this.consentService = new ConsentService();
  }

  /**
   * Reject anything that is not a capturable image (see ALLOWED_PHOTO_MIME_TYPES).
   *
   * The declared MIME is checked first so the error names the type the caller asked for, then the
   * file's LEADING BYTES have to agree with it. `file.mimetype` is client-supplied: without the
   * byte check, an HTML page or an SVG (scriptable XML) labelled `image/png` was stored as a
   * clinical photo and served back later. Returns the DETECTED type so callers persist that
   * rather than the claim — see fileSignature.helper.js, which is explicit that this verifies the
   * file's TYPE and is not an antivirus scan.
   */
  assertAllowedImage(file) {
    if (!file?.buffer) throw ApiError.badRequest('File is required');
    const mimeType = normalizeMimeType(file.mimetype);
    if (!ALLOWED_PHOTO_MIME_TYPES.includes(mimeType)) {
      throw ApiError.badRequest(
        `Clinical photos must be an image (${ALLOWED_PHOTO_MIME_TYPES.join(', ')}); got ${
          file.mimetype || 'unknown'
        }`,
        null,
        'UNSUPPORTED_PHOTO_TYPE'
      );
    }
    return assertContentMatchesClaim(file.buffer, {
      mimeType: file.mimetype,
      originalName: file.originalname,
      allowedTypes: ALLOWED_PHOTO_MIME_TYPES,
    });
  }

  /**
   * IMG-003 (P0) — clinic policy blocks privacy-sensitive/intimate-area capture server-side.
   * This cannot be bypassed from the API regardless of what the UI allows through.
   */
  async assertBodyRegionAllowed(bodyRegion, { actorId = null, req = null, metadata = {} } = {}) {
    const matched = findRestrictedBodyRegionTerm(bodyRegion);
    if (!matched) return true;
    await this.auditService.record(AUDIT_ACTIONS.RESTRICTED_PHOTO_BLOCKED, {
      actorId,
      metadata: { ...metadata, bodyRegion, matchedRestrictedTerm: matched },
      req,
    });
    throw ApiError.forbidden(
      'This body area is blocked by clinic policy for routine capture. A doctor-authorized exception workflow is required.',
      'RESTRICTED_BODY_AREA'
    );
  }

  /**
   * IMG-003/PRV-001 — never trust a client-supplied consent flag. Cross-check the real,
   * append-only ConsentGrant log for the patient before persisting any consentVerified flag.
   */
  async assertPhotographyConsent(patientId, { actorId = null, req = null, metadata = {} } = {}) {
    const granted = await this.consentService.isGranted(patientId, CONSENT_PURPOSE.CLINICAL_PHOTOGRAPHY);
    if (!granted) {
      await this.auditService.record(AUDIT_ACTIONS.CLINICAL_PHOTO_CONSENT_MISSING, {
        actorId,
        metadata: { ...metadata, patientId: patientId?.toString?.() || patientId },
        req,
      });
      throw ApiError.forbidden(
        'Clinical photography consent has not been granted for this patient. Capture cannot proceed until consent is recorded.',
        'PHOTOGRAPHY_CONSENT_NOT_GRANTED'
      );
    }
    return granted;
  }

  /**
   * The full capture gate, in the order the consultation path has always applied it:
   * image-type screen → restricted body area → real CLINICAL_PHOTOGRAPHY grant. Runs BEFORE any
   * bytes are written to storage.
   *
   * Returns the verified consent fields to persist on the ClinicalPhoto row. Marketing/before-after
   * image use is a distinct, separate consent purpose (PRV-001, §16.3) — it must never be
   * conflated with (or inferred from) clinical photography consent, so it is resolved separately
   * and returned as its own flag.
   */
  async assertCaptureAllowed({
    patientId,
    bodyRegion = null,
    file = null,
    actorId = null,
    req = null,
    metadata = {},
  }) {
    if (file) this.assertAllowedImage(file);
    await this.assertBodyRegionAllowed(bodyRegion, { actorId, req, metadata });
    await this.assertPhotographyConsent(patientId, { actorId, req, metadata });

    const marketingConsentVerified = await this.consentService.isGranted(
      patientId,
      CONSENT_PURPOSE.MARKETING_IMAGE_USE
    );

    return {
      consentVerified: true,
      consentVerifiedAt: new Date(),
      consentVerifiedBy: actorId,
      marketingConsentVerified,
    };
  }
}

export default ClinicalPhotoPolicyService;
