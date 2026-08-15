import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';

await mongoose.connect(process.env.MONGO_URI);

const db = mongoose.connection.db;
await db.collection('userdevices').dropIndex('deviceId_1').catch(() => {});
await db.collection('userdevices').createIndex({ userId: 1, deviceId: 1 }, { unique: true });
console.log('Index recreated');

await mongoose.disconnect();