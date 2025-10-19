import mongoose from 'mongoose';

const liveRoomSchema = new mongoose.Schema(
  {
    hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    description: { type: String },
    streamKey: { type: String, required: true, unique: true },
    status: { type: String, enum: ['waiting', 'live', 'ended'], default: 'waiting', required: true },
    privacyType: { type: String, enum: ['public', 'follow_only'], default: 'public', required: true },
    moderationStatus: { type: String, enum: ['active', 'banned'], default: 'active', required: true },
    recordingUrl: { type: String },
    scheduledAt: { type: Date },
    startedAt: { type: Date },
    endedAt: { type: Date },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

const LiveRoom = mongoose.model('LiveRoom', liveRoomSchema);
export default LiveRoom;


