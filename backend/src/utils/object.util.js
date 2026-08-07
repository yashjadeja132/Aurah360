/**
 * Safe object helpers — no PHI assumptions; keep utilities generic.
 */
export const omit = (obj, keys = []) => {
  const result = { ...obj };
  keys.forEach((key) => {
    delete result[key];
  });
  return result;
};

export const pick = (obj, keys = []) => {
  const result = {};
  keys.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      result[key] = obj[key];
    }
  });
  return result;
};

export default { omit, pick };
