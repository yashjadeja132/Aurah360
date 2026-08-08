import './src/config/env.js';
import mongoose from 'mongoose';

await mongoose.connect(process.env.MONGODB_URI);
const admin = mongoose.connection.getClient().db().admin();
const { databases } = await admin.listDatabases();
let total = 0;
for (const d of databases) {
  const db = mongoose.connection.getClient().db(d.name);
  let n = 0;
  try { n = (await db.listCollections().toArray()).length; } catch { n = -1; }
  total += n > 0 ? n : 0;
  console.log(String(n).padStart(4), d.name);
}
console.log('TOTAL', total);
await mongoose.disconnect();
