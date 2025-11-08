import React, { useState, useRef, useEffect } from "react";
import { Button, Slider, Typography, Row, Col } from "antd";
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  SoundOutlined,
  MutedOutlined,
} from "@ant-design/icons";
import { playLickAudio } from "../services/user/lickService";
import { getMyProfile } from "../services/user/profile";

const { Text } = Typography;

const LickPlayer = ({
  lick,
  onTimeUpdate,
  style = {},
  showWaveform = true,
  showControls = true,
  usePlayEndpoint = false, // Optional: use the new play endpoint
  userId = null, // Optional: for tracking plays
  audioRef: externalAudioRef = null, // Optional: external audio ref for tab sync
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(lick?.duration || 0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState(lick?.audio_url || "");
  const [myProfile, setMyProfile] = useState(null);

  const internalAudioRef = useRef(null);
  const audioRef = externalAudioRef || internalAudioRef;

  useEffect(() => {
    const loadAudio = async () => {
      if (lick?.lick_id && usePlayEndpoint) {
        // Use the play endpoint to get the audio URL
        try {
          const response = await playLickAudio(lick.lick_id, userId);
          if (response.success && response.data.audio_url) {
            setAudioUrl(response.data.audio_url);
            if (audioRef?.current) {
              // Force reload by resetting the src
              audioRef.current.pause();
              audioRef.current.load();
              audioRef.current.src =
                response.data.audio_url + `?t=${Date.now()}`; // Cache bust
            }
          }
        } catch (error) {
          console.error("Error loading audio from play endpoint:", error);
          // Fallback to direct URL if available
          if (lick?.audio_url) {
            setAudioUrl(lick.audio_url);
            if (audioRef?.current) {
              audioRef.current.pause();
              audioRef.current.load();
              audioRef.current.src = lick.audio_url + `?t=${Date.now()}`; // Cache bust
            }
          }
        }
      } else if (lick?.audio_url && audioRef?.current) {
        // Use direct audio URL with cache busting
        setAudioUrl(lick.audio_url);
        audioRef.current.pause();
        audioRef.current.load();
        audioRef.current.src = lick.audio_url + `?t=${Date.now()}`; // Cache bust
      }

      setDuration(lick?.duration || 0);
      setIsPlaying(false); // Reset playing state when lick changes
      setCurrentTime(0); // Reset time
    };

    loadAudio();
  }, [lick, usePlayEndpoint, userId, audioRef]);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await getMyProfile();
        if (res?.success && res?.data?.user) {
          setMyProfile(res.data.user);
        }
      } catch (_) {
        // ignore
      }
    };
    loadProfile();
  }, []);

  const displayName =
    myProfile?.displayName ||
    myProfile?.username ||
    lick?.creator?.username ||
    lick?.creator?.display_name ||
    "Unknown User";

  const displayAvatar = myProfile?.avatarUrl || lick?.creator?.avatar_url;

  const handlePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      setIsLoading(true);
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          setIsLoading(false);
        })
        .catch((error) => {
          console.error("Error playing audio:", error);
          setIsLoading(false);
        });
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const time = audioRef.current.currentTime;
      setCurrentTime(time);
      if (onTimeUpdate) {
        onTimeUpdate(time);
      }
    }
  };

  const handleSeek = (value) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value;
      setCurrentTime(value);
    }
  };

  const handleVolumeChange = (value) => {
    if (audioRef.current) {
      audioRef.current.volume = value;
      setVolume(value);
      setIsMuted(value === 0);
    }
  };

  const handleMute = () => {
    if (audioRef.current) {
      if (isMuted) {
        audioRef.current.volume = volume;
        setIsMuted(false);
      } else {
        audioRef.current.volume = 0;
        setIsMuted(true);
      }
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const progress = duration > 0 ? currentTime / duration : 0;

  const renderWaveform = () => {
    if (!showWaveform || !lick?.waveform_data) return null;

    return (
      <div
        style={{
          height: "60px",
          backgroundColor: "#1a1a1a",
          borderRadius: "4px",
          padding: "8px",
          marginBottom: "12px",
          display: "flex",
          alignItems: "center",
          gap: "2px",
        }}
      >
        {lick.waveform_data.map((amplitude, index) => {
          const barProgress = index / lick.waveform_data.length;
          const isPlayed = barProgress <= progress;
          return (
            <div
              key={index}
              style={{
                height: `${amplitude * 100}%`,
                backgroundColor: isPlayed ? "#ff6b35" : "#666",
                width: "4px",
                borderRadius: "2px",
                transition: "background-color 0.2s, opacity 0.2s",
                opacity: isPlayed ? 1 : 0.7 + amplitude * 0.3,
              }}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div
      style={{
        backgroundColor: "#2a2a2a",
        padding: "16px",
        borderRadius: "8px",
        border: "1px solid #333",
        ...style,
      }}
    >
      {/* Audio Element */}
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => setDuration(audioRef.current.duration)}
        onEnded={() => setIsPlaying(false)}
        onError={(e) => {
          console.error("Audio error:", e);
          setIsLoading(false);
        }}
        preload="metadata"
      />

      {/* Waveform */}
      {renderWaveform()}

      {/* Player Controls */}
      {showControls && (
        <div>
          {/* Main Controls */}
          <Row gutter={[16, 8]} align="middle" style={{ marginBottom: "12px" }}>
            <Col>
              <Button
                type="primary"
                shape="circle"
                icon={
                  isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />
                }
                size="large"
                onClick={handlePlayPause}
                loading={isLoading}
                style={{
                  backgroundColor: "#ff6b35",
                  borderColor: "#ff6b35",
                  width: "48px",
                  height: "48px",
                }}
              />
            </Col>

            <Col flex={1}>
              <div style={{ marginBottom: "4px" }}>
                <Text style={{ color: "#ccc", fontSize: "12px" }}>
                  {formatTime(currentTime)} / {formatTime(duration)}
                </Text>
              </div>
              <Slider
                min={0}
                max={duration}
                value={currentTime}
                onChange={handleSeek}
                tooltip={{ formatter: (value) => formatTime(value) }}
                style={{ margin: 0 }}
              />
            </Col>

            <Col>
              <Button
                type="text"
                icon={isMuted ? <MutedOutlined /> : <SoundOutlined />}
                onClick={handleMute}
                style={{ color: "#ccc" }}
              />
            </Col>
          </Row>

          {/* Volume Control */}
          <Row align="middle" gutter={8}>
            <Col>
              <Text style={{ color: "#ccc", fontSize: "12px" }}>Volume:</Text>
            </Col>
            <Col flex={1}>
              <Slider
                min={0}
                max={1}
                step={0.1}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                style={{ margin: 0 }}
              />
            </Col>
          </Row>
        </div>
      )}

      {/* Lick Info */}
      {lick && (
        <div
          style={{
            marginTop: "12px",
            paddingTop: "12px",
            borderTop: "1px solid #333",
          }}
        >
          <Text
            style={{ color: "white", fontWeight: "bold", display: "block" }}
          >
            {lick.title}
          </Text>
          <Text style={{ color: "#ccc", fontSize: "12px" }}>
            by {displayName} • {lick.duration || 0}s • {lick.tempo || "N/A"} BPM
          </Text>
        </div>
      )}
    </div>
  );
};

export default LickPlayer;
