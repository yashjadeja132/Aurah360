/** Ad-hoc smoke test for the new patient OTP login flow (not part of Vitest). */
import '../config/env.js';
import mongoose from 'mongoose';
import config from '../config/index.js';
import Patient from '../models/Patient.model.js';
import PatientAuthService from '../services/PatientAuthService.js';

async function main() {
  await mongoose.connect(config.mongo.uri.replace(/\/([^/?]+)$/, '/aurah360_smoke_otp'));
  await mongoose.connection.dropDatabase();

  const patient = await Patient.create({
    mrn: `MRN-OTP-${Date.now()}`,
    firstName: 'Otp',
    lastName: 'Smoke',
    gender: 'MALE',
    mobile: '9812345678',
    portalEnabled: true,
    primaryBranchId: new mongoose.Types.ObjectId(),
  });

  const auth = new PatientAuthService();
  const otpResult = await auth.requestOtp(patient.mobile);
  console.log('requestOtp:', otpResult);

  if (!otpResult.devCode) throw new Error('devCode missing — cannot smoke test without it');

  const loginResult = await auth.otpLogin({ mobile: patient.mobile, code: otpResult.devCode });
  console.log('otpLogin success. accessToken present:', Boolean(loginResult.accessToken));

  try {
    await auth.otpLogin({ mobile: patient.mobile, code: otpResult.devCode });
    throw new Error('Second use of the same OTP should have failed!');
  } catch (err) {
    console.log('Replay correctly rejected:', err.message);
  }

  try {
    await auth.otpLogin({ mobile: '9999999999', code: '123456' });
    throw new Error('Unregistered mobile should have failed!');
  } catch (err) {
    console.log('Unregistered mobile correctly rejected:', err.message);
  }

  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  console.log('SMOKE PASS');
}

main().catch((err) => {
  console.error('SMOKE FAIL', err);
  process.exit(1);
});
