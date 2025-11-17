import Chord from "../models/Chord.js";
import DEFAULT_CHORDS from "../data/defaultChords.js";

export const listChords = async (req, res) => {
  try {
    let chords = await Chord.find().sort({ chordName: 1 });

    if (!chords.length && DEFAULT_CHORDS.length) {
      chords = await Chord.insertMany(DEFAULT_CHORDS);
    }

    res.json({
      success: true,
      data: chords,
    });
  } catch (error) {
    console.error("[ChordController] Failed to fetch chords:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch chords",
      error: error.message,
    });
  }
};

