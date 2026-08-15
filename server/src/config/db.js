import mongoose from "mongoose";
import { env } from "./index.js";

export async function connectDb() {
  try {
    await mongoose.connect(env.mongoUri);
    console.log(`[db] connected to ${env.mongoUri}`);
  } catch (err) {
    console.error("[db] connection failed:", err.message);
    process.exit(1);
  }
}
