// fe/src/components/ProjectExportButton.js
// Export button for ProjectDetailPage with range selection
import React, { useState } from "react";
import { FaDownload } from "react-icons/fa";
import { exportFullProjectAudio } from "../services/studioExportService";
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
  const [isExporting, setIsExporting] = useState(false);
  const [showMenu] = useState(false); // kept for backward compatibility with layout, but menu is no longer used

  const canExport = !!projectId && status === "active";

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
      <div className="flex items-center gap-2">
        <button
          onClick={async () => {
            if (!projectId) {
              alert("No project selected");
              return;
            }
            if (status !== "active") {
              alert("Project must be ACTIVE before exporting audio.");
              return;
            }

            setIsExporting(true);
            console.log(
              "(NO $) [DEBUG][FullMixExport] Starting full project export:",
              {
                projectId,
                projectName,
                status,
              }
            );

            try {
              const result = await exportFullProjectAudio(projectId);

              if (!result?.success) {
                throw new Error("Full project export failed");
              }

              try {
                await saveProjectExport(projectId, {
                  audioUrl: result.audioUrl,
                  audioDuration: result.duration,
                  waveformData: result.waveformData,
                });
              } catch (metaErr) {
                console.error(
                  "Failed to save full-project export metadata:",
                  metaErr
                );
              }

              if (typeof onExportComplete === "function") {
                onExportComplete({
                  audioUrl: result.audioUrl,
                  audioDuration: result.duration,
                  waveformData: result.waveformData,
                });
              }

              // (NO $) [DEBUG][ProjectExport] Export completed successfully
              console.log("(NO $) [DEBUG][ProjectExport] Export success:", {
                projectId,
                hasAudioUrl: !!result.audioUrl,
                duration: result.duration,
              });

              alert(
                "Export complete! You can now preview this mix from your Projects list."
              );
            } catch (error) {
              console.error("[FullMixExport] Failed:", error);
              alert("Failed to export full project mix. Please try again.");
            } finally {
              setIsExporting(false);
            }
          }}
          disabled={isExporting || !projectId || status !== "active"}
          className={[
            "bg-blue-600 hover:bg-blue-500 text-white font-medium flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
            variantClasses,
          ]
            .filter(Boolean)
            .join(" ")}
          title={
            projectId && status === "active"
              ? "Export full studio mix (all tracks)"
              : "Project must be ACTIVE to export full mix"
          }
        >
          {isExporting ? (
            <>
              <span className="animate-spin">⏳</span>
              Exporting...
            </>
          ) : (
            <>
              <FaDownload size={12} />
              Full Mix
            </>
          )}
        </button>
      </div>

      {/* Range-selection modal removed: full-mix export always uses project timeline */}
    </>
  );
}
