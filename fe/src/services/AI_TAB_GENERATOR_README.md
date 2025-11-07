# AI Tab Generator - Documentation

> **🎉 NEW: Major Algorithm Improvements!**  
> The AI tab generator has been significantly upgraded with better pitch detection, onset detection, note filtering, and context-aware fret mapping. See [AI_TAB_IMPROVEMENTS.md](./AI_TAB_IMPROVEMENTS.md) for full details on the enhancements.

## Overview

The AI Tab Generator is a feature that automatically transcribes guitar audio into tablature notation, similar to Songster's AI-powered transcription. It analyzes uploaded audio files (up to 15 seconds) and generates guitar tabs with automatic note detection.

**Algorithm Version:** 2.0 (Enhanced - October 2025)

## Features

✅ **Automatic Tab Generation**
- Analyzes audio files and detects guitar notes
- Converts notes to fret positions on the guitar
- Generates standard tab notation format

✅ **Automatic Tempo Detection**
- Detects BPM from audio
- Uses beat detection algorithm
- Provides reasonable tempo range (60-200 BPM)

✅ **Automatic Key Detection**
- Analyzes pitch histogram
- Detects the musical key
- Supports major keys

✅ **Real-time Progress Updates**
- Shows analysis progress
- Displays confidence metrics
- Reports detected notes count

## How It Works

### 1. Audio Analysis
```javascript
const audioFeatures = await extractAudioFeatures(audioFile);
```
- Decodes audio using Web Audio API
- Extracts channel data for analysis
- Validates duration (max 15 seconds)

### 2. Onset Detection
```javascript
const onsets = detectOnsets(channelData, sampleRate);
```
- Detects energy changes to identify note starts
- Uses adaptive thresholding (1.5x energy increase)
- Filters out transients shorter than 100ms

### 3. Pitch Detection (Enhanced)
```javascript
const pitchResult = detectPitch(chunk, sampleRate);
```
- Uses improved autocorrelation with harmonic rejection
- Processes audio in 50ms chunks with 25ms overlap (50% overlap)
- Applies bandpass filter for guitar frequency range (80-1200 Hz)
- Returns pitch with confidence score
- Parabolic interpolation for sub-sample accuracy

### 4. Note Mapping & Filtering (Enhanced)
```javascript
const note = frequencyToNote(frequency);
const position = noteToGuitarFret(note, previousPosition);
const filteredNotes = filterAndGroupNotes(rawNotes);
```
- Converts frequency to musical note
- **Context-aware fret mapping** - remembers previous position
- Groups nearby detections into single notes (temporal clustering)
- Filters out notes shorter than 100ms
- Selects most comfortable/playable positions:
  - Prefers frets 0-12 (first position)
  - Favors middle strings (G, D)
  - Maintains position continuity (stays within 4 frets when possible)
  - Applies ergonomic scoring for playability

### 5. Tab Generation
```javascript
const tab = convertNotesToTab(notes, duration);
```
- Organizes notes by string
- Formats as standard tab notation with improved spacing
- Groups into measures (2 seconds per measure)
- Handles multi-digit frets properly (10-22)
- Prevents note overlap and collision

## Configuration

### Enable/Disable Demo Mode

In `fe/src/services/aiTabGenerator.js`:

```javascript
const AI_CONFIG = {
  USE_MOCK_GENERATION: false, // true = demo mode, false = real analysis
  MAX_DURATION: 15, // seconds
  SAMPLE_RATE: 44100,
  MIN_FREQUENCY: 80, // E2 (lowest guitar note)
  MAX_FREQUENCY: 1200, // ~D#6 (high guitar range)
  
  // Enhanced detection parameters
  CHUNK_SIZE: 0.05, // 50ms analysis windows
  HOP_SIZE: 0.025, // 25ms hop (50% overlap)
  MIN_NOTE_DURATION: 0.1, // Minimum 100ms to be considered a note
  RMS_THRESHOLD: 0.015, // Minimum signal strength
  CORRELATION_THRESHOLD: 0.85, // Minimum pitch confidence
  ONSET_THRESHOLD: 1.5, // Energy increase factor for note onset
};
```

**Demo Mode (USE_MOCK_GENERATION: true)**
- Generates random tab patterns
- No actual audio analysis
- Fast for testing UI
- Shows sample results

**Real Mode (USE_MOCK_GENERATION: false)**
- Actual pitch detection
- Real audio analysis
- CPU-intensive
- More accurate results

## Usage

### In Upload Page

1. **Upload an audio file** (MP3, WAV, OGG)
2. **Click "Generate Tab"** button
3. **Wait for AI analysis** (progress shown)
4. **View generated tab** in Visual Editor
5. **Edit if needed** using the tab editor

### Programmatic Usage

```javascript
import { 
  generateTabFromAudio, 
  detectTempo, 
  detectKey 
} from '../services/aiTabGenerator';

// Generate tab
const result = await generateTabFromAudio(audioFile);
console.log(result.tab); // Tab notation string
console.log(result.metadata); // Duration, notes, confidence

// Detect tempo
const bpm = await detectTempo(audioFile);
console.log(`Tempo: ${bpm} BPM`);

// Detect key
const key = await detectKey(audioFile);
console.log(`Key: ${key}`);
```

## Algorithm Details

