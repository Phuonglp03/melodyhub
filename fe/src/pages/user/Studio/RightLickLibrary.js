import React, { useState, useEffect, useMemo, useRef } from "react";
import { FaSearch, FaFilter } from "react-icons/fa";
import { getCommunityLicks } from "../../../services/user/lickService";
import LickCard from "./LickCard";

const normalizeLick = (raw) => {
  if (!raw) return null;
  const id = raw._id || raw.id;
  const title = raw.title || raw.name || "Untitled Lick";
  const duration = Number(raw.duration || raw.length || 2);
  return {
    id,
    _id: id,
    title,
    key: raw.key || "C",
    style: raw.style || raw.genre || "Swing",
    duration,
    durationLabel: duration ? `${duration.toFixed(1)}s` : "",
    waveformData: raw.waveformData || raw.waveform_data || null,
    audioUrl:
      raw.audioUrl ||
      raw.audio_url ||
      raw.previewUrl ||
      raw.preview_url ||
      null,
    searchText: `${title} ${raw.key || ""} ${raw.style || ""}`.toLowerCase(),
    original: raw,
  };
};

export default function RightLickLibrary({ initialLicks = [] }) {
  const [licks, setLicks] = useState(
    initialLicks.map((lick) => normalizeLick(lick)).filter(Boolean)
  );
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(!initialLicks.length);
  const [error, setError] = useState(null);
  const [currentPreview, setCurrentPreview] = useState(null);
  const audioRef = useRef(null);

  useEffect(() => {
    if (initialLicks.length) {
      setLicks(initialLicks.map((lick) => normalizeLick(lick)).filter(Boolean));
      setLoading(false);
    }
  }, [initialLicks]);

  useEffect(() => {
    fetchLicks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchLicks = async () => {
    try {
      if (!licks.length) {
        setLoading(true);
      }
      setError(null);
      const response = await getCommunityLicks({
        search: "",
        limit: 30,
        sortBy: "newest",
      });
      const payload =
        response?.data?.licks ||
        response?.data?.items ||
        response?.data ||
        response?.licks ||
        response?.items ||
        [];
      if (Array.isArray(payload) && payload.length) {
        setLicks(payload.map((lick) => normalizeLick(lick)).filter(Boolean));
      } else if (!initialLicks.length) {
        setLicks([]);
      }
    } catch (error) {
      console.error("Failed to fetch licks:", error);
      setError("Unable to load licks right now.");
      if (!initialLicks.length) {
        setLicks([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredLicks = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return licks;
    return licks.filter((lick) => lick.searchText.includes(query));
  }, [licks, search]);

  const handlePreview = async (lick) => {
    if (!lick.audioUrl) return;

    if (currentPreview === lick.audioUrl) {
      audioRef.current?.pause();
      audioRef.current = null;
      setCurrentPreview(null);
      return;
    }

    try {
      audioRef.current?.pause();
      const audio = new Audio(lick.audioUrl);
      audioRef.current = audio;
      setCurrentPreview(lick.audioUrl);
      audio.onended = () => setCurrentPreview(null);
      await audio.play();
    } catch (previewError) {
      console.error("Failed to preview lick audio", previewError);
      setCurrentPreview(null);
    }
  };

  return (
    <div className="w-80 h-full flex flex-col bg-black border-l border-gray-900">
      <div className="p-4 border-b border-gray-900 bg-gray-950/60 backdrop-blur">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[11px] uppercase tracking-[0.2em] text-gray-500">
            Lick Vault
          </h3>
          <span className="text-[10px] bg-gray-850 text-gray-300 px-2 py-0.5 rounded-full">
            {licks.length}
          </span>
        </div>
        <div className="relative group">
          <FaSearch
            size={12}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-orange-400 transition-colors"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by key, style..."
            className="w-full bg-gray-950 border border-gray-850 rounded-lg py-2 pl-8 pr-8 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 transition-colors"
          />
          <FaFilter
            size={12}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading && (
          <div className="text-gray-500 text-center py-8 text-sm">
            Loading...
          </div>
        )}
        {error && !loading && (
          <div className="text-red-400 text-center py-8 text-sm">{error}</div>
        )}
        {!loading && !error && filteredLicks.length === 0 && (
          <div className="text-center py-12 text-xs text-gray-500 opacity-70">
            No licks found
          </div>
        )}
        {!loading &&
          !error &&
          filteredLicks.map((lick, idx) => (
            <LickCard
              key={lick._id || lick.id || `lick-${idx}`}
              lick={lick}
              onTogglePlay={handlePreview}
              isPlaying={currentPreview === lick.audioUrl}
            />
          ))}
      </div>
    </div>
  );
}
