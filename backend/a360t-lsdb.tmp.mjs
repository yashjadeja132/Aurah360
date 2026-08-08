/* Temporary, READ-ONLY diagnostic: lists databases and their collection counts. Drops nothing. */
import './src/config/env.js';
import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI;
await mongoose.connect(uri.replace(/\/[^/?]*(\?|$)/, '/admin$1'));
const client = mongoose.connection.getClient();
const { databases } = await client.db('admin').admin().listDatabases();

let total = 0;
const rows = [];
for (const d of databases) {
  if (['admin', 'local', 'config'].includes(d.name)) continue;
  const cols = await client.db(d.name).listCollections().toArray();
  total += cols.length;
  rows.push([d.name, cols.length]);
}
rows.sort((a, b) => b[1] - a[1]);
console.log(rows.map((r) => `${r[1]}\t${r[0]}`).join('\n'));
console.log('TOTAL COLLECTIONS:', total, 'DBS:', rows.length);
await mongoose.disconnect();
