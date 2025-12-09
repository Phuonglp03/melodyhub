import mongoose from "mongoose";

const BandMemberSchema = new mongoose.Schema(
  {
    instanceId: { type: String, required: true },
    name: { type: String, default: "New Instrument" },
    type: {
      type: String,
      enum: [
        "drums",
        "bass",
        "piano",
        "guitar",
        "pad",
        "strings",
        "percussion",
      ],
      required: true,
    },
    soundBank: { type: String, default: "grand-piano" },
    role: {
      type: String,
      enum: ["rhythm", "bass", "comping", "lead", "pad", "arpeggiator"],
      default: "comping",
    },
    volume: { type: Number, default: 0.8, min: 0, max: 1 },
    pan: { type: Number, default: 0, min: -1, max: 1 },
    isMuted: { type: Boolean, default: false },
    isSolo: { type: Boolean, default: false },
  },
  { _id: false }
);

const bandSettingsSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      default: "Default Band Settings",
    },
    description: { type: String },
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    style: { type: String, default: "Swing" },
    swingAmount: { type: Number, default: 0.6, min: 0, max: 1 },
    members: [BandMemberSchema],
    isPublic: { type: Boolean, default: false },
    isDefault: { type: Boolean, default: false }, // For default system settings
  },
  { timestamps: true }
);

bandSettingsSchema.index({ creatorId: 1, updatedAt: -1 });
bandSettingsSchema.index({ isPublic: 1, isDefault: 1 });

const BandSettings = mongoose.model("BandSettings", bandSettingsSchema);
export default BandSettings;

