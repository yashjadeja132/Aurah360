import ApiError from '../libs/ApiError.js';

/**
 * DOC-002 — content sniffing for uploaded files.
 *
 * WHAT THIS IS NOT: an antivirus scanner. Nothing here inspects a file for malicious *payload*.
 * A genuine, well-formed PDF carrying a malicious embedded JavaScript action passes every check in
 * this module, and will keep passing until a real AV engine (ClamAV/`clamd`, or an object-storage
 * scan hook) is wired in behind `SCAN_STATE.PENDING`. Calling the old MIME allowlist a
 * "malware scan" was the actual defect; this module does not repeat that claim.
 *
 * WHAT IT IS: a check that the file's BYTES are the type its metadata claims. Every value the old
 * screen trusted — `file.mimetype` and the filename extension — is supplied by the client and can
 * say anything. So an attacker could upload an HTML document (or a polyglot: a file that is a
 * valid image AND a valid HTML page) labelled `image/png`, have it stored, and have it served back
 * later with a `Content-Type` taken straight from their own claim. Reading the leading bytes is
 * the cheap, dependency-free way to make the claim checkable, and it is deliberately done BEFORE
 * anything is written to storage.
 *
 * There is no `file-type`/`magic` dependency in package.json and this needs to recognise five
 * formats, so the signature table lives here rather than pulling in a package (and its transitive
 * tree) for ~40 lines of byte comparison.
 *
 * SVG deserves a specific note: it is a legitimate `image/*` type and would have sailed through
 * the old `startsWith('image/')` allowlist, but an SVG is an XML DOCUMENT that can carry
 * `<script>`, and serving one inline from the API origin is stored XSS. It has no magic number and
 * is not in the table below, so it is now rejected as unrecognised — which is the intended
 * outcome, not an accident of the implementation.
 */

/** Canonical MIME per detected signature. Order matters only for `ftyp` box brands. */
const SIGNATURES = [
  { mime: 'application/pdf', test: (b) => hasBytes(b, 0, [0x25, 0x50, 0x44, 0x46, 0x2d]) }, // "%PDF-"
  { mime: 'image/png', test: (b) => hasBytes(b, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  { mime: 'image/jpeg', test: (b) => hasBytes(b, 0, [0xff, 0xd8, 0xff]) },
  { mime: 'image/gif', test: (b) => hasAscii(b, 0, 'GIF87a') || hasAscii(b, 0, 'GIF89a') },
  // RIFF container: bytes 4-7 are the (ignored) chunk size, so the form type at 8 is what decides.
  { mime: 'image/webp', test: (b) => hasAscii(b, 0, 'RIFF') && hasAscii(b, 8, 'WEBP') },
  { mime: 'image/bmp', test: (b) => hasAscii(b, 0, 'BM') },
  { mime: 'image/tiff', test: (b) => hasBytes(b, 0, [0x49, 0x49, 0x2a, 0x00]) || hasBytes(b, 0, [0x4d, 0x4d, 0x00, 0x2a]) },
  { mime: 'image/heic', test: (b) => hasAscii(b, 4, 'ftyp') && ISO_BMFF_IMAGE_BRANDS.has(readAscii(b, 8, 4)) },
  { mime: 'image/avif', test: (b) => hasAscii(b, 4, 'ftyp') && readAscii(b, 8, 4) === 'avif' },
];

/** ISO-BMFF brands that mean "this is a still image", not a video track. */
const ISO_BMFF_IMAGE_BRANDS = new Set(['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'mif1', 'msf1', 'heif']);

/**
 * Client-supplied MIME spellings that mean the same stored type. Normalising rather than
 * string-comparing avoids rejecting a real JPEG just because the browser said `image/jpg`.
 */
const MIME_ALIASES = Object.freeze({
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
  'image/x-png': 'image/png',
  'image/x-ms-bmp': 'image/bmp',
  'image/x-bmp': 'image/bmp',
  'image/tif': 'image/tiff',
  'image/heif': 'image/heic',
});

/**
 * Extension → the type its bytes must actually be. Only extensions listed here are checked; an
 * unknown or absent extension is NOT a rejection reason, because the byte check has already
 * decided what the file is and refusing `scan` (no extension) would break ordinary uploads.
 */
const EXTENSION_TYPES = Object.freeze({
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.jpe': 'image/jpeg',
  '.jfif': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.heic': 'image/heic',
  '.heif': 'image/heic',
  '.avif': 'image/avif',
});

function hasBytes(buffer, offset, bytes) {
  if (buffer.length < offset + bytes.length) return false;
  return bytes.every((byte, i) => buffer[offset + i] === byte);
}

function hasAscii(buffer, offset, text) {
  return readAscii(buffer, offset, text.length) === text;
}

function readAscii(buffer, offset, length) {
  if (buffer.length < offset + length) return '';
  return buffer.toString('latin1', offset, offset + length);
}

/** Lower-cased, alias-resolved MIME, or '' when absent. */
export const normalizeMimeType = (mimeType) => {
  const value = String(mimeType || '').split(';')[0].trim().toLowerCase();
  return MIME_ALIASES[value] || value;
};

export const extensionOf = (filename = '') => {
  const match = /\.[a-zA-Z0-9]+$/.exec(String(filename));
  return match ? match[0].toLowerCase() : '';
};

/**
 * The type the file's leading bytes say it is, or null when nothing recognises them.
 * Null is meaningful: it covers HTML, SVG, plain text, scripts and archives alike.
 */
export const detectFileType = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return null;
  const found = SIGNATURES.find((signature) => signature.test(buffer));
  return found ? found.mime : null;
};

/**
 * Verifies bytes, claimed MIME and filename extension all describe the SAME type, and returns the
 * type derived from the BYTES. Callers should persist/serve the returned value rather than
 * `file.mimetype`: after this check they are equal, and taking the detected one means a future
 * relaxation of the claim check cannot reintroduce an attacker-chosen `Content-Type`.
 *
 * @param {Buffer} buffer
 * @param {{ mimeType?: string, originalName?: string, allowedTypes?: string[] }} claim
 * @returns {string} the detected MIME type
 * @throws {ApiError} 400 with a distinct code per failure so the reason is greppable in the log
 */
export const assertContentMatchesClaim = (buffer, { mimeType, originalName, allowedTypes } = {}) => {
  const detected = detectFileType(buffer);
  if (!detected) {
    throw ApiError.badRequest(
      'The file content is not a recognised PDF or image. Renamed, empty or script/markup files '
        + '(including SVG) are not accepted.',
      null,
      'FILE_CONTENT_UNRECOGNISED'
    );
  }

  const claimed = normalizeMimeType(mimeType);
  if (claimed && claimed !== detected) {
    throw ApiError.badRequest(
      `The file content does not match its declared type (declared ${claimed}, content is ${detected}).`,
      null,
      'FILE_CONTENT_MISMATCH'
    );
  }

  const byExtension = EXTENSION_TYPES[extensionOf(originalName)];
  if (byExtension && byExtension !== detected) {
    throw ApiError.badRequest(
      `The file name extension does not match its content (content is ${detected}).`,
      null,
      'FILE_EXTENSION_MISMATCH'
    );
  }

  if (Array.isArray(allowedTypes) && !allowedTypes.includes(detected)) {
    throw ApiError.badRequest(
      `Files of type ${detected} are not accepted here.`,
      null,
      'FILE_TYPE_REJECTED'
    );
  }

  return detected;
};

export default {
  detectFileType,
  assertContentMatchesClaim,
  normalizeMimeType,
  extensionOf,
};
