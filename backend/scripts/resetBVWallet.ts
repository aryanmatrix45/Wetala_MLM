/**
 * One-off cleanup for development databases that ran the earlier PIN-based BV Wallet.
 *
 * Drops the BV Wallet collections (wallets, transactions, ledger, including their old indexes) and
 * removes BV notifications, so the instant-transfer version starts from a clean slate.
 * Members, purchases, earned BV and commissions are not touched.
 *
 * Usage: npx tsx scripts/resetBVWallet.ts --yes
 */
import mongoose from 'mongoose';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

const BV_COLLECTIONS = ['bvwallets', 'bvtransactions', 'bvwalletledgers'];

async function run() {
  if (!process.argv.includes('--yes')) {
    console.error('This permanently deletes all BV Wallet balances and history. Re-run with --yes to confirm.');
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/wetala_mlm';
  console.log('[Connecting to]', uri.includes('@') ? uri.split('@')[1] : uri);
  await mongoose.connect(uri);
  const db = mongoose.connection.db!;

  const existing = new Set((await db.listCollections().toArray()).map((c) => c.name));
  for (const name of BV_COLLECTIONS) {
    if (existing.has(name)) {
      const count = await db.collection(name).countDocuments();
      await db.collection(name).drop();
      console.log(`Dropped ${name} (${count} documents).`);
    } else {
      console.log(`Skipped ${name} (does not exist).`);
    }
  }

  const notifications = await db.collection('adminnotifications').deleteMany({ type: { $regex: /^BV_/ } });
  console.log(`Removed ${notifications.deletedCount} BV notifications.`);

  console.log('BV Wallet reset finished.');
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Error during BV Wallet reset:', err);
  process.exit(1);
});