### Pitch Detection (Autocorrelation)

The algorithm uses **autocorrelation** to detect the fundamental frequency:

1. Calculate RMS (Root Mean Square) for noise gate
2. Autocorrelate signal with time-shifted version
3. Find peaks in correlation function
4. Convert peak offset to frequency: `f = sampleRate / offset`

### Note-to-Fret Mapping

Standard guitar tuning (E-A-D-G-B-e):
```javascript
const stringTunings = [
  { string: "e", baseMidi: 64 }, // E4
  { string: "B", baseMidi: 59 }, // B3
  { string: "G", baseMidi: 55 }, // G3
  { string: "D", baseMidi: 50 }, // D3
  { string: "A", baseMidi: 45 }, // A2
  { string: "E", baseMidi: 40 }, // E2
];
```

Fret calculation: `fret = detectedMidi - stringBaseMidi`

## Accuracy & Limitations

### ✅ Works Best With:
- Clean, solo guitar recordings
- Single notes (not chords)
- Clear, loud audio
- Studio recordings
- 15 seconds or less

### ⚠️ Challenges:
- Polyphonic music (multiple notes)
- Heavy distortion
- Background noise
- Drums/bass interference
- Very fast passages

### 🎯 Expected Accuracy:
- **Demo Mode**: N/A (random patterns)
- **Real Mode**: 
  - Clean solo: ~70-85% accuracy
  - With background: ~50-70% accuracy
  - Complex polyphonic: ~30-50% accuracy

## Future Enhancements

### Planned Features:
- 🎸 **ML Model Integration**
  - Use pre-trained models (TensorFlow.js)
  - Spotify's Basic Pitch integration
  - Custom trained model for guitar
  
- 🎵 **Polyphonic Detection**
  - Multi-note chord detection
  - Separate tracks analysis
  
- 📊 **Improved Tempo Detection**
  - More sophisticated beat tracking
  - Tempo variation detection
  
- 🎼 **Standard Notation**
  - Generate sheet music alongside tabs
  - Rhythm notation
  
- 🔊 **Audio Preprocessing**
  - Noise reduction
  - Instrument isolation
  - EQ optimization for transcription

### Integration Options:

1. **Spotify Basic Pitch** (Free, Open Source)
   - TensorFlow-based
   - Good polyphonic detection
   - [GitHub](https://github.com/spotify/basic-pitch)

2. **Essentia.js** (Free)
   - Audio analysis library
   - Pitch, beat, key detection
   - [Essentia.js](https://mtg.github.io/essentia.js/)

3. **AnthemScore API** (Paid)
   - Commercial solution
   - High accuracy
   - [AnthemScore](https://www.lunaverus.com/)

4. **Custom ML Model**
   - Train with guitar recordings
   - Host on backend
   - Use TensorFlow/PyTorch

## Performance Optimization

### Client-Side (Current)
- Processing: ~2-5 seconds for 15s audio
- Memory: ~50MB peak
- No server costs

### Server-Side (Alternative)
- Processing: ~1-2 seconds for 15s audio
- Better accuracy with Python ML models
- Scalability with cloud infrastructure

## Testing

### Test Cases

```javascript
// Test 1: Single note
const singleNoteAudio = new File([...], 'single-note.mp3');
const result = await generateTabFromAudio(singleNoteAudio);
// Expected: Simple tab with detected note

// Test 2: Scale
const scaleAudio = new File([...], 'c-major-scale.mp3');
const result = await generateTabFromAudio(scaleAudio);
// Expected: Sequential notes on one string

// Test 3: Riff
const riffAudio = new File([...], 'blues-riff.mp3');
const result = await generateTabFromAudio(riffAudio);
// Expected: Multi-string pattern
```

## Troubleshooting

### Common Issues

**Issue**: "Audio duration exceeds 15s limit"
- **Solution**: Trim audio before upload

**Issue**: "No notes detected"
- **Solution**: 
  - Increase input volume
  - Remove background noise
  - Use cleaner recording

**Issue**: "Incorrect notes detected"
- **Solution**:
  - Manually edit in Visual Editor
  - Try different audio quality
  - Check tuning of guitar

**Issue**: "Slow performance"
- **Solution**:
  - Enable demo mode for testing
  - Use shorter audio clips
  - Close other browser tabs

## API Reference

### `generateTabFromAudio(audioFile, options)`
Generates tab notation from audio file.

**Parameters:**
- `audioFile` (File): Audio file to analyze
- `options` (Object): Optional configuration

**Returns:**
```javascript
{
  success: boolean,
  tab: string, // Tab notation
  metadata: {
    duration: number,
    notesDetected: number,
    confidence: number
  }
}
```

### `detectTempo(audioFile)`
Detects tempo/BPM from audio.

**Returns:** `number` - BPM (60-200)

### `detectKey(audioFile)`
Detects musical key from audio.

**Returns:** `string` - Key (e.g., "C Major", "G Major")

## Credits

- **Pitch Detection**: Autocorrelation algorithm
- **UI Design**: Songster-inspired interface
- **Framework**: React + Web Audio API
- **Icons**: React Icons

## License

This feature is part of MelodyHub and follows the project's license.

---

**Note**: For production use with high accuracy requirements, consider integrating with professional transcription APIs like AnthemScore or Spotify's Basic Pitch.

