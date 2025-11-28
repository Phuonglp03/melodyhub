// src/hooks/useProjectCollaboration.js
import { useEffect, useRef } from 'react';
import { useStudio } from '../store/StudioContext';
import { initSocket } from '../services/user/socketService';

export const useProjectCollaboration = (projectId, user) => {
  const { actions, state } = useStudio();
  const isRemoteUpdate = useRef(false);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!projectId || !user?._id) return;

    const socket = initSocket();
    socketRef.current = socket;

    // Join project room
    socket.emit('project:join', { projectId, userId: user._id });

    // Listen for remote updates
    socket.on('project:updated', (data) => {
      if (isRemoteUpdate.current) return;

      isRemoteUpdate.current = true;

      try {
        switch (data.type) {
          case 'CHORD_UPDATE':
            actions.updateChord(
              data.payload.chord,
              data.payload.sectionId,
              data.payload.barIndex,
              true // skipEmit
            );
            break;

          case 'LICK_ADD':
            actions.addLickToTimeline(
              data.payload.sectionId,
              data.payload.barIndex,
              data.payload.lick,
              true // skipEmit
            );
            break;

          case 'LICK_MOVE':
            actions.moveLickOnTimeline(
              data.payload.fromSectionId,
              data.payload.lickId,
              data.payload.toSectionId,
              data.payload.toBarIndex,
              true // skipEmit
            );
            break;

          case 'LICK_REMOVE':
            actions.removeLickFromTimeline(
              data.payload.sectionId,
              data.payload.lickId,
              true // skipEmit
            );
            break;

          case 'SECTION_ADD':
            actions.addSection(data.payload.label, true);
            break;

          case 'STYLE_CHANGE':
            actions.setStyle(data.payload.style, true);
            break;

          case 'BPM_CHANGE':
            actions.setBpm(data.payload.bpm, true);
            break;

          default:
            console.warn('[Collaboration] Unknown update type:', data.type);
        }
      } catch (err) {
        console.error('[Collaboration] Error applying remote update:', err);
      } finally {
        isRemoteUpdate.current = false;
      }
    });

    // Listen for presence updates
    socket.on('project:presence', (users) => {
      actions.setCollaborators(users);
    });

    // Listen for connection status
    socket.on('connect', () => {
      actions.setConnectionStatus(true);
    });

    socket.on('disconnect', () => {
      actions.setConnectionStatus(false);
    });

    return () => {
      socket.emit('project:leave', { projectId });
      socket.off('project:updated');
      socket.off('project:presence');
      socket.off('connect');
      socket.off('disconnect');
    };
  }, [projectId, user?._id, actions]);

  // Broadcast change to other collaborators
  const broadcastChange = (type, payload) => {
    if (isRemoteUpdate.current || !socketRef.current) return;

    socketRef.current.emit('project:change', {
      projectId,
      type,
      payload,
      userId: user?._id,
    });
  };

  return { broadcastChange };
};

