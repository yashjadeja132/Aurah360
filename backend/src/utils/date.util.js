import config from '../config/index.js';

/** Store UTC; render in branch/clinic timezone later. */
export const nowUtc = () => new Date();

export const clinicTimezone = () => config.clinic.defaultTimezone;

export default { nowUtc, clinicTimezone };
