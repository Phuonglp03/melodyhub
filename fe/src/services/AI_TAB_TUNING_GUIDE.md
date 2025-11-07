# AI Tab Generator - Threshold Tuning Guide

## Quick Reference: Current Settings

```javascript
const AI_CONFIG = {
  RMS_THRESHOLD: 0.005,          // Signal strength (lower = more sensitive)
  CORRELATION_THRESHOLD: 0.6,    // Pitch confidence (lower = more detections)
  MIN_NOTE_DURATION: 0.08,       // Minimum note length in seconds
  ONSET_THRESHOLD: 1.3,          // Energy increase for note start
};
```

---

## Understanding the Thresholds

### 1. **RMS_THRESHOLD** (Signal Strength)
**Current:** `0.005` (Very Sensitive)

- **What it does:** Minimum volume level to consider a sound as audio signal
- **Lower value** = More sensitive, detects quieter sounds (more noise)
- **Higher value** = Less sensitive, only detects louder sounds (fewer false positives)

**Tuning Guide:**
- `0.001` - Ultra sensitive (use for very quiet recordings)
- `0.005` - **Current** - High sensitivity (good for normal recordings)
- `0.01` - Medium sensitivity (use for noisy environments)
- `0.02` - Low sensitivity (use for loud, clean recordings only)

---

### 2. **CORRELATION_THRESHOLD** (Pitch Confidence)
**Current:** `0.6` (Moderate)

- **What it does:** How confident the algorithm must be about a detected pitch
- **Lower value** = Accepts more uncertain pitches (more notes, some wrong)
- **Higher value** = Only accepts very confident pitches (fewer notes, more accurate)

**Tuning Guide:**
- `0.4` - Very permissive (use if getting "no notes detected")
- `0.6` - **Current** - Balanced (good for most audio)
- `0.75` - Strict (use for very clean recordings)
- `0.85` - Very strict (use for high-quality studio recordings)

**⚠️ Most Important Setting:** This has the biggest impact on detection rate.

---

### 3. **MIN_NOTE_DURATION** (Note Length)
**Current:** `0.08` seconds (80ms)

- **What it does:** Minimum time a note must be held to be included
- **Lower value** = Catches faster notes (more noise from transients)
- **Higher value** = Only catches sustained notes (misses fast playing)

**Tuning Guide:**
- `0.05` - Very fast (use for shredding/fast playing)
- `0.08` - **Current** - Balanced (good for normal playing)
- `0.10` - Slower (use for legato/sustained notes)
- `0.15` - Very slow (use for very slow melodies)

---

### 4. **ONSET_THRESHOLD** (Note Attack Detection)
**Current:** `1.3` (Moderate)

- **What it does:** Energy increase required to detect a new note start
- **Lower value** = Detects more note starts (can split sustained notes)
- **Higher value** = Only detects strong attacks (misses soft notes)

**Tuning Guide:**
- `1.1` - Very sensitive (use for soft playing)
- `1.3` - **Current** - Balanced
- `1.5` - Standard (use for normal playing)
- `2.0` - Strict (use for heavy palm-muted playing)

---

## Common Problems & Solutions

### Problem: "Could not detect any guitar notes"

**Solution 1:** Lower `CORRELATION_THRESHOLD`
```javascript
CORRELATION_THRESHOLD: 0.4,  // Very permissive
```

**Solution 2:** Lower `RMS_THRESHOLD`
```javascript
RMS_THRESHOLD: 0.002,  // More sensitive to quiet audio
```

**Solution 3:** Check console logs
- Open browser DevTools (F12) → Console
- Look for: `"Pitch detection: X pitches detected, Y valid guitar notes"`
- If pitches detected but no valid notes → lower `CORRELATION_THRESHOLD`
- If no pitches detected → lower `RMS_THRESHOLD`

---

### Problem: "Too many wrong notes / noise"

**Solution 1:** Raise `CORRELATION_THRESHOLD`
```javascript
CORRELATION_THRESHOLD: 0.75,  // More strict
```

**Solution 2:** Raise `MIN_NOTE_DURATION`
```javascript
MIN_NOTE_DURATION: 0.12,  // Filter out very short notes
```

**Solution 3:** Raise `RMS_THRESHOLD`
```javascript
RMS_THRESHOLD: 0.01,  // Ignore quieter sounds
```

---

### Problem: "Missing fast notes"

**Solution:** Lower `MIN_NOTE_DURATION`
```javascript
MIN_NOTE_DURATION: 0.05,  // 50ms minimum
```

