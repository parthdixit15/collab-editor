// backend/db.js
import mongoose from 'mongoose';
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/realtime';
export async function connectDB() {
  await mongoose.connect(MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  console.log('🌱 MongoDB connected');
}
