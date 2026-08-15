
import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
const UserDeviceSchema = new mongoose.Schema({ userId: mongoose.Schema.Types.ObjectId, deviceId: String, isActive: Boolean }, { collection: 'userdevices' });
const UserDevice = mongoose.model('UserDevice', UserDeviceSchema);
const SessionSchema = new mongoose.Schema({ userId: mongoose.Schema.Types.ObjectId, deviceId: String, refreshTokenHash: String }, { collection: 'sessions' });
const Session = mongoose.model('Session', SessionSchema);

await mongoose.connect(process.env.MONGO_URI);
await UserDevice.deleteMany({});
await Session.deleteMany({});
console.log('Cleared');
await mongoose.disconnect();
