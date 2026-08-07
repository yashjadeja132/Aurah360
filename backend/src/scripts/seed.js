/**
 * Module 1 seed — permissions, roles, Owner, Admin.
 * Run: npm run seed (from backend/)
 * Contains no real patient/clinical data.
 */
import '../config/env.js';
import database from '../config/database.js';
import Permission from '../models/Permission.model.js';
import Role from '../models/Role.model.js';
import User from '../models/User.model.js';
import { PERMISSION_CATALOG } from '../constants/permissions.js';
import { ROLES, ROLE_LABELS, ROLE_LIST } from '../constants/roles.js';
import { ROLE_PERMISSIONS } from '../constants/rolePermissions.js';
import { USER_STATUS } from '../enums/userStatus.js';
import { hashPassword } from '../helpers/crypto.helper.js';
import logger from '../libs/logger.js';
import { seedModule2 } from './seedModule2.js';
import { seedModule3 } from './seedModule3.js';
import { seedModule4 } from './seedModule4.js';
import { seedModule5 } from './seedModule5.js';
import { seedModule6 } from './seedModule6.js';
import { seedModule7 } from './seedModule7.js';
import { seedModule8 } from './seedModule8.js';
import { seedModule9 } from './seedModule9.js';
import { seedModule10 } from './seedModule10.js';
import { seedModule11 } from './seedModule11.js';
import { seedModule12 } from './seedModule12.js';
import { seedModule13 } from './seedModule13.js';
import { seedModule14 } from './seedModule14.js';
import { seedModule15 } from './seedModule15.js';
import seedModule16 from './seedModule16.js';
import { seedModule17 } from './seedModule17.js';
import { seedModule18 } from './seedModule18.js';
import { seedModule19 } from './seedModule19.js';

const SEED_OWNER = {
  email: process.env.SEED_OWNER_EMAIL || 'owner@aurah360.local',
  password: process.env.SEED_OWNER_PASSWORD || 'ChangeMe@12345',
  firstName: 'Aurah',
  lastName: 'Owner',
};

const SEED_ADMIN = {
  email: process.env.SEED_ADMIN_EMAIL || 'admin@aurah360.local',
  password: process.env.SEED_ADMIN_PASSWORD || 'ChangeMe@12345',
  firstName: 'Clinic',
  lastName: 'Admin',
};

async function seedPermissions() {
  for (const item of PERMISSION_CATALOG) {
    await Permission.findOneAndUpdate(
      { key: item.key },
      {
        $set: {
          key: item.key,
          module: item.module,
          description: item.description,
          isSystem: true,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
  logger.info('Permissions seeded', { count: PERMISSION_CATALOG.length });
}

async function seedRoles() {
  for (const code of ROLE_LIST) {
    await Role.findOneAndUpdate(
      { code },
      {
        $set: {
          code,
          name: ROLE_LABELS[code],
          description: `${ROLE_LABELS[code]} system role`,
          permissions: ROLE_PERMISSIONS[code] || [],
          isSystem: true,
          isActive: true,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
  logger.info('Roles seeded', { count: ROLE_LIST.length });
}

async function upsertStaffUser({ email, password, firstName, lastName, role, employeeId }) {
  const roleDoc = await Role.findOne({ code: role });
  if (!roleDoc) {
    throw new Error(`Role ${role} missing — seed roles first`);
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    existing.role = role;
    existing.roleId = roleDoc._id;
    existing.firstName = firstName;
    existing.lastName = lastName;
    existing.isActive = true;
    existing.status = USER_STATUS.ACTIVE;
    existing.deletedAt = null;
    await existing.save();
    logger.info('User already existed — refreshed', { email, role });
    return existing;
  }

  const passwordHash = await hashPassword(password);
  const user = await User.create({
    firstName,
    lastName,
    email,
    passwordHash,
    role,
    roleId: roleDoc._id,
    permissions: [],
    employeeId,
    status: USER_STATUS.ACTIVE,
    isActive: true,
    mustChangePassword: true,
  });

  logger.info('User seeded', { email, role });
  return user;
}

async function seed() {
  await database.connect();

  await seedPermissions();
  await seedRoles();

  await upsertStaffUser({
    ...SEED_OWNER,
    role: ROLES.OWNER,
    employeeId: 'EMP-OWNER-001',
  });

  await upsertStaffUser({
    ...SEED_ADMIN,
    role: ROLES.ADMIN,
    employeeId: 'EMP-ADMIN-001',
  });

  await seedModule2();
  await seedModule3();
  await seedModule4();
  await seedModule5();
  await seedModule6();
  await seedModule7();
  await seedModule8();
  await seedModule9();
  await seedModule10();
  await seedModule11();
  await seedModule12();
  await seedModule13();
  await seedModule14();
  await seedModule15();
  await seedModule16();
  await seedModule17();
  await seedModule18();
  await seedModule19();

  logger.warn('Change seed passwords immediately after first login');
  await database.disconnect();
}

seed().catch(async (err) => {
  logger.error('Seed failed', { message: err.message, stack: err.stack });
  try {
    await database.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
