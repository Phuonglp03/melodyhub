import React from "react";
import { useDrop, useDrag } from "react-dnd";
import { useStudio } from "../../../store/StudioContext";
import { Plus, Trash2, Music } from "lucide-react";

const SECTION_LABELS = ["Intro", "A", "B", "C", "Ending"];

export default function Timeline() {
  const { state, actions } = useStudio();
  const { song, selectedSectionId, selectedBarIndex, currentBeat, isPlaying } =
    state;

  return (
    <div className="flex-1 overflow-y-auto p-4 bg-gray-950">
      {/* Section List */}
      {song.sections.map((section, sectionIdx) => (
        <SectionRow
          key={section.id}
          section={section}
          sectionIdx={sectionIdx}
          isSelected={selectedSectionId === section.id}
          selectedBarIndex={
            selectedSectionId === section.id ? selectedBarIndex : null
          }
          currentBeat={currentBeat}
          isPlaying={isPlaying}
        />
      ))}

      {/* Add Section Button */}
      <AddSectionButton />
    </div>
  );
}

function SectionRow({
  section,
  sectionIdx,
  isSelected,
  selectedBarIndex,
  currentBeat,
  isPlaying,
}) {
  const { actions } = useStudio();

  // Calculate which bar is currently playing
  const currentBarInSection = isPlaying
    ? Math.floor(currentBeat / 4) % section.bars.length
    : -1;

  return (
    <div className="mb-6">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-purple-400">
            {section.label}
          </span>
          <span className="text-gray-500 text-sm">
            ({section.bars.length} bars)
          </span>
        </div>
        <button
          onClick={() => actions.deleteSection(section.id)}
          className="p-1 text-gray-500 hover:text-red-500 transition-colors"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Chord Grid */}
      <div className="relative">
        <div className="grid grid-cols-8 gap-2">
          {section.bars.map((chord, barIdx) => (
            <BarCell
              key={`${section.id}-${barIdx}`}
              section={section}
              barIdx={barIdx}
              chord={chord}
              isSelected={isSelected && selectedBarIndex === barIdx}
              isPlaying={currentBarInSection === barIdx}
            />
          ))}
        </div>

        <PlayheadOverlay
          barsCount={section.bars.length}
          currentBar={currentBarInSection}
          isPlaying={isPlaying}
        />
        {/* Lick Overlay */}
        <LickOverlay section={section} />
      </div>
    </div>
  );
}

function BarCell({ section, barIdx, chord, isSelected, isPlaying }) {
  const { actions } = useStudio();

  const [{ isOver }, dropRef] = useDrop(
    () => ({
      accept: ["LIBRARY_LICK", "PLACED_LICK"],
      drop: (item, monitor) => {
        if (monitor.didDrop()) return;
        const type = monitor.getItemType();
        if (type === "LIBRARY_LICK") {
          actions.addLickToTimeline(section.id, barIdx, item);
          return;
        }

        if (type === "PLACED_LICK") {
          actions.moveLickOnTimeline(
            item.sectionId,
            item.lickId,
            section.id,
            barIdx
          );
        }
      },
      collect: (monitor) => ({
        isOver: monitor.isOver(),
      }),
    }),
    [section.id, barIdx, actions]
  );

  return (
    <div
      ref={dropRef}
      onClick={() => actions.selectBar(section.id, barIdx)}
      className={`
        h-16 rounded-lg border-2 flex items-center justify-center cursor-pointer
        transition-all duration-150
        ${
          isSelected
            ? "border-purple-500 bg-purple-900/30 ring-2 ring-purple-500/50"
            : "border-gray-700 bg-gray-800/50 hover:border-gray-600"
        }
        ${isPlaying ? "border-green-500 bg-green-900/30" : ""}
        ${
          isOver
            ? "border-orange-500 bg-orange-900/30 ring-2 ring-orange-500/40"
            : ""
        }
      `}
    >
      {chord ? (
        <span className="text-white font-medium text-sm">{chord}</span>
      ) : (
        <span className="text-gray-600 text-xs">+</span>
      )}
      {isOver && (
        <div className="absolute inset-0 flex items-center justify-center text-[10px] text-orange-300 font-semibold tracking-widest pointer-events-none">
          DROP HERE
        </div>
      )}
    </div>
  );
}

function PlayheadOverlay({ barsCount, currentBar, isPlaying }) {
  if (!isPlaying || currentBar < 0 || barsCount <= 0) return null;
  const widthPct = 100 / barsCount;
  const left = `${currentBar * widthPct}%`;
  return (
    <div
      className="absolute inset-y-0 pointer-events-none flex"
      style={{ left, width: `${widthPct}%` }}
    >
      <div className="w-full h-full bg-purple-500/5 border border-purple-500/40 rounded-lg animate-pulse" />
    </div>
  );
}

