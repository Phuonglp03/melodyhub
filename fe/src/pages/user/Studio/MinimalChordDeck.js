import React from 'react';
import { useStudio } from '../../../store/StudioContext';

// Common chord extensions
const EXTENSIONS = ['', '7', 'maj7', 'm7', 'm7b5', 'dim7', 'aug'];

export default function MinimalChordDeck() {
  const { state, actions, computed } = useStudio();
  const { selectedSectionId, selectedBarIndex } = state;
  const { diatonicChords } = computed;

  const isActive = selectedSectionId !== null && selectedBarIndex !== null;

  return (
    <div className="h-28 bg-gray-900 border-t border-gray-800 px-4 py-3">
      {!isActive ? (
        <div className="h-full flex items-center justify-center text-gray-500 text-sm">
          Click on a bar to start entering chords
        </div>
      ) : (
        <div className="h-full flex flex-col gap-3">
          {/* Diatonic Chords Row */}
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-xs w-16">Diatonic:</span>
            <div className="flex flex-wrap gap-1">
              {diatonicChords.map((chord) => (
                <button
                  key={chord}
                  onClick={() => actions.updateChord(chord)}
                  className="px-3 py-2 bg-purple-600 hover:bg-purple-500 
                             rounded text-white text-sm font-medium transition-colors
                             min-w-[64px]"
                >
                  {chord}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Actions Row */}
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-xs w-16">Quick:</span>
            <div className="flex gap-1">
              <button
                onClick={() => actions.updateChord('%')}
                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 text-sm"
                title="Repeat previous chord"
              >
                %
              </button>
              <button
                onClick={() => actions.updateChord('N.C.')}
                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 text-sm"
                title="No Chord"
              >
                N.C.
              </button>
              <button
                onClick={() => actions.updateChord('')}
                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 text-sm"
                title="Clear"
              >
                Clear
              </button>
            </div>

            {/* Current position indicator */}
            <div className="ml-auto text-gray-400 text-sm">
              Bar {selectedBarIndex + 1}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

