import { useEffect, useRef } from "react";
import * as Tone from "tone";
import { useStudio } from "../../../store/StudioContext";

// Chord to notes mapping
const chordToNotes = (chordName) => {
  if (
    !chordName ||
    chordName === "" ||
    chordName === "N.C." ||
    chordName === "%"
  ) {
    return null;
  }

  const noteMap = {
    C: 0,
    "C#": 1,
    Db: 1,
    D: 2,
    "D#": 3,
    Eb: 3,
    E: 4,
    F: 5,
    "F#": 6,
    Gb: 6,
    G: 7,
    "G#": 8,
    Ab: 8,
    A: 9,
    "A#": 10,
    Bb: 10,
    B: 11,
  };
  const noteNames = [
    "C",
    "C#",
    "D",
    "D#",
    "E",
    "F",
    "F#",
    "G",
    "G#",
    "A",
    "A#",
    "B",
  ];

  // Parse chord name
  let root = chordName[0];
  let idx = 1;
  if (chordName[1] === "#" || chordName[1] === "b") {
    root += chordName[1];
    idx = 2;
  }
  const quality = chordName.slice(idx);
  const rootNote = noteMap[root];
  if (rootNote === undefined) return null;

  // Chord intervals
  let intervals = [0, 4, 7]; // Major triad default
  if (quality.includes("m7b5") || quality.includes("ø")) {
    intervals = [0, 3, 6, 10];
  } else if (quality.includes("dim7") || quality.includes("°7")) {
    intervals = [0, 3, 6, 9];
  } else if (quality.includes("dim") || quality.includes("°")) {
    intervals = [0, 3, 6];
  } else if (quality.includes("aug") || quality.includes("+")) {
    intervals = [0, 4, 8];
  } else if (quality.includes("maj7") || quality.includes("M7")) {
    intervals = [0, 4, 7, 11];
  } else if (quality.includes("m7") || quality.includes("min7")) {
    intervals = [0, 3, 7, 10];
  } else if (quality.includes("7")) {
    intervals = [0, 4, 7, 10];
  } else if (quality.includes("m") || quality.includes("min")) {
    intervals = [0, 3, 7];
  }

  return intervals.map((i) => noteNames[(rootNote + i) % 12] + "3");
};

// Style patterns
const stylePatterns = {
  Swing: {
    piano: [0, 2], // beats to play
    bass: [0, 2],
    drums: { kick: [0], snare: [1, 3], hihat: [0, 1, 2, 3] },
  },
  Bossa: {
    piano: [0, 1.5, 3],
    bass: [0, 1.5, 2, 3.5],
    drums: { kick: [0, 2], snare: [], hihat: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5] },
  },
  Latin: {
    piano: [0, 0.5, 1.5, 2, 3],
    bass: [0, 1, 2, 3],
    drums: {
      kick: [0, 2.5],
      snare: [1, 3],
      hihat: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5],
    },
  },
  Ballad: {
    piano: [0],
    bass: [0, 2],
    drums: { kick: [0], snare: [2], hihat: [0, 1, 2, 3] },
  },
  Funk: {
    piano: [0, 0.5, 1.5, 2.5, 3],
    bass: [0, 0.75, 1.5, 2, 2.75, 3.5],
    drums: {
      kick: [0, 1.5, 2.5],
      snare: [1, 3],
      hihat: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5],
    },
  },
  Rock: {
    piano: [0, 2],
    bass: [0, 1, 2, 3],
    drums: {
      kick: [0, 2],
      snare: [1, 3],
      hihat: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5],
    },
  },
};