---

### Problem: "Sustained notes split into multiple notes"

**Solution:** Raise `ONSET_THRESHOLD`
```javascript
ONSET_THRESHOLD: 1.8,  // Require stronger attack
```

---

## Recommended Presets

### Preset 1: **High Quality Studio Recording**
```javascript
RMS_THRESHOLD: 0.01,
CORRELATION_THRESHOLD: 0.8,
MIN_NOTE_DURATION: 0.1,
ONSET_THRESHOLD: 1.5,
```
Best for: Clean, professional recordings with minimal noise

---

### Preset 2: **Normal Quality / Default** (CURRENT)
```javascript
RMS_THRESHOLD: 0.005,
CORRELATION_THRESHOLD: 0.6,
MIN_NOTE_DURATION: 0.08,
ONSET_THRESHOLD: 1.3,
```
Best for: Most recordings, balanced between accuracy and sensitivity

---

### Preset 3: **Low Quality / Noisy Recording**
```javascript
RMS_THRESHOLD: 0.002,
CORRELATION_THRESHOLD: 0.4,
MIN_NOTE_DURATION: 0.06,
ONSET_THRESHOLD: 1.1,
```
Best for: Phone recordings, noisy environments, quiet audio

---

### Preset 4: **Fast Shredding / Speed Playing**
```javascript
RMS_THRESHOLD: 0.005,
CORRELATION_THRESHOLD: 0.65,
MIN_NOTE_DURATION: 0.04,  // Very short notes
ONSET_THRESHOLD: 1.2,
```
Best for: Fast guitar solos, sweep picking, rapid notes

---

### Preset 5: **Slow Melody / Legato**
```javascript
RMS_THRESHOLD: 0.008,
CORRELATION_THRESHOLD: 0.7,
MIN_NOTE_DURATION: 0.15,  // Longer sustained notes
ONSET_THRESHOLD: 1.6,
```
Best for: Slow ballads, blues licks, sustained notes

---

## How to Change Settings

1. Open `fe/src/services/aiTabGenerator.js`
2. Find the `AI_CONFIG` object at the top
3. Adjust the values
4. Save the file
5. Reload the page (Ctrl+R)
6. Try generating tab again

---

## Debugging Tips

### 1. Check Browser Console
Open DevTools (F12) → Console tab to see:
- "Analyzing audio with pitch detection..."
- "Pitch detection: X pitches detected, Y valid guitar notes"
- "Filtered to X distinct notes"

### 2. Understand the Numbers
- **Many pitches, few valid notes** → Lower `CORRELATION_THRESHOLD`
- **No pitches at all** → Lower `RMS_THRESHOLD`
- **Too many notes** → Raise `MIN_NOTE_DURATION` or `CORRELATION_THRESHOLD`

### 3. Test with Different Audio
- Start with a simple, clean recording (single notes, no chords)
- Try humming or whistling (pure tone, easy to detect)
- Gradually test more complex audio

---

## Advanced: Frequency Range

You can also adjust the frequency range to focus on specific guitar ranges:

```javascript
MIN_FREQUENCY: 80,    // E2 (lowest guitar note - 6th string open)
MAX_FREQUENCY: 1200,  // ~D#6 (high notes on 1st string)
```

**Adjustments:**
- **Bass guitar:** `MIN_FREQUENCY: 40` (E1)
- **High register only:** `MIN_FREQUENCY: 200`
- **Drop tuning:** Lower `MIN_FREQUENCY` to 60-70

---

## When to Use Demo Mode

If detection is still not working:

```javascript
USE_MOCK_GENERATION: true,  // Generate sample tabs
```

This will create mock tabs without analyzing audio - useful for:
- Testing the UI
- Checking tab formatting
- Demonstrating features

**Remember to set it back to `false` for real detection!**

---

## Summary: Balancing Act

```
More Detections ←→ More Accuracy
(More noise)        (Miss some notes)

↓ Lower thresholds  ↑ Raise thresholds
↓ Shorter duration  ↑ Longer duration
↓ Lower confidence  ↑ Higher confidence
```

**Goal:** Find the sweet spot where you get:
- ✅ Most of the actual notes
- ✅ Minimal false positives
- ✅ Playable, accurate tabs

Start with the default preset and adjust based on your audio quality!

---

**Last Updated:** 2025-10-28  
**Current Version:** 2.0 (Balanced Preset)




