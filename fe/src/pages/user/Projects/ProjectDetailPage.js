import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  FaPlay,
  FaPause,
  FaStop,
  FaVolumeUp,
  FaVolumeMute,
  FaMusic,
  FaTrash,
  FaPlus,
  FaSearch,
  FaTimes,
} from "react-icons/fa";
import {
  getProjectById,
  updateProject,
  addLickToTimeline,
  updateTimelineItem,
  deleteTimelineItem,
  updateChordProgression as updateChordProgressionAPI,
  addTrack,
  updateTrack,
} from "../../../services/user/projectService";
import { getCommunityLicks } from "../../../services/user/lickService";
import { useSelector } from "react-redux";

const ProjectDetailPage = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);

  const [project, setProject] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);

  // UI State
  const [activeTab, setActiveTab] = useState("lick-library"); // "lick-library", "midi-editor", "instrument"
  const [selectedLick, setSelectedLick] = useState(null);
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [showLickLibrary, setShowLickLibrary] = useState(true);
  const [lickSearchTerm, setLickSearchTerm] = useState("");
  const [availableLicks, setAvailableLicks] = useState([]);
  const [loadingLicks, setLoadingLicks] = useState(false);

  // Chord progression
  const [chordProgression, setChordProgression] = useState([]);
  const [showChordLibrary, setShowChordLibrary] = useState(true);

  // Drag and drop
  const [draggedLick, setDraggedLick] = useState(null);
  const [dragOverTrack, setDragOverTrack] = useState(null);

  const timelineRef = useRef(null);
  const pixelsPerSecond = 50; // Scale for timeline

  // Common chords
  const commonChords = ["C", "G", "Am", "F", "Dm", "Em", "Gmaj7", "Am7", "Cmaj7", "Dm7"];

  useEffect(() => {
    fetchProject();
    fetchLicks();
  }, [projectId]);

  const fetchProject = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getProjectById(projectId);
      if (response.success) {
        setProject(response.data.project);
        setTracks(response.data.tracks || []);
        // Parse chord progression
        if (response.data.project.chordProgression) {
          try {
            const chords = JSON.parse(response.data.project.chordProgression);
            setChordProgression(chords);
          } catch {
            setChordProgression([]);
          }
        } else {
          setChordProgression([]);
        }
      } else {
        setError(response.message || "Failed to load project");
      }
    } catch (err) {
      console.error("Error fetching project:", err);
      setError(err.message || "Failed to load project");
    } finally {
      setLoading(false);
    }
  };

  const fetchLicks = async () => {
    try {
      setLoadingLicks(true);
      const response = await getCommunityLicks({
        search: lickSearchTerm,
        limit: 50,
      });
      if (response.success) {
        setAvailableLicks(response.data?.licks || []);
      }
    } catch (err) {
      console.error("Error fetching licks:", err);
    } finally {
      setLoadingLicks(false);
    }
  };

  useEffect(() => {
    if (lickSearchTerm !== null) {
      const timeout = setTimeout(() => {
        fetchLicks();
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [lickSearchTerm]);

  const handlePlay = () => {
    setIsPlaying(true);
    // TODO: Implement actual audio playback
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleStop = () => {
    setIsPlaying(false);
    setPlaybackPosition(0);
  };

  const saveChordProgression = async (chords) => {
    try {
      await updateChordProgressionAPI(projectId, chords);
    } catch (err) {
      console.error("Error updating chord progression:", err);
    }
  };

  const handleAddChord = (chord) => {
    const newProgression = [...chordProgression, chord];
    setChordProgression(newProgression);
    saveChordProgression(newProgression);
  };

  const handleRemoveChord = (index) => {
    const newProgression = chordProgression.filter((_, i) => i !== index);
    setChordProgression(newProgression);
    saveChordProgression(newProgression);
  };

  const handleDragStart = (lick) => {
    setDraggedLick(lick);
  };

  const handleDragOver = (e, trackId) => {
    e.preventDefault();
    setDragOverTrack(trackId);
  };

  const handleDrop = async (e, trackId, startTime) => {
    e.preventDefault();
    if (!draggedLick) return;

    try {
      const response = await addLickToTimeline(projectId, {
        trackId,
        lickId: draggedLick._id,
        startTime,
        duration: draggedLick.duration || 4, // Default 4 seconds
      });

      if (response.success) {
        fetchProject(); // Refresh project data
      }
    } catch (err) {
      console.error("Error adding lick to timeline:", err);
      setError(err.message || "Failed to add lick to timeline");
    } finally {
      setDraggedLick(null);
      setDragOverTrack(null);
    }
  };

  const handleDeleteTimelineItem = async (itemId) => {
    if (!window.confirm("Are you sure you want to remove this lick from the timeline?")) {
      return;
    }

    try {
      await deleteTimelineItem(projectId, itemId);
      fetchProject(); // Refresh
    } catch (err) {
      console.error("Error deleting timeline item:", err);
      setError(err.message || "Failed to delete timeline item");
    }
  };

  const handleAddTrack = async () => {
    const trackName = prompt("Enter track name:");
    if (!trackName) return;

    try {
      const response = await addTrack(projectId, { trackName });
      if (response.success) {
        fetchProject(); // Refresh
      }
    } catch (err) {
      console.error("Error adding track:", err);
      setError(err.message || "Failed to add track");
    }
  };

  const handleUpdateTrack = async (trackId, updates) => {
    try {
      await updateTrack(projectId, trackId, updates);
      fetchProject(); // Refresh
    } catch (err) {
      console.error("Error updating track:", err);
    }
  };

  const calculateTimelineWidth = () => {
    // Calculate based on max duration of items
    let maxTime = 32; // Default 32 seconds
    tracks.forEach((track) => {
      track.items?.forEach((item) => {
        const endTime = item.startTime + item.duration;
        if (endTime > maxTime) maxTime = endTime;
      });
    });
    return Math.max(maxTime * pixelsPerSecond, 800);
  };

  if (loading) {
    return (
      <div className="container-fluid py-4">
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "400px" }}>
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error && !project) {
    return (
      <div className="container-fluid py-4">
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
        <button className="btn btn-primary" onClick={() => navigate("/projects")}>
          Back to Projects
        </button>
      </div>
    );
  }

  if (!project) return null;

  const timelineWidth = calculateTimelineWidth();

  return (
    <div className="container-fluid p-0" style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Top Bar */}
      <div className="bg-dark text-white p-3 d-flex justify-content-between align-items-center">
        <div>
          <h5 className="mb-0">{project.title}</h5>
          <small className="text-muted">
            {new Date(project.createdAt).toLocaleDateString()}
          </small>
        </div>
        <div className="d-flex align-items-center gap-3">
          {/* Playback Controls */}
          <div className="d-flex align-items-center gap-2">
            {isPlaying ? (
              <button className="btn btn-sm btn-light" onClick={handlePause}>
                <FaPause />
              </button>
            ) : (
              <button className="btn btn-sm btn-light" onClick={handlePlay}>
                <FaPlay />
              </button>
            )}
            <button className="btn btn-sm btn-light" onClick={handleStop}>
              <FaStop />
            </button>
          </div>
          <div className="text-center">
            <div>{project.tempo || 120} BPM</div>
            <small className="text-muted">{project.timeSignature || "4/4"}</small>
          </div>
          <button
            className="btn btn-sm btn-outline-light"
            onClick={() => navigate("/projects")}
          >
            Back
          </button>
        </div>
      </div>

      <div className="flex-grow-1 d-flex" style={{ overflow: "hidden" }}>
        {/* Left Sidebar - Tracks */}
        <div
          className="bg-secondary text-white"
          style={{ width: "250px", overflowY: "auto", flexShrink: 0 }}
        >
          <div className="p-3 border-bottom">
            <button
              className="btn btn-sm btn-primary w-100"
              onClick={handleAddTrack}
            >
              <FaPlus className="me-2" />
              Add a track
            </button>
          </div>
          {tracks.map((track) => (
            <div
              key={track._id}
              className="p-3 border-bottom"
              onDragOver={(e) => handleDragOver(e, track._id)}
              onDrop={(e) => handleDrop(e, track._id, playbackPosition)}
              style={{
                backgroundColor: dragOverTrack === track._id ? "rgba(255,255,255,0.1)" : "transparent",
              }}
            >
              <div className="d-flex align-items-center justify-content-between mb-2">
                <strong>{track.trackName}</strong>
                <div>
                  <button
                    className={`btn btn-sm ${track.muted ? "btn-danger" : "btn-outline-light"}`}
                    onClick={() => handleUpdateTrack(track._id, { muted: !track.muted })}
                    title="Mute"
                  >
                    M
                  </button>
                  <button
                    className={`btn btn-sm ms-1 ${track.solo ? "btn-warning" : "btn-outline-light"}`}
                    onClick={() => handleUpdateTrack(track._id, { solo: !track.solo })}
                    title="Solo"
                  >
                    S
                  </button>
                </div>
              </div>
              <div className="d-flex align-items-center">
                <FaVolumeUp className="me-2" />
                <input
                  type="range"
                  className="form-range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={track.volume}
                  onChange={(e) =>
                    handleUpdateTrack(track._id, { volume: parseFloat(e.target.value) })
                  }
                  style={{ flex: 1 }}
                />
                <span className="ms-2" style={{ minWidth: "40px" }}>
                  {Math.round(track.volume * 100)}%
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Main Timeline Area */}
        <div className="flex-grow-1 d-flex flex-column" style={{ overflow: "auto" }}>
          {/* Chord Progression */}
          {showChordLibrary && (
            <div className="bg-light p-2 border-bottom">
              <div className="d-flex align-items-center mb-2">
                <strong className="me-3">Chord Progression:</strong>
                {chordProgression.map((chord, index) => (
                  <span
                    key={index}
                    className="badge bg-primary me-2 p-2"
                    style={{ cursor: "pointer" }}
                    onClick={() => handleRemoveChord(index)}
                  >
                    {chord} <FaTimes className="ms-1" />
                  </span>
                ))}
              </div>
              <div className="d-flex gap-2 flex-wrap">
                {commonChords.map((chord) => (
                  <button
                    key={chord}
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => handleAddChord(chord)}
                  >
                    {chord}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Timeline Grid */}
          <div
            ref={timelineRef}
            className="flex-grow-1 position-relative"
            style={{
              minHeight: "400px",
              backgroundImage:
                "repeating-linear-gradient(to right, #f0f0f0 0px, #f0f0f0 49px, #e0e0e0 50px)",
            }}
          >
            {/* Time Ruler */}
            <div
              className="position-sticky top-0 bg-white border-bottom"
              style={{ height: "30px", zIndex: 10 }}
            >
              {Array.from({ length: Math.ceil(timelineWidth / pixelsPerSecond) + 1 }).map(
                (_, i) => (
                  <div
                    key={i}
                    className="position-absolute border-start"
                    style={{
                      left: `${i * pixelsPerSecond}px`,
                      height: "100%",
                      paddingLeft: "4px",
                      fontSize: "10px",
                    }}
                  >
                    {i}
                  </div>
                )
              )}
            </div>

            {/* Track Lanes */}
            {tracks.map((track) => (
              <div
                key={track._id}
                className="border-bottom position-relative"
                style={{ minHeight: "100px" }}
                onDragOver={(e) => handleDragOver(e, track._id)}
                onDrop={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const startTime = Math.max(0, x / pixelsPerSecond);
                  handleDrop(e, track._id, startTime);
                }}
              >
                <div className="position-absolute" style={{ left: 0, top: 0, bottom: 0, width: "250px", backgroundColor: "#f8f9fa" }}>
                  <div className="p-2">
                    <strong>{track.trackName}</strong>
                  </div>
                </div>
                <div style={{ marginLeft: "250px", position: "relative", height: "100px" }}>
                  {track.items?.map((item) => (
                    <div
                      key={item._id}
                      className="position-absolute bg-primary text-white p-2 rounded"
                      style={{
                        left: `${item.startTime * pixelsPerSecond}px`,
                        width: `${item.duration * pixelsPerSecond}px`,
                        height: "80px",
                        cursor: "move",
                        overflow: "hidden",
                      }}
                      title={item.lickId?.title || "Lick"}
                    >
                      <div className="d-flex justify-content-between align-items-center h-100">
                        <div className="flex-grow-1">
                          <div className="fw-bold small">{item.lickId?.title || "Lick"}</div>
                          <div className="small opacity-75">
                            {item.startTime.toFixed(1)}s - {(item.startTime + item.duration).toFixed(1)}s
                          </div>
                        </div>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDeleteTimelineItem(item._id)}
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Drop Zone Hint */}
            {draggedLick && (
              <div
                className="position-fixed bg-info bg-opacity-25 border border-info"
                style={{
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  padding: "20px",
                  zIndex: 1000,
                  pointerEvents: "none",
                }}
              >
                Drag and drop a loop or audio/MIDI file here
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar - Lick Library */}
        {showLickLibrary && (
          <div
            className="bg-light border-start"
            style={{ width: "300px", overflowY: "auto", flexShrink: 0 }}
          >
            <div className="p-3 border-bottom">
              <div className="d-flex align-items-center mb-2">
                <strong>Lick Library</strong>
                <button
                  className="btn btn-sm btn-link ms-auto"
                  onClick={() => setShowLickLibrary(false)}
                >
                  <FaTimes />
                </button>
              </div>
              <div className="input-group input-group-sm">
                <span className="input-group-text">
                  <FaSearch />
                </span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search Licks..."
                  value={lickSearchTerm}
                  onChange={(e) => setLickSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {loadingLicks ? (
              <div className="text-center p-4">
                <div className="spinner-border spinner-border-sm" role="status" />
              </div>
            ) : (
              <div className="p-2">
                {availableLicks.map((lick) => (
                  <div
                    key={lick._id}
                    className="card mb-2"
                    draggable
                    onDragStart={() => handleDragStart(lick)}
                    style={{ cursor: "grab" }}
                  >
                    <div className="card-body p-2">
                      <div className="fw-bold small">{lick.title}</div>
                      <div className="small text-muted">
                        by {lick.userId?.displayName || lick.userId?.username || "Unknown"}
                      </div>
                      {lick.tags && lick.tags.length > 0 && (
                        <div className="mt-1">
                          {lick.tags.slice(0, 3).map((tag, idx) => (
                            <span key={idx} className="badge bg-secondary me-1 small">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Show Lick Library Button */}
        {!showLickLibrary && (
          <button
            className="btn btn-primary position-fixed"
            style={{ right: "20px", bottom: "20px", zIndex: 1000 }}
            onClick={() => setShowLickLibrary(true)}
          >
            <FaMusic /> Show Library
          </button>
        )}
      </div>

      {/* Bottom Panel - Tabs */}
      <div className="bg-dark text-white border-top">
        <div className="d-flex align-items-center p-2">
          <div className="btn-group me-3">
            <button
              className={`btn btn-sm ${activeTab === "instrument" ? "btn-primary" : "btn-outline-light"}`}
              onClick={() => setActiveTab("instrument")}
            >
              Instrument
            </button>
            <button
              className={`btn btn-sm ${activeTab === "midi-editor" ? "btn-primary" : "btn-outline-light"}`}
              onClick={() => setActiveTab("midi-editor")}
            >
              MIDI Editor
            </button>
            <button
              className={`btn btn-sm ${activeTab === "lick-library" ? "btn-primary" : "btn-outline-light"}`}
              onClick={() => setActiveTab("lick-library")}
            >
              Lick Library
            </button>
          </div>
          {activeTab === "lick-library" && (
            <>
              <div className="input-group input-group-sm" style={{ width: "200px" }}>
                <span className="input-group-text">
                  <FaSearch />
                </span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search Licks..."
                  value={lickSearchTerm}
                  onChange={(e) => setLickSearchTerm(e.target.value)}
                />
              </div>
              <div className="btn-group ms-2">
                <button className="btn btn-sm btn-outline-light">Genre</button>
                <button className="btn btn-sm btn-outline-light">Instrument</button>
                <button className="btn btn-sm btn-outline-light">Mood</button>
              </div>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="alert alert-danger m-3" role="alert">
          {error}
        </div>
      )}
    </div>
  );
};

export default ProjectDetailPage;