export default function LiveBackingEngine() {
  const { state, actions } = useStudio();
  const { song, bandSettings, isPlaying } = state;

  const pianoRef = useRef(null);
  const bassRef = useRef(null);
  const drumsRef = useRef(null);
  const lickPlayersRef = useRef({});
  const loopRef = useRef(null);
  const beatRef = useRef(0);

  // Initialize instruments
  useEffect(() => {
    pianoRef.current = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.02, decay: 0.3, sustain: 0.4, release: 0.8 },
    }).toDestination();

    bassRef.current = new Tone.MonoSynth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.05, decay: 0.2, sustain: 0.6, release: 0.4 },
      filterEnvelope: {
        attack: 0.06,
        decay: 0.2,
        sustain: 0.5,
        release: 0.2,
        baseFrequency: 200,
        octaves: 2,
      },
    }).toDestination();

    drumsRef.current = {
      kick: new Tone.MembraneSynth({
        pitchDecay: 0.05,
        octaves: 6,
      }).toDestination(),
      snare: new Tone.NoiseSynth({
        noise: { type: "white" },
        envelope: { attack: 0.001, decay: 0.2, sustain: 0 },
      }).toDestination(),
      hihat: new Tone.MetalSynth({
        frequency: 200,
        envelope: { attack: 0.001, decay: 0.1, release: 0.01 },
        harmonicity: 5.1,
        modulationIndex: 32,
        resonance: 4000,
        octaves: 1.5,
      }).toDestination(),
    };
    drumsRef.current.hihat.volume.value = -10;

    return () => {
      pianoRef.current?.dispose();
      bassRef.current?.dispose();
      drumsRef.current?.kick.dispose();
      drumsRef.current?.snare.dispose();
      drumsRef.current?.hihat.dispose();
      disposeLickPlayers();
    };
  }, []);

  // Update volumes
  useEffect(() => {
    if (pianoRef.current) {
      pianoRef.current.volume.value = bandSettings.mutes.piano
        ? -Infinity
        : Tone.gainToDb(bandSettings.volumes.piano);
    }
    if (bassRef.current) {
      bassRef.current.volume.value = bandSettings.mutes.bass
        ? -Infinity
        : Tone.gainToDb(bandSettings.volumes.bass);
    }
    if (drumsRef.current) {
      const drumVol = bandSettings.mutes.drums
        ? -Infinity
        : Tone.gainToDb(bandSettings.volumes.drums);
      drumsRef.current.kick.volume.value = drumVol;
      drumsRef.current.snare.volume.value = drumVol;
      drumsRef.current.hihat.volume.value = drumVol - 10;
    }
  }, [bandSettings]);

  // Play/Stop logic
  useEffect(() => {
    if (isPlaying) {
      startPlayback();
    } else {
      stopPlayback();
    }

    return () => stopPlayback();
  }, [isPlaying, song.bpm, song.style, song.sections]);

  const startPlayback = async () => {
    await Tone.start();
    Tone.Transport.bpm.value = song.bpm;
    beatRef.current = 0;
    disposeLickPlayers();

    const pattern = stylePatterns[song.style] || stylePatterns.Swing;
    const totalBeats = song.sections.reduce(
      (sum, s) => sum + s.bars.length * 4,
      0
    );

    if (totalBeats === 0) return;

    loopRef.current = new Tone.Loop((time) => {
      const beat = beatRef.current;
      const beatInBar = beat % 4;

      // Find current section and bar
      let currentBeat = 0;
      let currentChord = null;
      let currentSection = null;
      let barIdx = 0;

      for (const section of song.sections) {
        const sectionBeats = section.bars.length * 4;
        if (beat < currentBeat + sectionBeats) {
          barIdx = Math.floor((beat - currentBeat) / 4);
          currentChord = section.bars[barIdx];
          currentSection = section;
          break;
        }
        currentBeat += sectionBeats;
      }

      const notes = chordToNotes(currentChord);

      // Piano
      if (notes && pattern.piano.includes(beatInBar)) {
        pianoRef.current?.triggerAttackRelease(notes, "8n", time);
      }

      // Bass
      if (notes && pattern.bass.includes(beatInBar)) {
        const bassNote = notes[0].replace("3", "2");
        bassRef.current?.triggerAttackRelease(bassNote, "8n", time);
      }

      // Drums
      if (pattern.drums.kick.includes(beatInBar)) {
        drumsRef.current?.kick.triggerAttackRelease("C1", "8n", time);
      }
      if (pattern.drums.snare.includes(beatInBar)) {
        drumsRef.current?.snare.triggerAttackRelease("8n", time);
      }
      if (pattern.drums.hihat.includes(beatInBar)) {
        drumsRef.current?.hihat.triggerAttackRelease("32n", time);
      }

      if (currentSection?.licks?.length) {
        currentSection.licks
          .filter((lick) => lick.startBar === barIdx)
          .forEach((lick) => {
            console.log(
              "[Studio Playback] Triggering lick",
              lick.name || lick.data?.title || lick.lickId,
              "section",
              currentSection?.label,
              "bar",
              barIdx + 1
            );
            const player = ensureLickPlayer(lick);
            startLickPlayer(player, time);
          });
      }

      // Update beat counter
      actions.setCurrentBeat(beat);
      beatRef.current = (beat + 1) % totalBeats;
    }, "4n");

    loopRef.current.start(0);
    Tone.Transport.start();
  };

  const stopPlayback = () => {
    loopRef.current?.stop();
    loopRef.current?.dispose();
    loopRef.current = null;
    Tone.Transport.stop();
    beatRef.current = 0;
    actions.setCurrentBeat(0);
    disposeLickPlayers();
  };

  const disposeLickPlayers = () => {
    Object.values(lickPlayersRef.current).forEach((player) => {
      try {
        player.stop();
        player.dispose();
      } catch (err) {
        // ignore
      }
    });
    lickPlayersRef.current = {};
  };

  const ensureLickPlayer = (lick) => {
    if (!lick.audioUrl) return null;
    const key = `${lick.lickId || lick.id}-${lick.audioUrl}`;
    let player = lickPlayersRef.current[key];
    if (!player) {
      player = new Tone.Player(lick.audioUrl).toDestination();
      player.autostart = false;
      player.volume.value = -3;
      lickPlayersRef.current[key] = player;
    }
    return player;
  };

  const startLickPlayer = (player, time) => {
    if (!player) return;

    const triggerStart = (startTime = time) => {
      try {
        player.stop();
        player.start(startTime);
      } catch (err) {
        console.error("Unable to start lick player", err);
      }
    };

    const isLoaded = player.buffer && player.buffer.loaded;
    if (isLoaded) {
      triggerStart(time);
      return;
    }

    player.buffer.onload = () => triggerStart(Tone.now());
    if (player.buffer.url) {
      player.buffer.load(player.buffer.url).catch((err) => {
        console.error("Unable to load lick player", err);
      });
    }
  };

  return null; // No UI
}
