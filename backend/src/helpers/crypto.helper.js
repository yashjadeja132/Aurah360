import { createHash, randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';

export const hashPassword = async (plain) => bcrypt.hash(plain, 12);

export const comparePassword = async (plain, hash) => bcrypt.compare(plain, hash);

export const sha256 = (value) => createHash('sha256').update(value).digest('hex');

export const generateOpaqueToken = (bytes = 48) => randomBytes(bytes).toString('hex');

export default {
  hashPassword,
  comparePassword,
  sha256,
  generateOpaqueToken,
};
