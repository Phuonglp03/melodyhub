// src/store/StudioContext.js
import React, { createContext, useContext, useReducer, useCallback } from 'react';

// Initial State
const initialState = {
  song: {
    key: 'C',
    bpm: 120,
    style: 'Swing',
    sections: [],
  },
  selectedSectionId: null,
  selectedBarIndex: null,
  bandSettings: {
    style: 'Swing',
    volumes: { drums: 0.8, bass: 0.8, piano: 0.8 },
    mutes: { drums: false, bass: false, piano: false },
  },
  isPlaying: false,
  currentBeat: 0,
};

// Action Types
const ActionTypes = {
  SET_KEY: 'SET_KEY',
  SET_BPM: 'SET_BPM',
  SET_STYLE: 'SET_STYLE',
  ADD_SECTION: 'ADD_SECTION',
  DELETE_SECTION: 'DELETE_SECTION',
  UPDATE_CHORD: 'UPDATE_CHORD',
  SELECT_BAR: 'SELECT_BAR',
  ADD_LICK_TO_TIMELINE: 'ADD_LICK_TO_TIMELINE',
  REMOVE_LICK_FROM_TIMELINE: 'REMOVE_LICK_FROM_TIMELINE',
  MOVE_LICK_ON_TIMELINE: 'MOVE_LICK_ON_TIMELINE',
  RESIZE_LICK_ON_TIMELINE: 'RESIZE_LICK_ON_TIMELINE',
  SET_BAND_VOLUME: 'SET_BAND_VOLUME',
  TOGGLE_MUTE: 'TOGGLE_MUTE',
  SET_PLAYING: 'SET_PLAYING',
  SET_CURRENT_BEAT: 'SET_CURRENT_BEAT',
  LOAD_PROJECT: 'LOAD_PROJECT',
  CLEAR_SELECTION: 'CLEAR_SELECTION',
};

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const getDiatonicChords = (key) => {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  
  // Handle key as object (new format) or string (legacy format)
  let keyString;
  if (typeof key === "object" && key !== null) {
    // New format: { root, scale, name }
    keyString = key.name || `${notes[key.root || 0]} ${key.scale === "minor" ? "Minor" : "Major"}`;
  } else {
    // Legacy format: string
    keyString = key || "C Major";
  }
  
  const keyIndex = notes.indexOf(keyString.replace('m', '').replace(' Major', '').replace(' Minor', '').split(' ')[0] || 'C');
  const isMinor = keyString.toLowerCase().includes('minor') || (keyString.toLowerCase().includes('m') && !keyString.toLowerCase().includes('major'));

  if (isMinor) {
    const intervals = [0, 2, 3, 5, 7, 8, 10];
    const qualities = ['m7', 'm7b5', 'maj7', 'm7', 'm7', 'maj7', '7'];
    return intervals.map((interval, i) => notes[(keyIndex + interval) % 12] + qualities[i]);
  } else {
    const intervals = [0, 2, 4, 5, 7, 9, 11];
    const qualities = ['maj7', 'm7', 'm7', 'maj7', '7', 'm7', 'm7b5'];
    return intervals.map((interval, i) => notes[(keyIndex + interval) % 12] + qualities[i]);
  }
};

