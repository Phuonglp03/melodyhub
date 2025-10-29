import React, { useRef } from "react";
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
  EyeOutlined,
  ShareAltOutlined,
} from "@ant-design/icons";
import LickPlayer from "./LickPlayer";
import GuitarTabNotation from "./GuitarTabNotation";

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
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("vi-VN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
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
                onClick={() => onLike && onLike(lick.lick_id)}
                style={{ color: "#ff4757" }}
              >
                {lick.likes_count} likes
              </Button>
              <Button
                type="text"
                icon={<EyeOutlined />}
                style={{ color: "#3742fa" }}
              >
                {lick.comments_count} comments
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
                <div
                  style={{
                    backgroundColor: "#1a1a1a",
                    padding: "8px",
                    borderRadius: "4px",
                    marginTop: "8px",
                    display: "flex",
                    alignItems: "center",
                    gap: "2px",
                    height: "40px",
                  }}
                >
                  {lick.waveform_data &&
                    lick.waveform_data.map((amplitude, index) => (
                      <div
                        key={index}
                        style={{
                          height: `${amplitude * 100}%`,
                          backgroundColor: "#ff6b35",
                          width: "3px",
                          borderRadius: "1px",
                        }}
                      />
                    ))}
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
