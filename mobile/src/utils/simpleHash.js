/**
 * simpleHash — a dependency-free, pure-JS string hash (FNV-1a, 32-bit).
 *
 * IMPORTANT — this is NOT cryptography. FNV-1a is a fast, well-distributed hash meant for
 * checksums/hash tables, not for protecting secrets. It has no salt, no iteration count, and
 * is trivially brute-forceable for a 4-6 digit PIN (there are only ~10-100 possible values
 * anyway). We use it here only to avoid storing a device PIN in AsyncStorage as plain text.
 *
 * The real security boundary for this app is the OTP/JWT session (see AuthContext.js /
 * api/client.js). The PIN implemented on top of it (AppLockContext.js) is a *local UX gate*
 * that re-locks the UI when the app resumes from background — it is not meant to resist a
 * determined attacker with access to the device's storage. Do not reuse this hash for
 * anything that needs real security (passwords, tokens, etc.) — use a vetted crypto library
 * (that requires native linking) if that's ever needed.
 */
export function simpleHash(input) {
  const str = String(input);
  let hash = 0x811c9dc5; // FNV offset basis (32-bit)
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    // FNV prime multiplication, done with shifts/adds to stay within 32-bit int math.
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    hash >>>= 0; // keep unsigned 32-bit
  }
  return hash.toString(16).padStart(8, '0');
}

export default simpleHash;
