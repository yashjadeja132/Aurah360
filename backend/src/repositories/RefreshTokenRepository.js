import BaseRepository from './BaseRepository.js';
import RefreshToken from '../models/RefreshToken.model.js';

class RefreshTokenRepository extends BaseRepository {
  constructor() {
    super(RefreshToken);
  }

  async findValidByHash(tokenHash) {
    return this.model
      .findOne({
        tokenHash,
        revokedAt: null,
        expiresAt: { $gt: new Date() },
      })
      .exec();
  }

  async revokeByHash(tokenHash) {
    return this.model
      .findOneAndUpdate(
        { tokenHash, revokedAt: null },
        { revokedAt: new Date() },
        { new: true }
      )
      .exec();
  }

  async revokeAllForUser(userId) {
    return this.model
      .updateMany(
        { userId, revokedAt: null },
        { revokedAt: new Date() }
      )
      .exec();
  }
}

export default RefreshTokenRepository;
