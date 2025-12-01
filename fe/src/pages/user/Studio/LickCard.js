import React, { useMemo } from "react";
import { useDrag } from "react-dnd";
import { FaPlay, FaPause, FaGripVertical } from "react-icons/fa";

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

export default function LickCard({ lick, onTogglePlay, isPlaying }) {
  const [{ isDragging }, dragRef] = useDrag(
    () => ({
      type: "LIBRARY_LICK",
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
        ${isDragging ? "opacity-40 scale-[0.98]" : "opacity-100"}
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
              ? "bg-orange-600 text-white border-orange-500"
              : "bg-gray-850 border-gray-700 text-orange-400 hover:bg-orange-500/10"
          }
        `}
      >
        {isPlaying ? (
          <FaPause size={10} />
        ) : (
          <FaPlay size={10} className="ml-0.5" />
        )}
      </button>

      <div className="flex-1 min-w-0 z-10">
        <div className="flex items-baseline justify-between gap-2">
          <h4 className="text-sm font-semibold text-gray-100 truncate">
            {lick.title}
          </h4>
          {lick.duration ? (
            <span className="text-[10px] text-gray-500 font-mono">
              {lick.duration.toFixed(1)}s
            </span>
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
