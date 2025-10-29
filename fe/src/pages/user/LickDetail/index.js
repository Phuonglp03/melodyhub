import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button, Spin, Empty, message } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import LickDetail from "../../../components/LickDetail";
import {
  getLickById,
  toggleLickLike,
} from "../../../services/user/lickService";

const LickDetailPage = () => {
  const navigate = useNavigate();
  const { lickId } = useParams();

  const [lick, setLick] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [likesCount, setLikesCount] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getLickById(lickId);
      if (res.success) {
        setLick(res.data);
        setLikesCount(res.data.likes_count ?? 0);
      } else {
        setError("Failed to load lick");
      }
    } catch (e) {
      setError(e.message || "Failed to load lick");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (lickId) fetchData();
  }, [lickId]);

  const handleLike = async (id) => {
    try {
      // For now, optimistically update UI
      setLikesCount((c) => (typeof c === "number" ? c + 1 : 1));
      await toggleLickLike(id, null);
      // No need to refetch immediately; rely on optimistic update
    } catch (e) {
      message.error("Failed to like lick");
      // Revert optimistic update on failure
      setLikesCount((c) => (typeof c === "number" && c > 0 ? c - 1 : 0));
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "50px" }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error || !lick) {
    return (
      <div style={{ textAlign: "center", padding: "50px" }}>
        <Empty description="Lick not found" />
        <Button
          onClick={() => navigate("/licks")}
          style={{ marginTop: "16px" }}
        >
          Back
        </Button>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "20px",
        paddingTop: "80px",
        backgroundColor: "#1a1a1a",
        minHeight: "100vh",
        color: "white",
      }}
    >
      {/* Back Button */}
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate("/licks")}
        style={{ marginBottom: "20px" }}
      >
        Quay lại
      </Button>

      <LickDetail
        lick={{ ...lick, likes_count: likesCount ?? lick.likes_count }}
        onLike={handleLike}
        showPlayer={true}
        showComments={false}
        showSidebar={true}
      />
    </div>
  );
};

export default LickDetailPage;
