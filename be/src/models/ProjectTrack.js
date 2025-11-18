import mongoose from 'mongoose';

const projectTrackSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    trackName: { type: String, default: 'Track' },
    trackOrder: { type: Number },
    // Track type metadata
    trackType: { type: String, enum: ['backing', 'lick', 'midi', 'audio'], default: 'lick' },
    isBackingTrack: { type: Boolean, default: false },
    color: { type: String, default: '#2563eb' },
    volume: { type: Number, default: 1.0, required: true },
    pan: { type: Number, default: 0.0, required: true },
    muted: { type: Boolean, default: false, required: true },
    solo: { type: Boolean, default: false, required: true },
  },
  { timestamps: false }
);

projectTrackSchema.index({ projectId: 1, trackOrder: 1 });
projectTrackSchema.index({ projectId: 1, isBackingTrack: 1 });

const ProjectTrack = mongoose.model('ProjectTrack', projectTrackSchema);
export default ProjectTrack;


