// fe/src/components/ProjectLickLibrary.js
// Lick library sidebar for ProjectDetailPage (inspired by Studio's RightLickLibrary)
import React, { useState, useEffect, useMemo, useRef } from "react";
import { FaSearch, FaFilter, FaPlay, FaPause, FaGripVertical } from "react-icons/fa";
import { getCommunityLicks } from "../services/user/lickService";
import { useDrag } from "react-dnd";

const normalizeLick = (raw) => {
  if (!raw) return null;
  const id = raw._id || raw.id;
  const title = raw.title || raw.name || "Untitled Lick";
  const duration = Number(raw.duration || raw.length || 2);
  const bpm = Number(raw.bpm || raw.tempo || raw.speed || 0);
  return {
    id,
    _id: id,
    title,
    key: raw.key || "C",
    style: raw.style || raw.genre || "Swing",
    bpm: Number.isFinite(bpm) && bpm > 0 ? Math.round(bpm) : null,
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

const MiniWaveform = ({ data }) => {
  const bars = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return [];
    const downsample = Math.min(40, data.length);
    const step = Math.ceil(data.length / downsample);
    return data
      .filter((_, idx) => idx % step === 0)
      .map((value) => Math.max(0.2, Math.min(1, value)));
  }, [data]);

  if (!bars.length) return null;

  return (
    <div className="absolute inset-0 flex items-end gap-[1px] opacity-20 px-2 pb-1 pointer-events-none">
      {bars.map((height, idx) => (
        <div
          key={idx}
          className="w-[2px] flex-1 bg-orange-400 rounded-t-sm"
          style={{ height: `${height * 100}%` }}
        />
      ))}
    </div>
  );
};

function LickRow({ lick, onTogglePlay, isPlaying, onQuickAdd }) {
  const [{ isDragging }, dragRef] = useDrag(
    () => ({
      type: "PROJECT_LICK",
      item: { ...lick },
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
    }),
    [lick]
  );

  return (
    <div
      ref={dragRef}
      className={`group relative px-2 py-2 rounded-lg cursor-grab transition-colors ${
        isDragging ? "opacity-40" : "opacity-100"
      } hover:bg-gray-900/60`}
    >
      <MiniWaveform data={lick.waveformData} />
      <div className="absolute inset-0 opacity-0 group-hover:opacity-60 transition-opacity pointer-events-none">
        {lick.waveformData ? (
          <MiniWaveform data={lick.waveformData} />
        ) : null}
      </div>
      <div className="grid grid-cols-[16px,1fr,48px,48px,56px,36px] items-center gap-3 text-[11px] text-gray-300 relative z-10">
        <span className="text-gray-600 group-hover:text-gray-400">
          <FaGripVertical size={10} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-100 truncate">{lick.title}</p>
          <p className="text-[10px] text-gray-500 truncate">{lick.style}</p>
        </div>
        <span className="text-center font-mono text-[10px]">
          {lick.key || "—"}
        </span>
        <span className="text-center font-mono text-[10px]">
          {lick.bpm ? `${lick.bpm}` : "—"}
        </span>
        <span className="text-center font-mono text-[10px]">
          {lick.duration ? `${lick.duration.toFixed(1)}s` : "—"}
        </span>
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onTogglePlay?.(lick);
            }}
            className={`w-7 h-7 flex items-center justify-center rounded-full border text-[10px] transition-colors ${
              isPlaying
                ? "bg-orange-600 text-white border-orange-500"
                : "bg-transparent border-gray-700 text-orange-400 hover:bg-orange-500/10"
            }`}
          >
            {isPlaying ? <FaPause size={9} /> : <FaPlay size={9} className="ml-0.5" />}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onQuickAdd?.(lick);
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] px-2 py-1 rounded-md bg-gray-800 text-gray-200 hover:bg-gray-700"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProjectLickLibrary({ initialLicks = [], onLickDrop }) {
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
    <div className="w-80 h-full flex flex-col bg-[#05060b] border-r border-gray-900">
      <div className="p-3 border-b border-gray-900 bg-gray-950/70 backdrop-blur">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[11px] uppercase tracking-[0.3em] text-gray-500">
            Lick Vault
          </h3>
          <span className="text-[10px] bg-gray-900 text-gray-300 px-2 py-0.5 rounded-full">
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
            className="w-full bg-gray-950 border border-gray-850 rounded-lg py-2 pl-8 pr-10 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 transition-colors"
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-orange-400 transition-colors"
            title="Filter options coming soon"
          >
            <FaFilter size={12} />
          </button>
        </div>
      </div>

      <div className="px-3 py-2 text-[10px] uppercase tracking-wide text-gray-500 flex items-center gap-3 border-b border-gray-900 bg-[#070a13]">
        <span className="flex-1">Name</span>
        <span className="w-12 text-center">Key</span>
        <span className="w-12 text-center">BPM</span>
        <span className="w-14 text-center">Length</span>
        <span className="w-9 text-right">Play</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {loading && (
          <div className="text-gray-500 text-center py-8 text-sm">Loading...</div>
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
          filteredLicks.map((lick) => (
            <LickRow
              key={lick._id || lick.id}
              lick={lick}
              onTogglePlay={handlePreview}
              isPlaying={currentPreview === lick.audioUrl}
              onQuickAdd={(selected) => onLickDrop?.(selected)}
            />
          ))}
      </div>
    </div>
  );
}


