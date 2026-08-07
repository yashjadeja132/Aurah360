import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Valid email is required').transform((v) => v.toLowerCase().trim()),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase().trim()),
});

export const verifyMfaSchema = z.object({
  challengeToken: z.string().min(1),
  token: z.string().min(6).max(20),
});

export const mfaTokenSchema = z.object({
  token: z.string().min(6).max(6),
  // Present when this call is authenticated via authenticateOrMfaSetupToken instead of a
  // real session (SEC-021 — enrollment forced mid-login/refresh). Verified by that middleware;
  // kept optional here since it's absent on the voluntary opt-in path.
  mfaSetupToken: z.string().min(1).optional(),
});

export const stepUpSchema = z.object({
  password: z.string().min(1).optional(),
  mfaToken: z.string().min(6).max(6).optional(),
});
