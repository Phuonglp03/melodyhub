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
  message,
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
import { getMyProfile } from "../services/user/profile";
import GuitarTabEditor from "./GuitarTabEditor";
import { updateLick } from "../services/user/lickService";

const { Title, Text, Paragraph } = Typography;

const LickDetail = ({
  lick,
  onLike,
  currentUserId = "current-user-id",
  currentUser = null,
  showPlayer = true,
  showComments = true,
  showSidebar = true,
  onTabNotationUpdate = () => {},
}) => {
  // Create audio ref for syncing player with tab notation
  const audioRef = useRef(null);
  const dispatch = useDispatch();
  const authUser = useSelector((s) => s.auth.user);
  const likeState = useSelector((s) => s.likes.byId[lick.lick_id]);
  const isLiked = likeState?.liked || false;
  const localLikesCount = likeState?.count ?? lick.likes_count;
  const [commentsCount, setCommentsCount] = useState(
    typeof lick.comments_count === "number"
      ? lick.comments_count
      : lick.commentsCount ?? 0
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [myProfile, setMyProfile] = useState(null);
  const [tabContent, setTabContent] = useState(
    lick?.tab_notation || lick?.tabNotation || ""
  );
  const [isEditingTab, setIsEditingTab] = useState(false);
  const [savingTab, setSavingTab] = useState(false);
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

  React.useEffect(() => {
    // Fetch current user's profile for displaying correct user info
    const loadProfile = async () => {
      try {
        const res = await getMyProfile();
        if (res?.success && res?.data?.user) {
          setMyProfile(res.data.user);
        }
      } catch (_) {
        // ignore - fallback to lick.creator below
      }
    };
    loadProfile();
  }, []);

  React.useEffect(() => {
    const resolvedTab = lick?.tab_notation || lick?.tabNotation || "";
    setTabContent(resolvedTab);
    setIsEditingTab(false);
  }, [lick?.lick_id, lick?.tab_notation, lick?.tabNotation]);

  const displayAvatar = myProfile?.avatarUrl || lick.creator?.avatar_url;
  const displayName =
    myProfile?.displayName ||
    myProfile?.username ||
    lick.creator?.username ||
    lick.creator?.display_name ||
    "Unknown User";

  const resolvedCurrentUserId =
    myProfile?.id ||
    authUser?.user?.id ||
    authUser?.id ||
    currentUser?.id ||
    currentUserId;
  const lickOwnerId =
    lick.creator?.user_id ||
    lick.userId ||
    lick.user_id ||
    lick.creator?._id ||
    null;
  const canEditTab =
    Boolean(resolvedCurrentUserId) &&
    Boolean(lickOwnerId) &&
    String(resolvedCurrentUserId) === String(lickOwnerId);

  const handleTabSave = async (newTab) => {
    if (!canEditTab) return;
    if (savingTab) {
      message.info("Tab notation update in progress");
      return;
    }

    setSavingTab(true);
    try {
      const response = await updateLick(lick.lick_id, { tabNotation: newTab });
      const updatedTab =
        response?.data?.tabNotation !== undefined
          ? response.data.tabNotation
          : newTab;
      setTabContent(updatedTab);
      onTabNotationUpdate(updatedTab);
      message.success("Tab notation updated successfully");
      setIsEditingTab(false);
    } catch (error) {
      console.error("Error updating tab notation:", error);
      message.error(error?.message || "Failed to update tab notation");
    } finally {
      setSavingTab(false);
    }
  };

  const handleLike = async () => {
    const tokenFromStorage = (() => {
      try {
        const stored = localStorage.getItem("user");
        return stored ? JSON.parse(stored)?.token : undefined;
      } catch {
        return undefined;
      }
    })();

    const userId = authUser?.user?.id || authUser?.id || currentUserId;
    const hasToken = Boolean(tokenFromStorage);
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
            backgroundColor: "#111827",
            border: "1px solid #1f2937",
            borderRadius: "12px",
            marginBottom: "24px",
          }}
          bodyStyle={{ padding: "24px" }}
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
            <Title
              level={2}
              style={{ color: "#f3f4f6", marginBottom: "12px", fontWeight: 600 }}
            >
              {lick.title}
            </Title>

            {(myProfile || lick.creator) && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: "20px",
                }}
              >
                {displayAvatar ? (
                  <Avatar
                    src={displayAvatar}
                    style={{ marginRight: "12px", border: "2px solid #1f2937" }}
                  />
                ) : null}
                <div>
                  <Text
                    style={{
                      color: "#e2e8f0",
                      display: "block",
                      fontWeight: "bold",
                    }}
                  >
                    {displayName}
                  </Text>
                  <Text style={{ color: "#94a3b8", fontSize: "12px" }}>
                    {formatDate(lick.created_at)}
                  </Text>
                </div>
              </div>
            )}

            {/* Stats */}
            <div
              style={{
                display: "flex",
                gap: "12px",
                marginBottom: "20px",
                flexWrap: "wrap",
              }}
            >
              <Button
                type="text"
                icon={<HeartOutlined />}
                onClick={handleLike}
                style={{
                  color: isLiked ? "#f87171" : "#cbd5f5",
                  backgroundColor: "transparent",
                }}
              >
                {localLikesCount} likes
              </Button>
              <Button
                type="text"
                icon={<CommentOutlined />}
                style={{ color: "#cbd5f5" }}
              >
                {commentsCount} comments
              </Button>
              <Button
                type="text"
                icon={<ShareAltOutlined />}
                style={{ color: "#cbd5f5" }}
              >
                Share
              </Button>
            </div>

            {/* Tags */}
            <div style={{ marginBottom: "16px" }}>
              {lick.tags.map((tag) => (
                <Tag
                  key={tag.tag_id}
                  style={{
                    marginBottom: "6px",
                    background: "rgba(14, 165, 233, 0.1)",
                    border: "1px solid rgba(14, 165, 233, 0.25)",
                    color: "#38bdf8",
                    borderRadius: "999px",
                    padding: "2px 10px",
                  }}
                >
                  #{tag.tag_name}
                </Tag>
              ))}
            </div>

            {/* Description */}
            {lick.description && (
              <Paragraph
                style={{ color: "#cbd5f5", marginBottom: "20px", lineHeight: 1.6 }}
              >
                {lick.description}
              </Paragraph>
            )}

            {/* Technical Info */}
            <Row gutter={[16, 16]}>
              <Col xs={12} sm={6}>
                <Text style={{ color: "#94a3b8", fontSize: "12px" }}>Key:</Text>
                <br />
                <Text style={{ color: "#e5e7eb" }}>{lick.key || "N/A"}</Text>
              </Col>
              <Col xs={12} sm={6}>
                <Text style={{ color: "#94a3b8", fontSize: "12px" }}>Tempo:</Text>
                <br />
                <Text style={{ color: "#e5e7eb" }}>{lick.tempo || "N/A"} BPM</Text>
              </Col>
              <Col xs={12} sm={6}>
                <Text style={{ color: "#94a3b8", fontSize: "12px" }}>
                  Difficulty:
                </Text>
                <br />
                <Text style={{ color: "#e5e7eb" }}>{lick.difficulty || "N/A"}</Text>
              </Col>
              <Col xs={12} sm={6}>
                <Text style={{ color: "#94a3b8", fontSize: "12px" }}>
                  Duration:
                </Text>
                <br />
                <Text style={{ color: "#e5e7eb" }}>{lick.duration || "N/A"}s</Text>
              </Col>
            </Row>
          </div>

          <Divider style={{ borderColor: "#1f2937" }} />

          {canEditTab && (
            <div style={{ marginBottom: "24px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "16px",
                  gap: "16px",
                }}
              >
                <Title
                  level={4}
                  style={{ color: "#e2e8f0", margin: 0, fontSize: "20px", fontWeight: 500 }}
                >
                  Tab Notation Editor
                </Title>
                <Button
                  type="primary"
                  ghost={!isEditingTab}
                  onClick={() => setIsEditingTab((prev) => !prev)}
                  disabled={savingTab}
                  style={{
                    borderColor: isEditingTab ? "#38bdf8" : "#1f2937",
                    background: isEditingTab ? "#38bdf8" : "transparent",
                    color: isEditingTab ? "#0f172a" : "#cbd5f5",
                  }}
                >
                  {isEditingTab ? "Close Editor" : "Edit Tab"}
                </Button>
              </div>
              {isEditingTab ? (
                <GuitarTabEditor
                  initialTab={tabContent}
                  onSave={handleTabSave}
                  tempo={lick.tempo || 120}
                />
              ) : (
                <div
                  style={{
                    backgroundColor: "#0b1623",
                    border: "1px solid #1f2937",
                    borderRadius: "10px",
                    padding: "18px",
                  }}
                >
                  {tabContent ? (
                    <GuitarTabNotation
                      tabData={tabContent}
                      tempo={lick.tempo || 120}
                      isEditable={false}
                      audioRef={audioRef}
                      audioDuration={lick.duration || 0}
                    />
                  ) : (
                    <Text style={{ color: "#7f8ea3" }}>
                      No tab notation available. Click "Edit Tab" to create
                      one.
                    </Text>
                  )}
                </div>
              )}
            </div>
          )}

          {showComments && (
            <div style={{ marginTop: "16px" }}>
              <CommentSection
                lickId={lick.lick_id}
                currentUser={{ id: currentUserId }}
                onCountChange={setCommentsCount}
              />
            </div>
          )}
        </Card>
      </Col>

      {/* Sidebar */}
      {showSidebar && (
        <Col xs={24} lg={8}>
          <Card
            title={canEditTab ? "Playback & Notes" : "Tab Notation"}
            style={{
              backgroundColor: "#0f172a",
              border: "1px solid #1f2937",
              borderRadius: "12px",
            }}
            headStyle={{
              color: "#e2e8f0",
              borderBottom: "1px solid #1f2937",
              background: "rgba(15, 22, 35, 0.6)",
            }}
            bodyStyle={{ padding: "24px" }}
          >
            <div style={{ color: "white" }}>
              {canEditTab ? (
                <div style={{ color: "#94a3b8", lineHeight: 1.6 }}>
                  <p style={{ marginBottom: "12px" }}>
                    Use the editor to update notes while listening. Save to
                    keep the preview in sync.
                  </p>
                  <Divider style={{ borderColor: "#1f2937" }} />
                  <p style={{ marginBottom: 0 }}>
                    Preview closes automatically when you switch back to
                    editing.
                  </p>
                </div>
              ) : (
                <div style={{ marginBottom: "0" }}>
                  {tabContent ? (
                    <GuitarTabNotation
                      tabData={tabContent}
                      tempo={lick.tempo || 120}
                      isEditable={false}
                      audioRef={audioRef}
                      audioDuration={lick.duration || 0}
                    />
                  ) : (
                    <div
                      style={{
                        backgroundColor: "#0b1623",
                        padding: "20px",
                        borderRadius: "10px",
                        textAlign: "center",
                      }}
                    >
                      <Text style={{ color: "#7f8ea3" }}>
                        No tab notation available
                      </Text>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        </Col>
      )}
    </Row>
  );
};

export default LickDetail;
