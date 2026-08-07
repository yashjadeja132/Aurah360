/** Rooms, devices and staff skills (§4.3 resources). */

export const RESOURCE_STATUS = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  IN_USE: 'IN_USE',
  MAINTENANCE: 'MAINTENANCE',
  BLOCKED: 'BLOCKED',
  RETIRED: 'RETIRED',
});

export const RESOURCE_STATUS_LIST = Object.freeze(Object.values(RESOURCE_STATUS));

export const ROOM_TYPE = Object.freeze({
  CONSULTATION: 'CONSULTATION',
  PROCEDURE: 'PROCEDURE',
  PHOTO: 'PHOTO',
  RECOVERY: 'RECOVERY',
  OTHER: 'OTHER',
});

export const ROOM_TYPE_LIST = Object.freeze(Object.values(ROOM_TYPE));

export const DEVICE_CAPABILITY = Object.freeze({
  LASER: 'LASER',
  HAIR_SKIN_PROCEDURE: 'HAIR_SKIN_PROCEDURE',
  IMAGING: 'IMAGING',
  OTHER: 'OTHER',
});

export const DEVICE_CAPABILITY_LIST = Object.freeze(Object.values(DEVICE_CAPABILITY));

export const SKILL_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  SUSPENDED: 'SUSPENDED',
});

export const SKILL_STATUS_LIST = Object.freeze(Object.values(SKILL_STATUS));

export default {
  RESOURCE_STATUS,
  ROOM_TYPE,
  DEVICE_CAPABILITY,
  SKILL_STATUS,
};
