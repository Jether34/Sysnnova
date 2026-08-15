
import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
const SchoolSchema = new mongoose.Schema({ name: String, province: String, city: String, barangay: String }, { collection: 'schools' });
const School = mongoose.model('School', SchoolSchema);

await mongoose.connect(process.env.MONGO_URI);
const school = await School.findOne({ name: 'STI College', province: 'Pampanga', city: 'City of San Fernando', barangay: 'Dolores' });
console.log('School found:', school ? 'YES' : 'NO');
await mongoose.disconnect();
