import React, { useRef, useState } from "react";
import {
  Card,
  Tag,
  Avatar,
  Typography,
  Row,
  Col,
  Button,
  Divider,
  Spin,
} from "antd";
import {
  HeartOutlined,
  CommentOutlined,
  ShareAltOutlined,
} from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import { setLikeState, toggleLikeLocal } from "../redux/likesSlice";
import { toggleLickLike } from "../services/user/lickService";
// Use Redux auth state rather than helper for user id
import LickPlayer from "./LickPlayer";
import GuitarTabNotation from "./GuitarTabNotation";
import CommentSection from "./CommentSection";

const { Title, Text, Paragraph } = Typography;

const LickDetail = ({
  lick,
  onLike,
  currentUserId = "current-user-id",
  currentUser = null,
  showPlayer = true,
  showComments = true,
  showSidebar = true,
}) => {
  // Create audio ref for syncing player with tab notation
  const audioRef = useRef(null);
  const dispatch = useDispatch();
  const authUser = useSelector((s) => s.auth.user);
  const likeState = useSelector((s) => s.likes.byId[lick.lick_id]);
  const isLiked = likeState?.liked || false;
  const localLikesCount = likeState?.count ?? lick.likes_count;
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("vi-VN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  React.useEffect(() => {
    if (!likeState) {
      dispatch(
        setLikeState({
          id: lick.lick_id,
          liked: false,
          count: lick.likes_count,
        })
      );
    }
  }, [dispatch, likeState, lick.lick_id, lick.likes_count]);

  const handleLike = async () => {
    const userId = authUser?.user?.id || authUser?.id || currentUserId;
    const hasToken = Boolean(authUser?.token);
    if (!userId || !hasToken || userId === "current-user-id") {
      alert("You need to be logged in to like licks.");
      return;
    }
    dispatch(toggleLikeLocal({ id: lick.lick_id }));
    try {
      const res = await toggleLickLike(lick.lick_id, userId);
      if (res.success && typeof res.data?.liked === "boolean") {
        if (res.data.liked !== isLiked) {
          dispatch(toggleLikeLocal({ id: lick.lick_id }));
        }
      }
      if (onLike) onLike(lick.lick_id);
    } catch (e) {
      dispatch(toggleLikeLocal({ id: lick.lick_id }));
      console.error("Error toggling lick like:", e);
    }
  };

  if (!lick) {
    return (
      <div style={{ textAlign: "center", padding: "50px" }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <Row gutter={[24, 24]}>
      {/* Main Content */}
      <Col xs={24} lg={showSidebar ? 16 : 24}>
        <Card
          style={{
            backgroundColor: "#2a2a2a",
            border: "1px solid #333",
            borderRadius: "8px",
            marginBottom: "24px",
          }}
        >
          {/* Audio Player */}
          {showPlayer && (
            <div style={{ marginBottom: "24px" }}>
              <LickPlayer
                lick={lick}
                style={{ marginBottom: "16px" }}
                audioRef={audioRef}
                onPlayStateChange={setIsPlaying}
                onProgress={setProgress}
              />
            </div>
          )}

          {/* Lick Info */}
          <div style={{ marginBottom: "24px" }}>
            <Title level={2} style={{ color: "white", marginBottom: "8px" }}>
              {lick.title}
            </Title>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "16px",
              }}
            >
              <Avatar
                src={lick.creator.avatar_url}
                style={{ marginRight: "8px" }}
              />
              <div>
                <Text
                  style={{
                    color: "white",
                    display: "block",
                    fontWeight: "bold",
                  }}
                >
                  {lick.creator.display_name}
                </Text>
                <Text style={{ color: "#ccc", fontSize: "12px" }}>
                  {formatDate(lick.created_at)}
                </Text>
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: "flex", gap: "24px", marginBottom: "16px" }}>
              <Button
                type="text"
                icon={<HeartOutlined />}
                onClick={handleLike}
                style={{ color: isLiked ? "#ff4757" : "#fff" }}
              >
                {localLikesCount} likes
              </Button>
              <Button
                type="text"
                icon={<CommentOutlined />}
                style={{ color: "#3742fa" }}
              >
                {typeof lick.comments_count === "number"
                  ? lick.comments_count
                  : lick.commentsCount ?? 0}{" "}
                comments
              </Button>
              <Button
                type="text"
                icon={<ShareAltOutlined />}
                style={{ color: "#2ed573" }}
              >
                Share
              </Button>
            </div>

            {/* Tags */}
            <div style={{ marginBottom: "16px" }}>
              {lick.tags.map((tag) => (
                <Tag
                  key={tag.tag_id}
                  color="orange"
                  style={{ marginBottom: "4px" }}
                >
                  #{tag.tag_name}
                </Tag>
              ))}
            </div>

            {/* Description */}
            {lick.description && (
              <Paragraph style={{ color: "#ccc", marginBottom: "16px" }}>
                {lick.description}
              </Paragraph>
            )}

            {/* Technical Info */}
            <Row gutter={[16, 16]}>
              <Col xs={12} sm={6}>
                <Text style={{ color: "#ccc", fontSize: "12px" }}>Key:</Text>
                <br />
                <Text style={{ color: "white" }}>{lick.key || "N/A"}</Text>
              </Col>
              <Col xs={12} sm={6}>
                <Text style={{ color: "#ccc", fontSize: "12px" }}>Tempo:</Text>
                <br />
                <Text style={{ color: "white" }}>
                  {lick.tempo || "N/A"} BPM
                </Text>
              </Col>
              <Col xs={12} sm={6}>
                <Text style={{ color: "#ccc", fontSize: "12px" }}>
                  Difficulty:
                </Text>
                <br />
                <Text style={{ color: "white" }}>
                  {lick.difficulty || "N/A"}
                </Text>
              </Col>
              <Col xs={12} sm={6}>
                <Text style={{ color: "#ccc", fontSize: "12px" }}>
                  Duration:
                </Text>
                <br />
                <Text style={{ color: "white" }}>
                  {lick.duration || "N/A"}s
                </Text>
              </Col>
            </Row>
          </div>

          <Divider style={{ borderColor: "#333" }} />

          {showComments && (
            <div style={{ marginTop: "16px" }}>
              <CommentSection
                lickId={lick.lick_id}
                currentUser={{ id: currentUserId }}
              />
            </div>
          )}
        </Card>
      </Col>

      {/* Sidebar */}
      {showSidebar && (
        <Col xs={24} lg={8}>
          <Card
            title="Thông tin chi tiết"
            style={{
              backgroundColor: "#2a2a2a",
              border: "1px solid #333",
              borderRadius: "8px",
            }}
          >
            <div style={{ color: "white" }}>
              <div style={{ marginBottom: "16px" }}>
                {lick.tab_notation || lick.tabNotation ? (
                  <GuitarTabNotation
                    tabData={lick.tab_notation || lick.tabNotation}
                    tempo={lick.tempo || 120}
                    isEditable={false}
                    audioRef={audioRef}
                    audioDuration={lick.duration || 0}
                  />
                ) : (
                  <div
                    style={{
                      backgroundColor: "#1a1a1a",
                      padding: "20px",
                      borderRadius: "8px",
                      textAlign: "center",
                    }}
                  >
                    <Text style={{ color: "#666" }}>
                      No tab notation available
                    </Text>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: "16px" }}>
                <Text style={{ color: "#ccc", fontSize: "12px" }}>
                  Waveform Data:
                </Text>
                {/* New: Match LickCard.js waveform visualization */}
                <div className="relative h-28 bg-gradient-to-b from-orange-800 to-orange-900 rounded-lg overflow-hidden mt-2">
                  {lick.waveform_data && lick.waveform_data.length > 0 ? (
                    <div className="flex items-center justify-center h-full px-4">
                      <div className="flex items-center justify-center space-x-0.5 h-full w-full">
                        {lick.waveform_data.map((amplitude, index) => {
                          const barProgress = index / lick.waveform_data.length;
                          const isPlayed = isPlaying && barProgress <= progress;
                          return (
                            <div
                              key={index}
                              className="w-1 transition-all duration-100"
                              style={{
                                backgroundColor: isPlayed
                                  ? "#fbbf24"
                                  : "#fdba74",
                                height: `${Math.max(amplitude * 100, 2)}%`,
                                opacity: isPlayed ? 1 : 0.7 + amplitude * 0.3,
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <span className="text-orange-300 opacity-30 text-sm">
                        No waveform data
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <Text style={{ color: "#ccc", fontSize: "12px" }}>
                  Featured:
                </Text>
                <br />
                <Text
                  style={{ color: lick.is_featured ? "#2ed573" : "#ff4757" }}
                >
                  {lick.is_featured ? "Yes" : "No"}
                </Text>
              </div>
            </div>
          </Card>
        </Col>
      )}
    </Row>
  );
};

export default LickDetail;
