import mongoose from 'mongoose';
import User from './models/User.js';
import bcrypt from 'bcryptjs';

await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/agrimind');

// Delete existing
await User.deleteOne({ email: 'garquejether681@gmail.com' });
console.log('Deleted existing user');

// Create new admin user with lower bcrypt rounds
const hash = await bcrypt.hash('12345678', 5);
const user = await User.create({
  email: 'garquejether681@gmail.com',
  password: hash,
  role: 'admin',
  firstName: 'Jether',
  lastName: 'Garque',
  grade: '0',
  academicYear: '2025-2026',
  verifiedIps: [],
  deviceId: ''
});

console.log('Admin user created:', user.email, user.role);

// Clear devices and sessions
const db = mongoose.connection.db;
await db.collection('userdevices').deleteMany({});
await db.collection('sessions').deleteMany({});
console.log('Cleared all devices and sessions');

await mongoose.disconnect();
