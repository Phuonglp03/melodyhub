// fe/src/components/ProjectExportButton.js
// Export button for ProjectDetailPage with range selection
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaDownload } from "react-icons/fa";
import { saveProjectWithAudio } from "../services/studioExportService";
import { saveProjectExport } from "../services/user/projectService";

export default function ProjectExportButton({
  projectId,
  projectName,
  chordProgression = [],
  bpm = 120,
  projectKey = "C",
  style = "Swing",
  bandSettings = {
    volumes: { drums: 0.8, bass: 0.8, piano: 0.8 },
    mutes: { drums: false, bass: false, piano: false },
  },
  status = "draft",
  timeSignature = { numerator: 4, denominator: 4 }, // Default 4/4
  variant = "default",
  className = "",
  onExportComplete,
}) {
  const navigate = useNavigate();
  const [isExporting, setIsExporting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [rangeMode, setRangeMode] = useState("full"); // "full" | "range"
  const [startBar, setStartBar] = useState(1); // Bar numbers start from 1
  const [endBar, setEndBar] = useState(1);

  // Calculate backing track duration: each chord = 1 bar
  const beatsPerBar = timeSignature?.numerator || 4;
  const secondsPerBar = (60 / bpm) * beatsPerBar;
  const totalBars = chordProgression.length;
  const backingTrackDuration = totalBars * secondsPerBar + 2; // +2s tail like calculateDuration

  const canExport =
    !!projectId && chordProgression.length > 0 && status === "active";

  const openMenu = () => {
    if (!canExport) {
      if (!projectId) {
        alert("No project selected");
      } else if (chordProgression.length === 0) {
        alert("Please add some chords to the progression first");
      } else if (status !== "active") {
        alert("Project must be ACTIVE before exporting audio.");
      }
      return;
    }
    setShowMenu(true);
  };

  const closeMenu = () => {
    if (isExporting) return;
    setShowMenu(false);
  };

  // Convert bar numbers to seconds
  const barsToSeconds = (barNumber) => {
    // Bar 1 starts at 0, bar 2 starts at secondsPerBar, etc.
    return (barNumber - 1) * secondsPerBar;
  };

  const handleConfirmExport = async () => {
    if (!canExport) return;

    let startTimeSeconds = 0;
    let endTimeSeconds = backingTrackDuration;

    if (rangeMode === "range") {
      const startBarNum = Number(startBar) || 1;
      const endBarNum = Number(endBar) || 1;
      if (
        startBarNum < 1 ||
        endBarNum < 1 ||
        endBarNum < startBarNum ||
        endBarNum > totalBars
      ) {
        alert(
          `Please enter a valid bar range: start and end must be between 1 and ${totalBars}, and end must be >= start.`
        );
        return;
      }
      startTimeSeconds = barsToSeconds(startBarNum);
      endTimeSeconds = barsToSeconds(endBarNum) + secondsPerBar; // End of the end bar
    }

    setIsExporting(true);
    // (NO $) [DEBUG][ProjectExport] Bắt đầu export
    console.log("(NO $) [DEBUG][ProjectExport] Starting export:", {
      projectId,
      projectName,
      status,
      rangeMode,
      startBar: rangeMode === "range" ? startBar : null,
      endBar: rangeMode === "range" ? endBar : null,
      startTimeSeconds,
      endTimeSeconds,
      totalBars,
      backingTrackDuration,
    });

    try {
      const sections = [
        {
          id: "main",
          label: "Main",
          bars: chordProgression.map((chord) =>
            typeof chord === "string"
              ? chord
              : chord.chordName || chord.chord || ""
          ),
          licks: [],
        },
      ];

      const projectState = {
        song: {
          key: projectKey,
          bpm,
          style,
          sections,
          exportRange:
            rangeMode === "range"
              ? {
                  startTime: startTimeSeconds,
                  endTime: endTimeSeconds,
                }
              : null,
        },
        bandSettings,
      };

      const result = await saveProjectWithAudio(projectState, projectId);

      if (!result?.success) {
        throw new Error("Export failed");
      }

      try {
        await saveProjectExport(projectId, {
          audioUrl: result.audioUrl,
          audioDuration: result.duration,
          waveformData: result.waveformData,
        });
      } catch (metaErr) {
        console.error("Failed to save project export metadata:", metaErr);
      }

      if (typeof onExportComplete === "function") {
        onExportComplete({
          audioUrl: result.audioUrl,
          audioDuration: result.duration,
          waveformData: result.waveformData,
        });
      }

      setShowMenu(false);
      navigate("/projects");
    } catch (error) {
      console.error("[Export] Failed:", error);
      alert("Failed to export project. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const variantClasses =
    variant === "compact"
      ? "px-3 py-1.5 rounded-md text-xs"
      : "px-4 py-2 rounded-full text-sm";

  const disabledReason = !projectId
    ? "No project selected"
    : chordProgression.length === 0
    ? "Add some chords first"
    : status !== "active"
    ? "Project must be ACTIVE to export"
    : "";

  return (
    <>
      <button
        onClick={openMenu}
        disabled={isExporting || !canExport}
        className={[
          "bg-purple-600 hover:bg-purple-500 text-white font-medium flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
          variantClasses,
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        title={canExport ? "Export project as audio file" : disabledReason}
      >
        {isExporting ? (
          <>
            <span className="animate-spin">⏳</span>
            Exporting...
          </>
        ) : (
          <>
            <FaDownload size={12} />
            Export Audio
          </>
        )}
      </button>

      {showMenu && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md p-5 shadow-2xl">
            <h3 className="text-lg font-semibold text-white mb-3">
              Export Project Audio
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              Choose the timeline range you want to export. Full song exports
              from bar 1 to bar {totalBars} (end of backing track).
            </p>

            <div className="space-y-4">
              <div className="flex items-center gap-3 text-sm">
                <label className="flex items-center gap-2 text-gray-200">
                  <input
                    type="radio"
                    checked={rangeMode === "full"}
                    onChange={() => setRangeMode("full")}
                  />
                  Full song (bars 1-{totalBars})
                </label>
                <label className="flex items-center gap-2 text-gray-200">
                  <input
                    type="radio"
                    checked={rangeMode === "range"}
                    onChange={() => {
                      setRangeMode("range");
                      // Set default range to full when switching to range mode
                      if (startBar === 1 && endBar === 1) {
                        setEndBar(totalBars);
                      }
                    }}
                  />
                  Bar range
                </label>
              </div>

              {rangeMode === "range" && (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <label className="block text-gray-300 mb-1">
                      Start bar
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={totalBars}
                      value={startBar}
                      onChange={(e) => {
                        const val = Math.max(
                          1,
                          Math.min(totalBars, Number(e.target.value) || 1)
                        );
                        setStartBar(val);
                        if (val > endBar) setEndBar(val);
                      }}
                      className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-300 mb-1">End bar</label>
                    <input
                      type="number"
                      min={1}
                      max={totalBars}
                      value={endBar}
                      onChange={(e) => {
                        const val = Math.max(
                          1,
                          Math.min(totalBars, Number(e.target.value) || 1)
                        );
                        setEndBar(val);
                        if (val < startBar) setStartBar(val);
                      }}
                      className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={closeMenu}
                disabled={isExporting}
                className="px-4 py-2 rounded-md bg-gray-800 text-gray-200 text-sm hover:bg-gray-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmExport}
                disabled={isExporting}
                className="px-4 py-2 rounded-md bg-purple-600 text-white text-sm font-medium hover:bg-purple-500 disabled:opacity-50 flex items-center gap-2"
              >
                {isExporting ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Exporting...
                  </>
                ) : (
                  <>
                    <FaDownload size={12} />
                    Confirm Export
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
