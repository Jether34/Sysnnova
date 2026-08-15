
import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const UserSchema = new mongoose.Schema({ 
  email: String, 
  password: String, 
  role: String, 
  firstName: String, 
  lastName: String,
  grade: String,
  academicYear: String,
  verifiedIps: [String],
  deviceId: String,
  publicKey: String,
  privateKey: String
}, { collection: 'users' });
const User = mongoose.model('User', UserSchema);

await mongoose.connect(process.env.MONGO_URI);
const hash = await bcrypt.hash('test123', 10);
const user = await User.create({
  email: 'direct-test@test.com',
  password: hash,
  role: 'teacher',
  firstName: 'Test',
  lastName: 'User',
  grade: '11',
  academicYear: '2025-2026',
  verifiedIps: [],
  deviceId: '',
  publicKey: '',
  privateKey: ''
});
console.log('Direct insert worked:', user.email);
await mongoose.disconnect();
