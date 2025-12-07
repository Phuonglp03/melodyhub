import React, { useEffect, useMemo, useState, useRef } from "react";
import { Card, Avatar, Typography, Space, Spin, Button } from "antd";
import { PlayCircleOutlined, PauseCircleOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { getProjectById } from "../services/user/projectService";

const { Text } = Typography;

const PROJECT_CACHE = new Map();

const buildBars = (waveform = []) => {
  if (Array.isArray(waveform) && waveform.length > 0) {
    return waveform.slice(0, 80);
  }
  return Array.from({ length: 60 }, () => Math.random() * 0.8 + 0.2);
};

const PostProjectEmbed = ({ projectId, url }) => {
  const navigate = useNavigate();
  const [data, setData] = useState(() =>
    projectId && PROJECT_CACHE.has(projectId) ? PROJECT_CACHE.get(projectId) : null
  );
  const [loading, setLoading] = useState(!data && Boolean(projectId));
  const [error, setError] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const audioRef = useRef(null);

  useEffect(() => {
    let active = true;
    if (!projectId) return undefined;
    
    // If data is already cached, set it
    if (PROJECT_CACHE.has(projectId)) {
      const cachedData = PROJECT_CACHE.get(projectId);
      setData(cachedData);
      if (cachedData.audioUrl) {
        setAudioUrl(cachedData.audioUrl);
      }
      return undefined;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await getProjectById(projectId);
        if (!active) return;
        if (res?.success && res.data) {
          PROJECT_CACHE.set(projectId, res.data);
          setData(res.data);
          setError(null);
          // Set audio URL if available
          if (res.data.audioUrl) {
            setAudioUrl(res.data.audioUrl);
          }
        } else {
          setError("Project unavailable");
        }
      } catch (err) {
        if (!active) return;
        setError(err?.message || "Unable to load project");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      active = false;
    };
  }, [projectId]);

  const bars = useMemo(
    () => buildBars(data?.waveformData || data?.waveform_data),
    [data]
  );

  const handleNavigate = () => {
    if (projectId) {
      navigate(`/projects/${projectId}`);
    } else if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const handlePlayPause = async (e) => {
    e.stopPropagation(); // Prevent navigation when clicking play button
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      if (audioUrl && !audioRef.current.src) {
        audioRef.current.src = audioUrl;
      }
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch((error) => {
          console.error("Error playing audio:", error);
        });
    }
  };

  const handleWaveformClick = (e) => {
    e.stopPropagation(); // Prevent navigation when clicking waveform
    handlePlayPause(e);
  };

  useEffect(() => {
    if (audioRef.current && audioUrl) {
      audioRef.current.src = audioUrl;
    }
  }, [audioUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => setIsPlaying(false);
    const handlePause = () => setIsPlaying(false);
    const handlePlay = () => setIsPlaying(true);

    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("play", handlePlay);

    return () => {
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("play", handlePlay);
    };
  }, []);

  return (
    <Card
      bordered={false}
      onClick={handleNavigate}
      style={{
        background: "#111",
        borderRadius: 12,
        border: "1px solid #1f1f1f",
        cursor: "pointer",
      }}
      bodyStyle={{ padding: 16 }}
    >
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        preload="metadata"
        onError={(e) => {
          console.error("Audio error:", e);
        }}
      />
      {loading && (
        <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
          <Spin />
        </div>
      )}
      {!loading && error && (
        <Text type="secondary" style={{ color: "#9ca3af" }}>
          {error}
        </Text>
      )}
      {!loading && !error && data && (
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Space size={12}>
            <Avatar
              size={44}
              src={data?.creatorId?.avatarUrl || data?.creator?.avatarUrl}
              style={{ background: "#7c3aed", fontWeight: 600 }}
            >
              {data?.creatorId?.displayName?.[0] ||
                data?.creatorId?.username?.[0] ||
                data?.creator?.displayName?.[0] ||
                data?.creator?.username?.[0] ||
                (data?.title || "P")[0]}
            </Avatar>
            <div>
              <Text style={{ color: "#fff", fontWeight: 600, fontSize: 16 }}>
                {data?.title || "Untitled Project"}
              </Text>
              <div style={{ color: "#9ca3af", fontSize: 13 }}>
                {data?.creatorId?.displayName ||
                  data?.creatorId?.username ||
                  data?.creator?.displayName ||
                  data?.creator?.username ||
                  "Unknown artist"}
              </div>
            </div>
          </Space>
          <div
            style={{
              position: "relative",
              height: 120,
              background: "#181818",
              borderRadius: 10,
              overflow: "hidden",
              padding: "12px 16px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 2,
                height: "100%",
                cursor: "pointer",
              }}
              onClick={handleWaveformClick}
            >
              {bars.map((height, idx) => (
                <div
                  key={idx}
                  style={{
                    width: 4,
                    height: `${Math.max(6, height * 90)}px`,
                    background: "#fb923c",
                    borderRadius: 2,
                    flexShrink: 0,
                  }}
                />
              ))}
            </div>
            {projectId && audioUrl && (
              <Button
                type="text"
                icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                onClick={handlePlayPause}
                style={{
                  position: "absolute",
                  right: 14,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#fb923c",
                  fontSize: 24,
                  width: 32,
                  height: 32,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(0, 0, 0, 0.5)",
                  border: "none",
                }}
              />
            )}
            {!projectId && (
              <div
                style={{
                  position: "absolute",
                  right: 14,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background: "#fb923c",
                }}
              />
            )}
          </div>
          <div style={{ color: "#9ca3af", fontSize: 12 }}>
            {data?.audioDuration
              ? `Duration: ${data.audioDuration.toFixed(1)}s`
              : "Exported Project"}
          </div>
        </Space>
      )}
    </Card>
  );
};

export default PostProjectEmbed;


