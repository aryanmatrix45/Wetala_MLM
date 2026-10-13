import mongoose from 'mongoose';
import { Member } from '../src/models/Member.model';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

async function run() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/wetala_mlm';
  console.log('[Connecting to]', uri.includes('@') ? uri.split('@')[1] : uri);
  await mongoose.connect(uri);
  const pendingMembers = await Member.find({
    $or: [{ approvalStatus: 'pending' }, { status: 'pending' }]
  });
  console.log(`Found ${pendingMembers.length} pending members.`);
  for (const m of pendingMembers) {
    console.log(`Activating member: ${m.memberId} (${m.name})`);
    m.approvalStatus = 'approved';
    m.status = 'active';
    m.isActive = true;
    await m.save();
  }
  console.log('Migration finished successfully.');
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Error during migration:', err);
  process.exit(1);
});
