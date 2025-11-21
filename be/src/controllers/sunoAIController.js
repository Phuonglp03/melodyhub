// Helper function to call Suno AI API
const callSunoAPI = async (prompt, duration = 30) => {
  const apiKey = process.env.SUNO_API_KEY;
  
  if (!apiKey) {
    throw new Error("SUNO_API_KEY not configured in environment");
  }

  // Call Suno AI to generate audio
  const response = await fetch('https://api.suno.ai/v1/generate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt,
      duration: Math.min(duration, 30), // Max 30 seconds
      make_instrumental: true,
      model: 'chirp-v3'
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Suno API error: ${error.message || 'Unknown error'}`);
  }

  return response.json();
};

// Helper to poll Suno for completion
const waitForSunoGeneration = async (generationId, maxAttempts = 30) => {
  const apiKey = process.env.SUNO_API_KEY;
  
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(`https://api.suno.ai/v1/generate/${generationId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    
    const data = await response.json();
    
    if (data.status === 'complete') {
      return data;
    } else if (data.status === 'failed') {
      throw new Error('Suno generation failed');
    }
    
    // Wait 2 seconds before next poll
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  throw new Error('Suno generation timeout');
};

// Generate AI Backing Track with Suno
export const generateAIBackingTrack = async (req, res) => {
  try {
    const { projectId } = req.params;
    const {
      chords,
      instrument,
      style,
      tempo,
      key,
      duration
    } = req.body;
    const userId = req.userId;

    // Validate inputs
    if (!chords || !Array.isArray(chords) || chords.length === 0) {
      return res.status(400).json({
        success: false,
        message: "chords array is required"
      });
    }

    // Verify project access
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found"
      });
    }

    const isOwner = project.creatorId.toString() === userId;
    const collaborator = await ProjectCollaborator.findOne({
      projectId: project._id,
      userId: new mongoose.Types.ObjectId(userId),
    });

    if (!isOwner && !collaborator) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this project"
      });
    }

    // Find or create backing track
    let backingTrack = await ProjectTrack.findOne({
      projectId: project._id,
      trackType: "backing"
    });

    if (!backingTrack) {
      backingTrack = new ProjectTrack({
        projectId: project._id,
        trackName: "AI Backing Track",
        trackOrder: 0,
        trackType: "backing",
        volume: 1.0,
        pan: 0.0,
        muted: false,
        solo: false,
      });
      await backingTrack.save();
    }

    // Build intelligent prompt for Suno
    const chordNames = chords.map(c => c.chordName || c).join(', ');
    const instrumentName = instrument || "Piano";
    const musicStyle = style || "Jazz";
    const bpm = tempo || project.tempo || 120;
    const musicalKey = key || project.key || "C Major";

    const prompt = `Backing track: ${instrumentName} playing chord progression ${chordNames} in ${musicalKey} at ${bpm}BPM. ${musicStyle} style. Clean chords only, no melody, no vocals. Professional studio quality. Instrumental only.`;

    console.log("Generating AI backing track with prompt:", prompt);

    // Call Suno AI
    const generationResponse = await callSunoAPI(prompt, duration || 30);
    console.log("Suno generation started:", generationResponse.id);

    // Poll for completion
    const audioData = await waitForSunoGeneration(generationResponse.id);
    console.log("Suno generation complete:", audioData.audio_url);

    // Create timeline item with the generated audio
    const timelineItem = new ProjectTimelineItem({
      trackId: backingTrack._id,
      userId,
      startTime: 0, // Place at beginning
      duration: audioData.duration || duration || 30,
      offset: 0,
      type: "lick", // Store as audio lick
      audioUrl: audioData.audio_url,
      loopEnabled: false,
      playbackRate: 1,
      // Store metadata
      aiGenerated: true,
      aiMetadata: {
        chords: chordNames,
        instrument: instrumentName,
        style: musicStyle,
        tempo: bpm,
        key: musicalKey,
        provider: "suno"
      }
    });

    await timelineItem.save();

    res.status(201).json({
      success: true,
      message: "AI backing track generated successfully",
      data: {
        timelineItem,
        audio_url: audioData.audio_url,
        duration: audioData.duration
      }
    });

  } catch (error) {
    console.error("Error generating AI backing track:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate AI backing track",
      error: error.message
    });
  }
};
