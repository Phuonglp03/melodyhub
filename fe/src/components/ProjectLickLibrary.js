// fe/src/components/ProjectLickLibrary.js
// Lick library sidebar for ProjectDetailPage (inspired by Studio's RightLickLibrary)
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { FaSearch, FaFilter } from 'react-icons/fa';
import { getCommunityLicks } from '../services/user/lickService';
import { useDrag } from 'react-dnd';
import { FaPlay, FaPause, FaGripVertical } from 'react-icons/fa';

const normalizeLick = (raw) => {
  if (!raw) return null;
  const id = raw._id || raw.id;
  const title = raw.title || raw.name || 'Untitled Lick';
  const duration = Number(raw.duration || raw.length || 2);
  return {
    id,
    _id: id,
    title,
    key: raw.key || 'C',
    style: raw.style || raw.genre || 'Swing',
    duration,
    durationLabel: duration ? `${duration.toFixed(1)}s` : '',
    waveformData: raw.waveformData || raw.waveform_data || null,
    audioUrl:
      raw.audioUrl ||
      raw.audio_url ||
      raw.previewUrl ||
      raw.preview_url ||
      null,
    searchText: `${title} ${raw.key || ''} ${raw.style || ''}`.toLowerCase(),
    original: raw,
  };
};

// Mini Waveform Component
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

// Lick Card Component
function LickCard({ lick, onTogglePlay, isPlaying }) {
  const [{ isDragging }, dragRef] = useDrag(
    () => ({
      type: 'PROJECT_LICK',
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
      className={`
        relative group flex items-center gap-3 p-2
        bg-gray-900/80 border border-gray-800 rounded-lg cursor-grab
        hover:border-orange-500/40 hover:bg-gray-850 transition-all active:cursor-grabbing
        ${isDragging ? 'opacity-40 scale-[0.98]' : 'opacity-100'}
      `}
    >
      <MiniWaveform data={lick.waveformData} />

      <div className="text-gray-600 group-hover:text-gray-400">
        <FaGripVertical size={12} />
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onTogglePlay?.(lick);
        }}
        className={`z-10 w-8 h-8 flex items-center justify-center rounded-full border text-xs transition-colors shadow
          ${
            isPlaying
              ? 'bg-orange-600 text-white border-orange-500'
              : 'bg-gray-850 border-gray-700 text-orange-400 hover:bg-orange-500/10'
          }
        `}
      >
        {isPlaying ? <FaPause size={10} /> : <FaPlay size={10} className="ml-0.5" />}
      </button>

      <div className="flex-1 min-w-0 z-10">
        <div className="flex items-baseline justify-between gap-2">
          <h4 className="text-sm font-semibold text-gray-100 truncate">{lick.title}</h4>
          {lick.duration ? (
            <span className="text-[10px] text-gray-500 font-mono">{lick.duration.toFixed(1)}s</span>
          ) : null}
        </div>
        <div className="flex items-center gap-2 mt-1">
          {lick.key ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded border border-blue-900/60 bg-blue-900/20 text-blue-200">
              {lick.key}
            </span>
          ) : null}
          {lick.style ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded border border-gray-700 bg-gray-800 text-gray-400">
              {lick.style}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function ProjectLickLibrary({ initialLicks = [], onLickDrop }) {
  const [licks, setLicks] = useState(
    initialLicks.map((lick) => normalizeLick(lick)).filter(Boolean)
  );
  const [search, setSearch] = useState('');
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
        search: '',
        limit: 30,
        sortBy: 'newest',
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
      console.error('Failed to fetch licks:', error);
      setError('Unable to load licks right now.');
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
      console.error('Failed to preview lick audio', previewError);
      setCurrentPreview(null);
    }
  };

  return (
    <div className="w-80 h-full flex flex-col bg-black border-l border-gray-900">
      <div className="p-4 border-b border-gray-900 bg-gray-950/60 backdrop-blur">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[11px] uppercase tracking-[0.2em] text-gray-500">Lick Vault</h3>
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
            <LickCard
              key={lick._id || lick.id}
              lick={lick}
              onTogglePlay={handlePreview}
              isPlaying={currentPreview === lick.audioUrl}
            />
          ))}
      </div>
    </div>
  );
}

