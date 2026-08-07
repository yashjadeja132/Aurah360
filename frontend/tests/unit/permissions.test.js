/**
 * Skeleton — frontend permission util tests.
 * Target: src/utils/permissions.js
 */
export const cases = [
  { permissions: ['*'], need: ['users.view'], expected: true },
  { permissions: ['users.view'], need: ['users.create'], expected: false },
  { permissions: ['users.*'], need: ['users.edit'], expected: true },
];