function studioReducer(state, action) {
  switch (action.type) {
    case ActionTypes.SET_KEY:
      return { ...state, song: { ...state.song, key: action.payload } };

    case ActionTypes.SET_BPM:
      return { ...state, song: { ...state.song, bpm: action.payload } };

    case ActionTypes.SET_STYLE:
      return {
        ...state,
        song: { ...state.song, style: action.payload },
        bandSettings: { ...state.bandSettings, style: action.payload },
      };

    case ActionTypes.ADD_SECTION: {
      const newSection = {
        id: generateId(),
        label: action.payload,
        bars: Array(8).fill(''),
        licks: [],
      };
      return {
        ...state,
        song: { ...state.song, sections: [...state.song.sections, newSection] },
      };
    }

    case ActionTypes.DELETE_SECTION:
      return {
        ...state,
        song: {
          ...state.song,
          sections: state.song.sections.filter((s) => s.id !== action.payload),
        },
        selectedSectionId: state.selectedSectionId === action.payload ? null : state.selectedSectionId,
        selectedBarIndex: state.selectedSectionId === action.payload ? null : state.selectedBarIndex,
      };

    case ActionTypes.UPDATE_CHORD: {
      const { sectionId, barIndex, chord } = action.payload;
      const targetSectionId = sectionId || state.selectedSectionId;
      const targetBarIndex = barIndex ?? state.selectedBarIndex;

      if (targetSectionId === null || targetBarIndex === null) return state;

      const newSections = state.song.sections.map((section) => {
        if (section.id === targetSectionId) {
          const newBars = [...section.bars];
          newBars[targetBarIndex] = chord;
          return { ...section, bars: newBars };
        }
        return section;
      });

      // Auto-advance
      let nextSectionId = targetSectionId;
      let nextBarIndex = targetBarIndex + 1;
      const currentSection = newSections.find((s) => s.id === targetSectionId);

      if (currentSection && nextBarIndex >= currentSection.bars.length) {
        const currentIndex = newSections.findIndex((s) => s.id === targetSectionId);
        if (currentIndex < newSections.length - 1) {
          nextSectionId = newSections[currentIndex + 1].id;
          nextBarIndex = 0;
        } else {
          nextBarIndex = targetBarIndex;
        }
      }

      return {
        ...state,
        song: { ...state.song, sections: newSections },
        selectedSectionId: nextSectionId,
        selectedBarIndex: nextBarIndex,
      };
    }

    case ActionTypes.SELECT_BAR:
      return {
        ...state,
        selectedSectionId: action.payload.sectionId,
        selectedBarIndex: action.payload.barIndex,
      };

    case ActionTypes.CLEAR_SELECTION:
      return { ...state, selectedSectionId: null, selectedBarIndex: null };

    case ActionTypes.ADD_LICK_TO_TIMELINE: {
      const { sectionId, barIndex, lickData } = action.payload;
      if (!sectionId || barIndex === null || barIndex === undefined) {
        return state;
      }

      const lickInstance = {
        id: generateId(),
        lickId: lickData?._id || lickData?.id || generateId(),
        name: lickData?.title || lickData?.name || 'Lick',
        startBar: barIndex,
        duration: lickData?.duration || lickData?.length || 2,
        audioUrl:
          lickData?.audioUrl ||
          lickData?.audio_url ||
          lickData?.previewUrl ||
          lickData?.preview_url ||
          null,
        data: lickData,
      };

      const newSections = state.song.sections.map((section) => {
        if (section.id === sectionId) {
          const existing = Array.isArray(section.licks) ? section.licks : [];
          const updatedLicks = [...existing, lickInstance].sort((a, b) => a.startBar - b.startBar);
          return { ...section, licks: updatedLicks };
        }
        return section;
      });

      return { ...state, song: { ...state.song, sections: newSections } };
    }

    case ActionTypes.REMOVE_LICK_FROM_TIMELINE: {
      const { sectionId, lickInstanceId } = action.payload;
      const newSections = state.song.sections.map((section) => {
        if (section.id === sectionId) {
          return {
            ...section,
            licks: section.licks.filter((l) => l.id !== lickInstanceId),
          };
        }
        return section;
      });

      return { ...state, song: { ...state.song, sections: newSections } };
    }

    case ActionTypes.MOVE_LICK_ON_TIMELINE: {
      const { fromSectionId, toSectionId, lickId, newBarIndex } = action.payload;
      if (!fromSectionId || !toSectionId || newBarIndex === null || newBarIndex === undefined) {
        return state;
      }

      const newSections = state.song.sections.map((section) => ({
        ...section,
        licks: Array.isArray(section.licks) ? [...section.licks] : [],
      }));

      const fromIdx = newSections.findIndex((s) => s.id === fromSectionId);
      const toIdx = newSections.findIndex((s) => s.id === toSectionId);
      if (fromIdx === -1 || toIdx === -1) return state;

      const sourceSection = newSections[fromIdx];
      const lickIndex = sourceSection.licks.findIndex((l) => l.id === lickId);
      if (lickIndex === -1) return state;

      const [lickInstance] = sourceSection.licks.splice(lickIndex, 1);
      const targetSection = newSections[toIdx];
      const barsLength = targetSection.bars.length || 8;
      const clampedStart = Math.max(0, Math.min(newBarIndex, barsLength - 1));
      const duration = Math.max(
        1,
        Math.min(lickInstance.duration || 1, barsLength - clampedStart)
      );

      lickInstance.startBar = clampedStart;
      lickInstance.duration = duration;

      targetSection.licks = [...targetSection.licks, lickInstance].sort(
        (a, b) => a.startBar - b.startBar
      );
      sourceSection.licks = [...sourceSection.licks].sort((a, b) => a.startBar - b.startBar);

      return { ...state, song: { ...state.song, sections: newSections } };
    }

    case ActionTypes.RESIZE_LICK_ON_TIMELINE: {
      const { sectionId, lickId, newStartBar, newDuration } = action.payload;
      if (!sectionId || newStartBar === null || newDuration === null) return state;
      const newSections = state.song.sections.map((section) => ({
        ...section,
        licks: Array.isArray(section.licks) ? [...section.licks] : [],
      }));
      const sectionIdx = newSections.findIndex((s) => s.id === sectionId);
      if (sectionIdx === -1) return state;
      const section = newSections[sectionIdx];
      const lick = section.licks.find((l) => l.id === lickId);
      if (!lick) return state;

      const barsLength = section.bars.length || 8;
      const clampedStart = Math.max(0, Math.min(newStartBar, barsLength - 1));
      const clampedDuration = Math.max(1, Math.min(newDuration, barsLength - clampedStart));

      lick.startBar = clampedStart;
      lick.duration = clampedDuration;
      section.licks = [...section.licks].sort((a, b) => a.startBar - b.startBar);

      return { ...state, song: { ...state.song, sections: newSections } };
    }

    case ActionTypes.SET_BAND_VOLUME: {
      const { instrument, volume } = action.payload;
      return {
        ...state,
        bandSettings: {
          ...state.bandSettings,
          volumes: { ...state.bandSettings.volumes, [instrument]: volume },
        },
      };
    }

    case ActionTypes.TOGGLE_MUTE: {
      const { instrument } = action.payload;
      return {
        ...state,
        bandSettings: {
          ...state.bandSettings,
          mutes: {
            ...state.bandSettings.mutes,
            [instrument]: !state.bandSettings.mutes[instrument],
          },
        },
      };
    }

    case ActionTypes.SET_PLAYING:
      return { ...state, isPlaying: action.payload };

    case ActionTypes.SET_CURRENT_BEAT:
      return { ...state, currentBeat: action.payload };

    case ActionTypes.LOAD_PROJECT: {
      const project = action.payload;
      return {
        ...state,
        song: {
          key: project.key || 'C',
          bpm: project.bpm || 120,
          style: project.style || 'Swing',
          sections: project.sections || [],
        },
        bandSettings: project.bandSettings || state.bandSettings,
      };
    }

    default:
      return state;
  }
}

