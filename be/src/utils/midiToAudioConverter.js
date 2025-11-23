import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

/**
 * Convert MIDI file to audio (WAV/MP3)
 * @param {String} midiFilePath - Path to the MIDI file
 * @param {Object} options - Conversion options
 * @returns {Promise<Object>} - {filepath, filename, url, success}
 */
export const convertMIDIToAudio = async (midiFilePath, options = {}) => {
  try {
    const {
      outputFormat = 'wav', // 'wav' or 'mp3'
      outputDir = path.join(__dirname, '../../uploads/audio'),
      soundfontPath = null, // Optional: path to soundfont file
      sampleRate = 44100,
      bitrate = '192k',
    } = options;

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Check if MIDI file exists
    if (!fs.existsSync(midiFilePath)) {
      throw new Error(`MIDI file not found: ${midiFilePath}`);
    }

    // Generate output filename
    const midiBasename = path.basename(midiFilePath, path.extname(midiFilePath));
    const filename = `${midiBasename}.${outputFormat}`;
    const outputPath = path.join(outputDir, filename);

    return new Promise((resolve, reject) => {
      let command = ffmpeg(midiFilePath);

      // For MIDI to audio conversion, FFmpeg needs a synthesizer
      // We'll use the 'lavfi' filter with 'sine' as a fallback, or better yet,
      // use a proper MIDI synthesizer approach
      
      // Method 1: Use FFmpeg's built-in MIDI support (requires system MIDI synthesizer)
      // This works if the system has timidity, fluidsynth, or similar installed
      command
        .audioCodec(outputFormat === 'mp3' ? 'libmp3lame' : 'pcm_s16le')
        .audioFrequency(sampleRate)
        .audioBitrate(bitrate)
        .outputOptions([
          '-f', outputFormat,
          // Use lavfi to generate audio from MIDI (simpler approach)
          // Note: This is a workaround - ideally we'd use a proper soundfont
        ])
        .on('start', (commandLine) => {
          console.log('[MIDI Converter] FFmpeg command:', commandLine);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log(`[MIDI Converter] Processing: ${Math.round(progress.percent)}%`);
          }
        })
        .on('end', () => {
          console.log('[MIDI Converter] Conversion completed:', outputPath);
          resolve({
            filepath: outputPath,
            filename: filename,
            url: `/static/audio/${filename}`, // Assuming /static serves uploads/audio
            success: true,
          });
        })
        .on('error', (err) => {
          console.error('[MIDI Converter] FFmpeg error:', err);
          // If FFmpeg fails, try alternative method using tonejs-midi or generate audio directly
          reject(new Error(`MIDI to audio conversion failed: ${err.message}`));
        })
        .save(outputPath);
    });
  } catch (error) {
    console.error('[MIDI Converter] Error:', error);
    throw error;
  }
};

/**
 * Convert MIDI to audio using a JavaScript-based synthesizer (fallback method)
 * This generates audio directly from MIDI data without requiring system dependencies
 * @param {String} midiFilePath - Path to the MIDI file
 * @param {Object} options - Conversion options
 * @returns {Promise<Object>} - {filepath, filename, url, success}
 */
export const convertMIDIToAudioJS = async (midiFilePath, options = {}) => {
  try {
    const {
      outputFormat = 'wav',
      outputDir = path.join(__dirname, '../../uploads/audio'),
      sampleRate = 44100,
    } = options;

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Read MIDI file
    const midiData = fs.readFileSync(midiFilePath);
    
    // Parse MIDI file (simplified - you might want to use a proper MIDI parser)
    // For now, we'll use a simpler approach: generate audio from chord data directly
    // This is a placeholder - in production, you'd want to use a proper MIDI parser
    // like 'midi-parser-js' or '@tonejs/midi'
    
    // For now, return the MIDI file path and let the frontend handle it
    // Or use a service like timidity++ or fluidsynth via child process
    
    throw new Error('JavaScript-based MIDI conversion not yet implemented. Use system FFmpeg with MIDI synthesizer.');
  } catch (error) {
    console.error('[MIDI Converter JS] Error:', error);
    throw error;
  }
};

/**
 * Convert MIDI to audio using system command (fluidsynth or timidity)
 * This is the most reliable method if system tools are available
 * @param {String} midiFilePath - Path to the MIDI file
 * @param {Object} options - Conversion options
 * @returns {Promise<Object>} - {filepath, filename, url, success}
 */
