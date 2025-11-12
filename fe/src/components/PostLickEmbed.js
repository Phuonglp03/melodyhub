import React, { useEffect, useMemo, useState } from "react";
import { Card, Avatar, Typography, Space, Spin } from "antd";
import { useNavigate } from "react-router-dom";
import { getLickById } from "../services/user/lickService";

const { Text } = Typography;

const LICK_CACHE = new Map();

const buildBars = (waveform = []) => {
  if (Array.isArray(waveform) && waveform.length > 0) {
    return waveform.slice(0, 80);
  }
  return Array.from({ length: 60 }, () => Math.random() * 0.8 + 0.2);
};

const PostLickEmbed = ({ lickId, url }) => {
  const navigate = useNavigate();
  const [data, setData] = useState(() =>
    lickId && LICK_CACHE.has(lickId) ? LICK_CACHE.get(lickId) : null
  );
  const [loading, setLoading] = useState(!data && Boolean(lickId));
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    if (!lickId) return undefined;
    if (LICK_CACHE.has(lickId)) return undefined;

    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await getLickById(lickId);
        if (!active) return;
        if (res?.success && res.data) {
          LICK_CACHE.set(lickId, res.data);
          setData(res.data);
          setError(null);
        } else {
          setError("Lick unavailable");
        }
      } catch (err) {
        if (!active) return;
        setError(err?.message || "Unable to load lick");
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
  }, [lickId]);

  const bars = useMemo(
    () => buildBars(data?.waveform_data || data?.waveformData),
    [data]
  );

  const handleNavigate = () => {
    if (lickId) {
      navigate(`/licks/${lickId}`);
    } else if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

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
              src={data?.creator?.avatar_url}
              style={{ background: "#7c3aed", fontWeight: 600 }}
            >
              {data?.creator?.display_name?.[0] ||
                data?.creator?.username?.[0] ||
                (data?.title || "L")[0]}
            </Avatar>
            <div>
              <Text style={{ color: "#fff", fontWeight: 600, fontSize: 16 }}>
                {data?.title || "Untitled Lick"}
              </Text>
              <div style={{ color: "#9ca3af", fontSize: 13 }}>
                {data?.creator?.display_name ||
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
              }}
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
          </div>
          <div style={{ color: "#9ca3af", fontSize: 12 }}>
            Tempo:{" "}
            {data?.tempo ? `${Math.round(Number(data.tempo))} BPM` : "N/A"} ·{" "}
            Key: {data?.key || "Unknown"}
          </div>
        </Space>
      )}
    </Card>
  );
};

export default PostLickEmbed;
