import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema({
  roomId:       { type: String, required: true, unique: true },
  content:      { type: String, default: '// start code here' },
  updatedAt:    { type: Date, default: Date.now },
});

export default mongoose.model('Document', documentSchema);
