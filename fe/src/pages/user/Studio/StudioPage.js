import React, { useEffect, useCallback, useMemo, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { useSelector } from "react-redux";
import { StudioProvider, useStudio } from "../../../store/StudioContext";
import { useProjectCollaboration } from "../../../hooks/useProjectCollaboration";
import StudioHeader from "./StudioHeader";
import Timeline from "./Timeline";
import MinimalChordDeck from "./MinimalChordDeck";
import RightLickLibrary from "./RightLickLibrary";
import LiveBackingEngine from "./LiveBackingEngine";
import { convertProjectToStudioState } from "./studioTransformers";
import { getProjectById } from "../../../services/user/projectService";
import api from "../../../services/api";

const hasChords = (sections = []) =>
  sections.some((section) =>
    section?.bars?.some((chord) => chord && chord.trim() !== "")
  );

function StudioContent() {
  const { projectId } = useParams();
  const location = useLocation();
  const { state, actions } = useStudio();
  const [projectName, setProjectName] = useState("");
  const [loading, setLoading] = useState(true);
  const [seedApplied, setSeedApplied] = useState(false);
  const [seedLicks, setSeedLicks] = useState([]);
  const studioSeed = location.state?.studioSeed;
  const seedHasContent = useMemo(
    () => hasChords(studioSeed?.sections || []),
    [studioSeed]
  );

  useEffect(() => {
    if (studioSeed && !seedApplied) {
      actions.loadProject(studioSeed);
      if (studioSeed.projectTitle) {
        setProjectName(studioSeed.projectTitle);
      }
      if (studioSeed.licks?.length) {
        setSeedLicks(studioSeed.licks);
      }
      setSeedApplied(true);
      setLoading(false);
    }
  }, [studioSeed, actions, seedApplied]);

  // Load project on mount
  useEffect(() => {
    if (projectId) {
      loadProject();
    } else {
      setLoading(false);
    }
  }, [projectId]);

  const loadProject = async () => {
    try {
      setLoading(true);
      const response = await getProjectById(projectId);
      if (!response?.success) {
        throw new Error(response?.message || "Failed to load project");
      }

      const project =
        response.data?.project || response.project || response.data || {};
      setProjectName(
        project.name || project.title || studioSeed?.projectTitle || "Untitled"
      );

      const studioData = convertProjectToStudioState(project);
      if (studioData) {
        const merged = { ...studioData };
        if (
          !hasChords(studioData.sections) &&
          seedHasContent &&
          studioSeed?.sections
        ) {
          merged.sections = studioSeed.sections;
          merged.key = studioSeed.key || merged.key;
          merged.bpm = studioSeed.bpm || merged.bpm;
          merged.style = studioSeed.style || merged.style;
        }
        actions.loadProject(merged);
      }
    } catch (error) {
      console.error("Failed to load project:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = useCallback(async () => {
    if (!projectId) return;

    try {
      const { song, bandSettings } = state;
      await api.put(`/projects/${projectId}`, {
        key: song.key,
        bpm: song.bpm,
        style: song.style,
        sections: song.sections,
        bandSettings,
      });
      alert("Project saved!");
    } catch (error) {
      console.error("Failed to save project:", error);
      alert("Failed to save project");
    }
  }, [projectId, state]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Space to toggle play
      if (e.code === "Space" && !e.target.matches("input, textarea")) {
        e.preventDefault();
        actions.setPlaying(!state.isPlaying);
      }
      // Escape to clear selection
      if (e.code === "Escape") {
        actions.clearSelection();
      }
      // Ctrl+S to save
      if (e.ctrlKey && e.code === "KeyS") {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state.isPlaying, actions, handleSave]);

  if (loading) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading Studio...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-black text-white overflow-hidden">
      {/* Audio Engine (no UI) */}
      <LiveBackingEngine />

      {/* Header */}
      <StudioHeader onSave={handleSave} projectName={projectName} />

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Timeline + Chord Deck */}
        <div className="flex-1 flex flex-col min-w-0">
          <Timeline />
          <MinimalChordDeck />
        </div>

        {/* Right: Lick Library */}
        <RightLickLibrary initialLicks={seedLicks} />
      </div>
    </div>
  );
}

export default function StudioPage() {
  return (
    <StudioProvider>
      <DndProvider backend={HTML5Backend}>
        <StudioContent />
      </DndProvider>
    </StudioProvider>
  );
}
