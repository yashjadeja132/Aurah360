import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { TOKEN_TYPE } from '../enums/tokenType.js';

/** Patient JWT — secrets separate from staff TokenService. */
class PatientTokenService {
  signAccessToken(payload) {
    return jwt.sign(
      { ...payload, type: TOKEN_TYPE.PATIENT_ACCESS, audience: 'patient-portal' },
      config.patientJwt.accessSecret,
      { expiresIn: config.patientJwt.accessExpiresIn }
    );
  }

  signRefreshToken(payload) {
    return jwt.sign(
      { ...payload, type: TOKEN_TYPE.PATIENT_REFRESH, audience: 'patient-portal' },
      config.patientJwt.refreshSecret,
      { expiresIn: config.patientJwt.refreshExpiresIn }
    );
  }

  verifyAccessToken(token) {
    const payload = jwt.verify(token, config.patientJwt.accessSecret);
    if (payload.type !== TOKEN_TYPE.PATIENT_ACCESS) {
      throw new jwt.JsonWebTokenError('Invalid patient token type');
    }
    return payload;
  }

  verifyRefreshToken(token) {
    const payload = jwt.verify(token, config.patientJwt.refreshSecret);
    if (payload.type !== TOKEN_TYPE.PATIENT_REFRESH) {
      throw new jwt.JsonWebTokenError('Invalid patient refresh token type');
    }
    return payload;
  }
}

export default PatientTokenService;
