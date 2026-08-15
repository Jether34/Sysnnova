import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';

await mongoose.connect(process.env.MONGO_URI);

const db = mongoose.connection.db;

// List all indexes first
const indexes = await db.collection('userdevices').indexes();
console.log('Current indexes:', JSON.stringify(indexes, null, 2));

// Drop the old deviceId_1 index
try {
  await db.collection('userdevices').dropIndex('deviceId_1');
  console.log('Dropped deviceId_1 index');
} catch (e) {
  console.log('Could not drop deviceId_1:', e.message);
}

// Create the new compound index
try {
  await db.collection('userdevices').createIndex({ userId: 1, deviceId: 1 }, { unique: true });
  console.log('Created compound index');
} catch (e) {
  console.log('Could not create compound index:', e.message);
}

// Verify final indexes
const finalIndexes = await db.collection('userdevices').indexes();
console.log('Final indexes:', JSON.stringify(finalIndexes, null, 2));

await mongoose.disconnect();