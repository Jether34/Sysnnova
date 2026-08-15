
import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
const UserSchema = new mongoose.Schema({ email: String, role: String }, { collection: 'users' });
const User = mongoose.model('User', UserSchema);

await mongoose.connect(process.env.MONGO_URI);
const user = await User.findOne({ email: 'signup@test.com' });
console.log('User found:', user ? 'YES - ' + user.email : 'NO');
await mongoose.disconnect();