const StudioContext = createContext(null);

export function StudioProvider({ children }) {
  const [state, dispatch] = useReducer(studioReducer, initialState);

  const actions = {
    setKey: useCallback((key) => dispatch({ type: ActionTypes.SET_KEY, payload: key }), []),
    setBpm: useCallback((bpm) => dispatch({ type: ActionTypes.SET_BPM, payload: bpm }), []),
    setStyle: useCallback((style) => dispatch({ type: ActionTypes.SET_STYLE, payload: style }), []),
    addSection: useCallback((label) => dispatch({ type: ActionTypes.ADD_SECTION, payload: label }), []),
    deleteSection: useCallback((sectionId) => dispatch({ type: ActionTypes.DELETE_SECTION, payload: sectionId }), []),
    updateChord: useCallback((chord, sectionId = null, barIndex = null) => {
      dispatch({ type: ActionTypes.UPDATE_CHORD, payload: { chord, sectionId, barIndex } });
    }, []),
    selectBar: useCallback((sectionId, barIndex) => {
      dispatch({ type: ActionTypes.SELECT_BAR, payload: { sectionId, barIndex } });
    }, []),
    clearSelection: useCallback(() => dispatch({ type: ActionTypes.CLEAR_SELECTION }), []),
    addLickToTimeline: useCallback((sectionId, barIndex, lickData) => {
      dispatch({ type: ActionTypes.ADD_LICK_TO_TIMELINE, payload: { sectionId, barIndex, lickData } });
    }, []),
    removeLickFromTimeline: useCallback((sectionId, lickInstanceId) => {
      dispatch({ type: ActionTypes.REMOVE_LICK_FROM_TIMELINE, payload: { sectionId, lickInstanceId } });
    }, []),
    moveLickOnTimeline: useCallback((fromSectionId, lickId, toSectionId, newBarIndex) => {
      dispatch({
        type: ActionTypes.MOVE_LICK_ON_TIMELINE,
        payload: { fromSectionId, toSectionId, lickId, newBarIndex },
      });
    }, []),
    resizeLickOnTimeline: useCallback((sectionId, lickId, newStartBar, newDuration) => {
      dispatch({
        type: ActionTypes.RESIZE_LICK_ON_TIMELINE,
        payload: { sectionId, lickId, newStartBar, newDuration },
      });
    }, []),
    setBandVolume: useCallback((instrument, volume) => {
      dispatch({ type: ActionTypes.SET_BAND_VOLUME, payload: { instrument, volume } });
    }, []),
    toggleMute: useCallback((instrument) => {
      dispatch({ type: ActionTypes.TOGGLE_MUTE, payload: { instrument } });
    }, []),
    setPlaying: useCallback((isPlaying) => dispatch({ type: ActionTypes.SET_PLAYING, payload: isPlaying }), []),
    setCurrentBeat: useCallback((beat) => dispatch({ type: ActionTypes.SET_CURRENT_BEAT, payload: beat }), []),
    loadProject: useCallback((project) => dispatch({ type: ActionTypes.LOAD_PROJECT, payload: project }), []),
  };

  const computed = {
    diatonicChords: getDiatonicChords(state.song.key),
    totalBars: state.song.sections.reduce((sum, s) => sum + s.bars.length, 0),
    currentSection: state.song.sections.find((s) => s.id === state.selectedSectionId),
  };

  return (
    <StudioContext.Provider value={{ state, actions, computed }}>
      {children}
    </StudioContext.Provider>
  );
}

export function useStudio() {
  const context = useContext(StudioContext);
  if (!context) {
    throw new Error('useStudio must be used within a StudioProvider');
  }
  return context;
}

export { getDiatonicChords };

