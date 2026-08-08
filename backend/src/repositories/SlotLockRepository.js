import Sequence from '../models/Sequence.model.js';

/**
 * NFR-004 — advisory mutexes for scheduling writes.
 *
 * WHY this exists at all: a MongoDB transaction gives snapshot isolation, NOT predicate locks.
 * Wrapping "read the overlapping appointments, then insert" in a transaction does not make it
 * safe — two concurrent transactions both read "nothing overlaps" and both insert, and both
 * commit, because neither wrote a document the other also wrote. The unique index on
 * (doctorId, appointmentDate, startTime) closes the exact-start case, but an OVERLAP
 * (10:00–10:30 vs 10:15–10:45) has no shared key for the index to reject.
 *
 * The standard fix is to give the racers one document to fight over. Each booking $inc's a lock
 * document for every resource-day it touches; the storage engine then guarantees that only one
 * transaction at a time can hold it. The loser gets a WriteConflict, which the driver's
 * `withTransaction` retries automatically, and on the retry it READS the winner's now-committed
 * appointment and fails with a clean 409 instead of double-booking.
 *
 * Reuses the existing `sequences` collection (already unique on `key`) rather than introducing a
 * collection: a lock IS an atomic counter, and nothing ever reads the value back.
 */
class SlotLockRepository {
  constructor() {
    this.model = Sequence;
  }

  /** Day-granular key. Locking the whole day (not the minute) is what makes the mutex cover
   *  overlaps: two appointments that overlap are necessarily on the same day. */
  static key(scope, id, date) {
    const d = new Date(date);
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
    return `slotlock:${scope}:${String(id)}:${day}`;
  }

  /**
   * Every resource whose availability the booking asserts gets its own lock, so concurrency is
   * only reduced where it must be: two doctors, two branches, two days or two rooms never
   * contend with each other.
   */
  keysFor({ doctorId = null, patientId = null, roomId = null, deviceId = null, date }) {
    const keys = [];
    if (doctorId) keys.push(SlotLockRepository.key('doctor', doctorId, date));
    if (patientId) keys.push(SlotLockRepository.key('patient', patientId, date));
    if (roomId) keys.push(SlotLockRepository.key('room', roomId, date));
    if (deviceId) keys.push(SlotLockRepository.key('device', deviceId, date));
    // Deterministic order — every booker takes the locks in the same sequence, so contention
    // degrades into a queue rather than into mutual aborts.
    return keys.sort();
  }

  /**
   * Create any missing lock documents OUTSIDE the transaction. An upsert inside a transaction can
   * raise a duplicate-key error when two sessions insert the same new key, which would surface as
   * a transaction abort rather than as the ordinary contention we want. Here a lost race is
   * simply "someone else created it first", which is the desired end state anyway.
   */
  async ensure(keys) {
    await Promise.all(
      keys.map(async (key) => {
        try {
          await this.model.updateOne({ key }, { $setOnInsert: { value: 0 } }, { upsert: true }).exec();
        } catch (err) {
          if (err?.code !== 11000) throw err;
        }
      })
    );
  }

  /** Take the locks inside the caller's transaction. No upsert — `ensure` already ran. */
  async claim(keys, session) {
    for (const key of keys) {
      // Sequential and ordered on purpose: see keysFor().
      // eslint-disable-next-line no-await-in-loop
      await this.model.updateOne({ key }, { $inc: { value: 1 } }, { session }).exec();
    }
  }
}

export default SlotLockRepository;
