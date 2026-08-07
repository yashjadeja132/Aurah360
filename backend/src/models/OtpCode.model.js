import mongoose from 'mongoose';

/** Mobile OTP for patient app onboarding (APP-002, §16.6) — hashed, short-lived, attempt-limited. */
const otpCodeSchema = new mongoose.Schema(
  {
    mobile: { type: String, required: true, index: true },
    codeHash: { type: String, required: true },
    purpose: { type: String, enum: ['LOGIN', 'VERIFY'], default: 'LOGIN' },
    attempts: { type: Number, default: 0 },
    consumedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, collection: 'otp_codes' }
);

otpCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const OtpCode = mongoose.model('OtpCode', otpCodeSchema);

export default OtpCode;
