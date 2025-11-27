import mongoose from "mongoose";
import { DEFAULT_KEY, DEFAULT_TIME_SIGNATURE } from "../utils/musicTheory.js";

const projectSchema = new mongoose.Schema(
  {
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String },
    coverImageUrl: { type: String },
    tempo: { type: Number, default: 120 },
    key: {
      type: {
        root: { type: Number, min: 0, max: 11, default: DEFAULT_KEY.root },
        scale: { type: String, default: DEFAULT_KEY.scale },
        name: { type: String, default: DEFAULT_KEY.name },
      },
      default: () => ({ ...DEFAULT_KEY }),
    },
    timeSignature: {
      type: {
        numerator: {
          type: Number,
          min: 1,
          max: 32,
          default: DEFAULT_TIME_SIGNATURE.numerator,
        },
        denominator: {
          type: Number,
          min: 1,
          max: 32,
          default: DEFAULT_TIME_SIGNATURE.denominator,
        },
        name: { type: String, default: DEFAULT_TIME_SIGNATURE.name },
      },
      default: () => ({ ...DEFAULT_TIME_SIGNATURE }),
    },
    swingAmount: { type: Number, min: 0, max: 100, default: 0 },
    masterVolume: { type: Number, default: 1.0 },
    status: {
      type: String,
      enum: ["draft", "active", "completed", "inactive"],
      default: "draft",
      required: true,
    },
    isPublic: { type: Boolean, default: false, required: true },
    // Legacy fields kept for backwards compatibility while chord blocks migrate to timeline clips
    chordProgression: { type: [String], default: [] },
    backingInstrumentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Instrument",
    },
    backingPlayingPatternId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PlayingPattern",
    },
  },
  { timestamps: true }
);

projectSchema.index({ creatorId: 1 });

const Project = mongoose.model("Project", projectSchema);
export default Project;
