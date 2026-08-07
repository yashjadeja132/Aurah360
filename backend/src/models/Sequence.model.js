import mongoose from 'mongoose';

/**
 * Atomic counters (MRN sequences, etc.).
 */
const sequenceSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Number, required: true, default: 0 },
  },
  { collection: 'sequences', timestamps: true }
);

const Sequence = mongoose.model('Sequence', sequenceSchema);

export async function getNextSequence(key) {
  const doc = await Sequence.findOneAndUpdate(
    { key },
    { $inc: { value: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).exec();
  return doc.value;
}

export default Sequence;
