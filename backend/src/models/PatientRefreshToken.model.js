import mongoose from 'mongoose';

const patientRefreshTokenSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    userAgent: { type: String, default: null },
    ipAddress: { type: String, default: null },
  },
  {
    timestamps: true,
    collection: 'patient_refresh_tokens',
  }
);

patientRefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const PatientRefreshToken = mongoose.model('PatientRefreshToken', patientRefreshTokenSchema);
export default PatientRefreshToken;
