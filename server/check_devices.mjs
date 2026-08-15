
import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
const UserDeviceSchema = new mongoose.Schema({ userId: mongoose.Schema.Types.ObjectId, deviceId: String, isActive: Boolean, deviceName: String }, { collection: 'userdevices' });
const UserDevice = mongoose.model('UserDevice', UserDeviceSchema);

await mongoose.connect(process.env.MONGO_URI);
const devices = await UserDevice.find({ isActive: true });
devices.forEach(d => console.log(JSON.stringify({userId: d.userId.toString(), deviceId: d.deviceId, deviceName: d.deviceName})));
await mongoose.disconnect();
