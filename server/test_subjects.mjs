
import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import SchoolSubjects from './src/models/SchoolSubjects.js';

await mongoose.connect(process.env.MONGO_URI);
const config = await SchoolSubjects.findOne({ schoolId: '6a79f62d303a5a1f01251e22', semester: '1st Semester, 1st Quarter' });
console.log('SchoolSubjects config:', config ? 'FOUND' : 'NOT FOUND');
await mongoose.disconnect();
