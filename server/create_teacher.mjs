
import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from './src/models/User.js';
import School from './src/models/School.js';

await mongoose.connect(process.env.MONGO_URI);

const school = await School.findOne({ name: 'STI College', province: 'Pampanga', city: 'City of San Fernando', barangay: 'Dolores' });
console.log('School:', school ? school._id : 'NOT FOUND');

const hash = await bcrypt.hash('test123', 10);
const user = await User.create({
    role: 'teacher',
    email: 'teacher@test.com',
    password: hash,
    firstName: 'Test',
    lastName: 'Teacher',
    grade: '11',
    strand: 'STEM',
    section: '1',
    academicYear: '2025-2026',
    subject: 'General Mathematics',
    semester: '1st Semester, 1st Quarter',
    schoolId: school._id,
    school: { id: school._id, name: school.name, province: school.province, city: school.city, barangay: school.barangay },
    verifiedIps: [],
    deviceId: ''
});
console.log('Teacher created:', user.email);
await mongoose.disconnect();
