// fe/src/components/ProjectExportButton.js
// Export button for ProjectDetailPage
import React, { useState } from 'react';
import { FaDownload } from 'react-icons/fa';
import { saveProjectWithAudio } from '../services/studioExportService';

export default function ProjectExportButton({ 
  projectId, 
  projectName,
  chordProgression = [],
  bpm = 120,
  key: projectKey = 'C',
  style = 'Swing',
  bandSettings = { volumes: { drums: 0.8, bass: 0.8, piano: 0.8 }, mutes: { drums: false, bass: false, piano: false } }
}) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!projectId) {
      alert('No project selected');
      return;
    }

    if (chordProgression.length === 0) {
      alert('Please add some chords to the progression first');
      return;
    }

    setIsExporting(true);
    try {
      // Convert chordProgression to Studio format
      const sections = [{
        id: 'main',
        label: 'Main',
        bars: chordProgression.map(chord => 
          typeof chord === 'string' ? chord : (chord.chordName || chord.chord || '')
        ),
        licks: []
      }];

      const projectState = {
        song: {
          key: projectKey,
          bpm,
          style,
          sections
        },
        bandSettings
      };

      const result = await saveProjectWithAudio(projectState, projectId);
      
      if (result.success) {
        alert(`Project exported successfully! Audio saved to: ${result.audioUrl || 'Cloudinary'}`);
      } else {
        throw new Error('Export failed');
      }
    } catch (error) {
      console.error('[Export] Failed:', error);
      alert('Failed to export project. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={isExporting || !projectId || chordProgression.length === 0}
      className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      title="Export project as audio file"
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
  );
}