function LickOverlay({ section }) {
  const overlayRef = React.useRef(null);
  const { actions } = useStudio();

  const [, dropOverlay] = useDrop(
    () => ({
      accept: ["LIBRARY_LICK", "PLACED_LICK", "PLACED_LICK_HANDLE"],
      drop: (item, monitor) => {
        if (!overlayRef.current || !monitor.isOver({ shallow: true })) return;
        const client = monitor.getClientOffset();
        if (!client) return;
        const rect = overlayRef.current.getBoundingClientRect();
        const barWidth = rect.width / section.bars.length;
        if (!barWidth) return;
        const relativeX = client.x - rect.left;
        const targetBar = Math.max(
          0,
          Math.min(section.bars.length - 1, Math.floor(relativeX / barWidth))
        );
        const type = monitor.getItemType();

        if (type === "LIBRARY_LICK") {
          actions.addLickToTimeline(section.id, targetBar, item);
          return;
        }

        if (type === "PLACED_LICK") {
          actions.moveLickOnTimeline(
            item.sectionId,
            item.lickId,
            section.id,
            targetBar
          );
          return;
        }

        if (type === "PLACED_LICK_HANDLE" && item.sectionId === section.id) {
          const barsLength = section.bars.length;
          if (item.edge === "right") {
            const nextDuration = Math.max(
              1,
              Math.min(
                targetBar - item.startBar + 1,
                barsLength - item.startBar
              )
            );
            actions.resizeLickOnTimeline(
              section.id,
              item.lickId,
              item.startBar,
              nextDuration
            );
          } else if (item.edge === "left") {
            const clipEnd = item.startBar + (item.duration || 1);
            const newStart = Math.max(0, Math.min(targetBar, clipEnd - 1));
            const newDuration = clipEnd - newStart;
            actions.resizeLickOnTimeline(
              section.id,
              item.lickId,
              newStart,
              newDuration
            );
          }
        }
      },
    }),
    [section, actions]
  );

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      ref={(node) => {
        overlayRef.current = node;
        if (node) dropOverlay(node);
      }}
    >
      {section.licks?.map((lick) => (
        <PlacedLickClip key={lick.id} section={section} lick={lick} />
      ))}
    </div>
  );
}

function PlacedLickClip({ section, lick }) {
  const { actions } = useStudio();
  const barsCount = section.bars.length || 8;
  const durationInBars = Math.max(1, lick.duration ?? lick.data?.duration ?? 2);
  const clampedDuration = Math.min(durationInBars, barsCount - lick.startBar);
  const left = `${(lick.startBar / barsCount) * 100}%`;
  const width = `${(clampedDuration / barsCount) * 100}%`;

  const [{ isDragging }, dragRef] = useDrag(
    () => ({
      type: "PLACED_LICK",
      item: {
        sectionId: section.id,
        lickId: lick.id,
        startBar: lick.startBar,
        duration: clampedDuration,
      },
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
    }),
    [section.id, lick.id, lick.startBar, clampedDuration]
  );

  const [, resizeLeftRef] = useDrag(
    () => ({
      type: "PLACED_LICK_HANDLE",
      item: {
        sectionId: section.id,
        lickId: lick.id,
        edge: "left",
        startBar: lick.startBar,
        duration: clampedDuration,
      },
    }),
    [section.id, lick.id, lick.startBar, clampedDuration]
  );

  const [, resizeRightRef] = useDrag(
    () => ({
      type: "PLACED_LICK_HANDLE",
      item: {
        sectionId: section.id,
        lickId: lick.id,
        edge: "right",
        startBar: lick.startBar,
        duration: clampedDuration,
      },
    }),
    [section.id, lick.id, lick.startBar, clampedDuration]
  );

  return (
    <div
      ref={dragRef}
      className={`absolute top-0 h-16 rounded-lg border border-blue-400 bg-blue-500/60 flex items-center px-2 pointer-events-auto cursor-grab active:cursor-grabbing hover:bg-blue-500/80 transition-colors ${
        isDragging ? "opacity-50" : ""
      }`}
      style={{ left, width }}
    >
      <div
        ref={resizeLeftRef}
        onMouseDown={(e) => e.stopPropagation()}
        className="absolute left-0 top-0 bottom-0 w-3 flex items-center justify-center text-white/80 text-[8px] bg-blue-300/60 cursor-ew-resize rounded-l-lg"
      >
        ⟵
      </div>
      <div
        ref={resizeRightRef}
        onMouseDown={(e) => e.stopPropagation()}
        className="absolute right-0 top-0 bottom-0 w-3 flex items-center justify-center text-white/80 text-[8px] bg-blue-300/60 cursor-ew-resize rounded-r-lg"
      >
        ⟶
      </div>
      <Music size={14} className="text-white mr-1 z-10" />
      <span className="text-white text-xs truncate z-10">
        {lick.name || lick.data?.title || "Lick"}
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (
            window.confirm(
              `Remove "${lick.name || lick.data?.title || "Lick"}"?`
            )
          ) {
            actions.removeLickFromTimeline(section.id, lick.id);
          }
        }}
        className="absolute top-1 right-2 text-[10px] text-white/70 hover:text-white"
      >
        ×
      </button>
    </div>
  );
}

function AddSectionButton() {
  const { actions } = useStudio();
  const [showMenu, setShowMenu] = React.useState(false);

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 
                   border border-dashed border-gray-600 rounded-lg text-gray-400 
                   hover:text-white transition-colors"
      >
        <Plus size={18} />
        Add Section
      </button>

      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowMenu(false)}
          />
          <div
            className="absolute left-0 top-full mt-2 bg-gray-800 border border-gray-700 
                          rounded-lg shadow-xl z-50 py-1"
          >
            {SECTION_LABELS.map((label) => (
              <button
                key={label}
                onClick={() => {
                  actions.addSection(label);
                  setShowMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-white hover:bg-gray-700"
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
