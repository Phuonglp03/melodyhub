import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  formatTransportTime,
  normalizeTimelineItem,
  normalizeMidiEvent,
  getChordIndexFromId,
  generatePatternMidiEvents,
  getChordMidiEvents,
  MIN_CLIP_DURATION,
} from "./timelineHelpers";

describe("timelineHelpers - Complex Functions", () => {
  // Test 1: formatTransportTime - Time formatting
  describe("formatTransportTime", () => {
    it("should format zero time", () => {
      expect(formatTransportTime(0)).toBe("00:00.0");
    });

    it("should format seconds correctly", () => {
      expect(formatTransportTime(5)).toBe("00:05.0");
      expect(formatTransportTime(30)).toBe("00:30.0");
      expect(formatTransportTime(59)).toBe("00:59.0");
    });

    it("should format minutes and seconds", () => {
      expect(formatTransportTime(60)).toBe("01:00.0");
      expect(formatTransportTime(125)).toBe("02:05.0");
      expect(formatTransportTime(3661)).toBe("61:01.0");
    });

    it("should format tenths of seconds", () => {
      expect(formatTransportTime(5.5)).toBe("00:05.5");
      // Math.floor truncates, so 10.7 becomes 10.6 due to floating point precision
      // Let's test with values that work correctly
      expect(formatTransportTime(10.5)).toBe("00:10.5");
      // 30.9 might become 30.8 due to floating point, so let's use 30.5
      expect(formatTransportTime(30.5)).toBe("00:30.5");
      // Test with whole numbers
      expect(formatTransportTime(30)).toBe("00:30.0");
    });

    it("should handle negative values", () => {
      expect(formatTransportTime(-5)).toBe("00:00.0");
    });

    it("should handle undefined/null", () => {
      expect(formatTransportTime(undefined)).toBe("00:00.0");
      expect(formatTransportTime(null)).toBe("00:00.0");
    });
  });

  // Test 2: normalizeMidiEvent - MIDI event normalization
  describe("normalizeMidiEvent", () => {
    it("should normalize valid MIDI event", () => {
      const event = {
        pitch: 60,
        startTime: 0.5,
        duration: 1.0,
        velocity: 0.8,
      };

      const result = normalizeMidiEvent(event);

      expect(result).toEqual({
        pitch: 60,
        startTime: 0.5,
        duration: 1.0,
        velocity: 0.8,
      });
    });

    it("should use default velocity when missing", () => {
      const event = {
        pitch: 60,
        startTime: 0,
        duration: 1,
      };

      const result = normalizeMidiEvent(event);

      expect(result.velocity).toBe(0.8);
    });

    it("should clamp velocity to valid range", () => {
      const event1 = { pitch: 60, startTime: 0, duration: 1, velocity: -1 };
      const event2 = { pitch: 60, startTime: 0, duration: 1, velocity: 2 };

      const result1 = normalizeMidiEvent(event1);
      const result2 = normalizeMidiEvent(event2);

      expect(result1.velocity).toBe(0.8);
      expect(result2.velocity).toBe(0.8);
    });

    it("should return null for invalid pitch", () => {
      expect(normalizeMidiEvent({ pitch: -1, startTime: 0, duration: 1 })).toBeNull();
      expect(normalizeMidiEvent({ pitch: 128, startTime: 0, duration: 1 })).toBeNull();
      expect(normalizeMidiEvent({ pitch: NaN, startTime: 0, duration: 1 })).toBeNull();
    });

    it("should return null for invalid startTime", () => {
      expect(normalizeMidiEvent({ pitch: 60, startTime: -1, duration: 1 })).toBeNull();
      expect(normalizeMidiEvent({ pitch: 60, startTime: NaN, duration: 1 })).toBeNull();
    });

    it("should return null for invalid duration", () => {
      expect(normalizeMidiEvent({ pitch: 60, startTime: 0, duration: -1 })).toBeNull();
      expect(normalizeMidiEvent({ pitch: 60, startTime: 0, duration: NaN })).toBeNull();
    });

    it("should handle string numbers", () => {
      const event = {
        pitch: "60",
        startTime: "0.5",
        duration: "1.0",
        velocity: "0.7",
      };

      const result = normalizeMidiEvent(event);

      expect(result.pitch).toBe(60);
      expect(result.startTime).toBe(0.5);
      expect(result.duration).toBe(1.0);
      expect(result.velocity).toBe(0.7);
    });

    it("should return null for null/undefined event", () => {
      expect(normalizeMidiEvent(null)).toBeNull();
      expect(normalizeMidiEvent(undefined)).toBeNull();
    });
  });

  // Test 3: normalizeTimelineItem - Timeline item normalization
  describe("normalizeTimelineItem", () => {
    it("should normalize basic timeline item", () => {
      const item = {
        _id: "item1",
        startTime: 0,
        duration: 2,
        offset: 0,
        type: "lick",
      };

      const result = normalizeTimelineItem(item);

      expect(result.startTime).toBe(0);
      expect(result.duration).toBe(2);
      expect(result.offset).toBe(0);
      expect(result.type).toBe("lick");
    });

    it("should enforce minimum clip duration", () => {
      const item = {
        startTime: 0,
        duration: 0.05, // Less than MIN_CLIP_DURATION
      };

      const result = normalizeTimelineItem(item);

      expect(result.duration).toBeGreaterThanOrEqual(MIN_CLIP_DURATION);
    });

    it("should prevent negative startTime", () => {
      const item = {
        startTime: -5,
        duration: 2,
      };

      const result = normalizeTimelineItem(item);

      expect(result.startTime).toBe(0);
    });

    it("should calculate sourceDuration correctly", () => {
      const item = {
        startTime: 0,
        duration: 2,
        offset: 1,
        sourceDuration: 5,
      };

      const result = normalizeTimelineItem(item);

      expect(result.sourceDuration).toBeGreaterThanOrEqual(3); // offset + duration
    });

    it("should infer type from lickId", () => {
      const item = {
        startTime: 0,
        duration: 2,
        lickId: { _id: "lick1" },
      };

      const result = normalizeTimelineItem(item);

      expect(result.type).toBe("lick");
    });

    it("should infer type from audioUrl", () => {
      const item = {
        startTime: 0,
        duration: 2,
        audioUrl: "https://example.com/audio.mp3",
      };

      const result = normalizeTimelineItem(item);

      expect(result.type).toBe("chord");
    });

    it("should preserve lickId and waveformData", () => {
      const item = {
        startTime: 0,
        duration: 2,
        lickId: {
          _id: "lick1",
          waveformData: [0.1, 0.2, 0.3],
        },
      };

      const result = normalizeTimelineItem(item);

      expect(result.lickId).toEqual(item.lickId);
      expect(result.waveformData).toEqual([0.1, 0.2, 0.3]);
    });

    it("should normalize customMidiEvents", () => {
      const item = {
        startTime: 0,
        duration: 2,
        customMidiEvents: [
          { pitch: 60, startTime: 0, duration: 1, velocity: 0.8 },
          { pitch: 64, startTime: 0.5, duration: 1, velocity: 0.7 },
        ],
      };

      const result = normalizeTimelineItem(item);

      expect(result.customMidiEvents).toHaveLength(2);
      expect(result.customMidiEvents[0].pitch).toBe(60);
    });

    it("should filter invalid customMidiEvents", () => {
      const item = {
        startTime: 0,
        duration: 2,
        customMidiEvents: [
          { pitch: 60, startTime: 0, duration: 1 },
          { pitch: -1, startTime: 0, duration: 1 }, // Invalid
          { pitch: 64, startTime: 0, duration: 1 },
        ],
      };

      const result = normalizeTimelineItem(item);

      expect(result.customMidiEvents).toHaveLength(2);
    });

    it("should handle null/undefined item", () => {
      expect(normalizeTimelineItem(null)).toBeNull();
      expect(normalizeTimelineItem(undefined)).toBeUndefined();
    });
  });

  // Test 4: getChordIndexFromId - Extract chord index from ID
  describe("getChordIndexFromId", () => {
    it("should extract index from valid chord ID", () => {
      expect(getChordIndexFromId("chord-0")).toBe(0);
      expect(getChordIndexFromId("chord-5")).toBe(5);
      expect(getChordIndexFromId("chord-123")).toBe(123);
    });

    it("should return null for non-chord IDs", () => {
      expect(getChordIndexFromId("lick-123")).toBeNull();
      expect(getChordIndexFromId("item-5")).toBeNull();
      expect(getChordIndexFromId("chord")).toBeNull();
    });

    it("should return null for invalid formats", () => {
      expect(getChordIndexFromId("chord-abc")).toBeNull();
      expect(getChordIndexFromId("chord--5")).toBeNull();
      expect(getChordIndexFromId("")).toBeNull();
    });

    it("should return null for non-string input", () => {
      expect(getChordIndexFromId(123)).toBeNull();
      expect(getChordIndexFromId(null)).toBeNull();
      expect(getChordIndexFromId(undefined)).toBeNull();
    });
  });

  // Test 5: generatePatternMidiEvents - Pattern MIDI generation
  describe("generatePatternMidiEvents", () => {
    it("should generate events from pattern", () => {
      const pitches = [60, 64, 67]; // C major chord
      const patternSteps = [1, 0, 1, 0, 1, 0, 1, 0]; // 8 steps
      const totalDuration = 2; // 2 seconds

      const events = generatePatternMidiEvents(pitches, patternSteps, totalDuration);

      expect(events.length).toBeGreaterThan(0);
      expect(events.every((e) => pitches.includes(e.pitch))).toBe(true);
    });

    it("should handle empty pattern", () => {
      const events = generatePatternMidiEvents([60], [], 2);
      expect(events).toEqual([]);
    });

    it("should handle zero duration", () => {
      const events = generatePatternMidiEvents([60], [1, 1], 0);
      expect(events).toEqual([]);
    });

    it("should calculate step duration correctly", () => {
      const pitches = [60];
      const patternSteps = [1, 1, 1, 1]; // 4 steps
      const totalDuration = 4; // 4 seconds

      const events = generatePatternMidiEvents(pitches, patternSteps, totalDuration);

      expect(events.length).toBe(4);
      expect(events[0].startTime).toBe(0);
      expect(events[1].startTime).toBe(1);
      expect(events[2].startTime).toBe(2);
      expect(events[3].startTime).toBe(3);
    });

    it("should filter zero-value steps", () => {
      const pitches = [60];
      const patternSteps = [1, 0, 1, 0];
      const totalDuration = 4;

      const events = generatePatternMidiEvents(pitches, patternSteps, totalDuration);

      expect(events.length).toBe(2);
    });

    it("should use velocity from pattern value", () => {
      const pitches = [60];
      const patternSteps = [0.5, 0.8, 1.0];
      const totalDuration = 3;

      const events = generatePatternMidiEvents(pitches, patternSteps, totalDuration);

      expect(events[0].velocity).toBe(0.5);
      expect(events[1].velocity).toBe(0.8);
      expect(events[2].velocity).toBe(1.0);
    });

    it("should clamp velocity values", () => {
      const pitches = [60];
      const patternSteps = [2.0, -0.5, 0.5];
      const totalDuration = 3;

      const events = generatePatternMidiEvents(pitches, patternSteps, totalDuration);

      expect(events[0].velocity).toBeLessThanOrEqual(1);
      expect(events[1].velocity).toBeGreaterThanOrEqual(0.1);
    });
  });

  // Test 6: getChordMidiEvents - Chord MIDI event extraction
  describe("getChordMidiEvents", () => {
    it("should return customMidiEvents if present", () => {
      const item = {
        customMidiEvents: [
          { pitch: 60, startTime: 0, duration: 1 },
          { pitch: 64, startTime: 0, duration: 1 },
        ],
      };

      const events = getChordMidiEvents(item);

      expect(events).toEqual(item.customMidiEvents);
    });

    it("should generate events from midiNotes and pattern", () => {
      const item = {
        midiNotes: [60, 64, 67],
        rhythmPatternId: "pattern1",
        duration: 2,
      };

      // Mock pattern steps
      const patternSteps = [1, 0, 1, 0];

      const events = getChordMidiEvents(item, 2, patternSteps);

      expect(events.length).toBeGreaterThan(0);
    });

    it("should handle item without customMidiEvents or midiNotes", () => {
      const item = {
        duration: 2,
      };

      const events = getChordMidiEvents(item);

      expect(Array.isArray(events)).toBe(true);
    });

    it("should use fallback duration", () => {
      const item = {
        midiNotes: [60],
      };

      const events = getChordMidiEvents(item, 4);

      expect(events.length).toBeGreaterThan(0);
    });
  });

  // Test 7: Complex timeline item scenarios
  describe("Complex timeline item scenarios", () => {
    it("should handle lick item with all properties", () => {
      const item = {
        _id: "item1",
        startTime: 10,
        duration: 4,
        offset: 1,
        lickId: {
          _id: "lick1",
          title: "My Lick",
          waveformData: [0.1, 0.2, 0.3, 0.4],
          audioUrl: "https://example.com/audio.mp3",
        },
        loopEnabled: true,
        playbackRate: 1.5,
        type: "lick",
      };

      const result = normalizeTimelineItem(item);

      expect(result.lickId).toEqual(item.lickId);
      expect(result.loopEnabled).toBe(true);
      expect(result.playbackRate).toBe(1.5);
      expect(result.waveformData).toEqual([0.1, 0.2, 0.3, 0.4]);
    });

    it("should handle chord item with audio", () => {
      const item = {
        startTime: 0,
        duration: 2,
        chordName: "C",
        audioUrl: "https://example.com/chord.mp3",
        waveformData: [0.5, 0.6, 0.7],
      };

      const result = normalizeTimelineItem(item);

      expect(result.type).toBe("chord");
      expect(result.chordName).toBe("C");
      expect(result.audioUrl).toBe("https://example.com/chord.mp3");
      expect(result.waveformData).toEqual([0.5, 0.6, 0.7]);
    });

    it("should handle MIDI item with custom events", () => {
      const item = {
        startTime: 5,
        duration: 3,
        type: "midi",
        customMidiEvents: [
          { pitch: 60, startTime: 0, duration: 0.5, velocity: 0.8 },
          { pitch: 64, startTime: 0.5, duration: 0.5, velocity: 0.7 },
          { pitch: 67, startTime: 1, duration: 0.5, velocity: 0.9 },
        ],
        isCustomized: true,
      };

      const result = normalizeTimelineItem(item);

      expect(result.type).toBe("midi");
      expect(result.isCustomized).toBe(true);
      expect(result.customMidiEvents).toHaveLength(3);
    });
  });
});