export const convertMIDIToAudioSystem = async (midiFilePath, options = {}) => {
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    const {
      outputFormat = 'wav',
      outputDir = path.join(__dirname, '../../uploads/audio'),
      soundfontPath = process.env.SOUNDFONT_PATH || '/usr/share/sounds/sf2/FluidR3_GM.sf2', // Default soundfont path
      sampleRate = 44100,
    } = options;

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const midiBasename = path.basename(midiFilePath, path.extname(midiFilePath));
    const filename = `${midiBasename}.${outputFormat}`;
    const outputPath = path.join(outputDir, filename);

    // Check if soundfont exists (for fluidsynth)
    if (soundfontPath && !fs.existsSync(soundfontPath)) {
      console.warn(`[MIDI Converter] Soundfont not found at ${soundfontPath}, trying timidity...`);
    }

    // Try fluidsynth first (most common)
    if (soundfontPath && fs.existsSync(soundfontPath)) {
      try {
        // Use -ni flag to run non-interactively and -F for file output
        const fluidsynthCmd = `fluidsynth -ni -F "${outputPath}" -r ${sampleRate} "${soundfontPath}" "${midiFilePath}"`;
        const { stdout, stderr } = await execAsync(fluidsynthCmd, { timeout: 30000 });
        
        if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
          console.log('[MIDI Converter] Fluidsynth conversion successful');
          return {
            filepath: outputPath,
            filename: filename,
            url: `/static/audio/${filename}`,
            success: true,
          };
        } else {
          throw new Error('Fluidsynth produced empty output file');
        }
      } catch (fluidsynthError) {
        console.log('[MIDI Converter] Fluidsynth failed:', fluidsynthError.message);
        // Continue to try timidity
      }
    }
    
    // Fallback to timidity (doesn't require soundfont path)
    try {
      const timidityCmd = `timidity "${midiFilePath}" -Ow -o "${outputPath}"`;
      const { stdout, stderr } = await execAsync(timidityCmd, { timeout: 30000 });
      
      if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
        console.log('[MIDI Converter] TiMidity++ conversion successful');
        return {
          filepath: outputPath,
          filename: filename,
          url: `/static/audio/${filename}`,
          success: true,
        };
      } else {
        throw new Error('TiMidity++ produced empty output file');
      }
    } catch (timidityError) {
      // Check if it's a "command not found" error
      if (timidityError.code === 127 || timidityError.message.includes('not found')) {
        throw new Error('TiMidity++ is not installed. Please install it to convert MIDI to audio.');
      }
      throw new Error(`TiMidity++ conversion failed: ${timidityError.message}`);
    }
  } catch (error) {
    console.error('[MIDI Converter System] Error:', error);
    throw error;
  }
};

/**
 * Main conversion function that tries system commands
 * @param {String} midiFilePath - Path to the MIDI file
 * @param {Object} options - Conversion options
 * @returns {Promise<Object>} - {filepath, filename, url, success}
 */
export const convertMIDIToAudioAuto = async (midiFilePath, options = {}) => {
  // Try system command (fluidsynth or timidity)
  // These are the most reliable methods for MIDI to audio conversion
  try {
    return await convertMIDIToAudioSystem(midiFilePath, options);
  } catch (systemError) {
    console.error('[MIDI Converter] System command failed:', systemError.message);
    
    // Provide helpful error message
    const errorMessage = `
MIDI to audio conversion failed. Please install one of the following:
  
  Option 1 (Recommended): Install FluidSynth
    - Ubuntu/Debian: sudo apt-get install fluidsynth
    - macOS: brew install fluidsynth
    - Windows: Download from https://www.fluidsynth.org/
  
  Option 2: Install TiMidity++
    - Ubuntu/Debian: sudo apt-get install timidity
    - macOS: brew install timidity
    - Windows: Download from https://sourceforge.net/projects/timidity/
  
  After installation, ensure a soundfont is available:
    - FluidSynth: Place .sf2 file and set soundfontPath in options
    - TiMidity++: Configure in timidity.cfg
  
  Error details: ${systemError.message}
    `;
    
    throw new Error(errorMessage);
  }
};

