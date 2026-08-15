
import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
const UserDeviceSchema = new mongoose.Schema({ userId: mongoose.Schema.Types.ObjectId, deviceId: String, isActive: Boolean }, { collection: 'userdevices' });
const UserDevice = mongoose.model('UserDevice', UserDeviceSchema);
await mongoose.connect(process.env.MONGO_URI);
const d = await UserDevice.find({});
d.forEach(x => console.log(JSON.stringify({userId: x.userId.toString(), deviceId: x.deviceId, isActive: x.isActive})));
await mongoose.disconnect();
