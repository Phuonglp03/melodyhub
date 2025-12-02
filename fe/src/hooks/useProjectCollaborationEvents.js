import { useEffect, useRef } from "react";
import { collabChannel } from "../utils/collabChannel";
import { normalizeTimelineItem, normalizeTracks } from "../utils/timelineHelpers";
import { TRACK_COLOR_PALETTE, hydrateChordProgression } from "../utils/projectHelpers";

/**
 * Hook for handling remote collaboration events
 * @param {Object} options - Configuration options
 * @param {Object} options.project - Project data
 * @param {Function} options.setProject - Setter for project
 * @param {Array} options.collaborators - Current collaborators list
 * @param {Function} options.setCollaborators - Setter for collaborators
 * @param {Function} options.setActiveEditors - Setter for active editors
 * @param {Function} options.setIsConnected - Setter for connection state
 * @param {Function} options.setTracks - Setter for tracks
 * @param {Function} options.setChordProgression - Setter for chord progression
 * @param {Function} options.saveChordProgression - Function to save chord progression
 * @param {Function} options.setTempoDraft - Setter for tempo draft
 * @param {Function} options.setSwingDraft - Setter for swing draft
 * @param {Object} options.refreshProjectRef - Ref to refresh project function
 * @param {string} options.currentUserId - Current user ID
 * @param {Object} options.currentUserProfile - Current user profile
 * @param {string} options.userRole - Current user role
 * @param {boolean} options.isRemoteUpdateRef - Ref to track if update is remote
 * @returns {void}
 */
export const useProjectCollaborationEvents = ({
  project,
  setProject,
  collaborators,
  setCollaborators,
  setActiveEditors,
  setIsConnected,
  setTracks,
  setChordProgression,
  saveChordProgression,
  setTempoDraft,
  setSwingDraft,
  refreshProjectRef,
  currentUserId,
  currentUserProfile,
  userRole,
  isRemoteUpdateRef,
}) => {
  useEffect(() => {
    const handleRemoteChordProgression = (payload) => {
      if (isRemoteUpdateRef.current) return;
      isRemoteUpdateRef.current = true;
      const { chords } = payload || {};
      saveChordProgression(chords, true).finally(() => {
        isRemoteUpdateRef.current = false;
      });
    };

    const handleRemoteLickAdd = (payload) => {
      if (isRemoteUpdateRef.current) return;
      const { trackId, item } = payload || {};

      // Optimistically add the item immediately (Google Docs-like)
      if (trackId && item) {
        setTracks((prevTracks) =>
          prevTracks.map((track) =>
            track._id === trackId
              ? {
                  ...track,
                  items: [...(track.items || []), normalizeTimelineItem(item)],
                }
              : track
          )
        );
      }
    };

    const handleRemoteTimelineUpdate = (payload) => {
      if (isRemoteUpdateRef.current) return;
      const { itemId, customMidiEvents, isCustomized, updates = {} } =
        payload || {};

      if (!itemId) return;
      console.log("[Collaboration] Remote timeline update:", itemId);

      setTracks((prevTracks) =>
        prevTracks.map((track) => {
          const hasClip = (track.items || []).some(
            (item) => item._id === itemId
          );
          if (!hasClip) return track;

          return {
            ...track,
            items: (track.items || []).map((item) =>
              item._id === itemId
                ? normalizeTimelineItem({
                    ...item,
                    ...updates,
                    customMidiEvents:
                      customMidiEvents !== undefined
                        ? customMidiEvents
                        : item.customMidiEvents,
                    isCustomized:
                      isCustomized !== undefined
                        ? isCustomized
                        : item.isCustomized,
                  })
                : item
            ),
          };
        })
      );
    };

    const handleRemoteTimelineDelete = (payload) => {
      if (isRemoteUpdateRef.current) return;
      const { itemId } = payload || {};
      if (!itemId) return;
      console.log("[Collaboration] Remote timeline delete:", itemId);

      setTracks((prevTracks) =>
        prevTracks.map((track) => ({
          ...track,
          items: (track.items || []).filter((item) => item._id !== itemId),
        }))
      );
    };

    const handleRemoteTimelineBulkUpdate = (payload) => {
      if (isRemoteUpdateRef.current) return;
      const { items } = payload || {};
      if (!Array.isArray(items) || !items.length) return;
      console.log(
        "[Collaboration] Remote timeline bulk update:",
        items.map((item) => item._id)
      );

      setTracks((prevTracks) =>
        prevTracks.map((track) => {
          const updatedItems = (track.items || []).map((item) => {
            const incoming = items.find((entry) => entry._id === item._id);
            if (!incoming) return item;

            return normalizeTimelineItem({
              ...item,
              ...incoming,
            });
          });

          return {
            ...track,
            items: updatedItems,
          };
        })
      );
    };

    const handleRemoteSettingsUpdate = (payload) => {
      if (isRemoteUpdateRef.current) return;
      const {
        tempo,
        swingAmount,
        timeSignature,
        key,
        style,
        backingInstrumentId,
      } = payload || {};

      // Apply settings updates optimistically
      if (project) {
        const updates = {};
        if (tempo !== undefined) updates.tempo = tempo;
        if (swingAmount !== undefined) updates.swingAmount = swingAmount;
        if (timeSignature !== undefined) updates.timeSignature = timeSignature;
        if (key !== undefined) updates.key = key;
        if (style !== undefined) updates.style = style;
        if (backingInstrumentId !== undefined)
          updates.backingInstrumentId = backingInstrumentId;

        if (Object.keys(updates).length > 0) {
          setProject((prev) => (prev ? { ...prev, ...updates } : prev));

          // Update draft values if they exist
          if (tempo !== undefined) setTempoDraft(String(tempo));
          if (swingAmount !== undefined) setSwingDraft(String(swingAmount));
        }
      }
    };

    const handleRemoteTrackAdd = (payload) => {
      if (isRemoteUpdateRef.current) return;
      const { track } = payload || {};
      if (!track) return;
      console.log("[Collaboration] Remote track add received:", track?._id);

      const [normalizedTrack] =
        normalizeTracks([track], TRACK_COLOR_PALETTE) || [];
      if (!normalizedTrack) return;

      setTracks((prev) => {
        const exists = prev.some((t) => t._id === normalizedTrack._id);
        if (exists) {
          return prev.map((t) =>
            t._id === normalizedTrack._id ? { ...t, ...normalizedTrack } : t
          );
        }
        return [...prev, normalizedTrack];
      });
    };

    const handleRemoteTrackUpdate = (payload) => {
      if (isRemoteUpdateRef.current) return;
      const { trackId, updates } = payload || {};

      // Optimistically update track in local state
      if (trackId && updates) {
        setTracks((prevTracks) =>
          prevTracks.map((track) =>
            track._id === trackId ? { ...track, ...updates } : track
          )
        );
      }
    };

    const handleRemoteTrackDelete = (payload) => {
      if (isRemoteUpdateRef.current) return;
      const { trackId } = payload || {};

      // Optimistically remove track from local state
      if (trackId) {
        setTracks((prev) => prev.filter((t) => t._id !== trackId));
      }
    };

    const handleRemoteTimelinePositionUpdate = (payload) => {
      if (isRemoteUpdateRef.current) return;
      const { itemId, updates } = payload || {};

      if (!itemId || !updates) return;

      // Optimistically update timeline item position immediately (Google Docs-like)
      setTracks((prevTracks) =>
        prevTracks.map((track) => {
          const hasClip = (track.items || []).some(
            (item) => item._id === itemId
          );
          if (!hasClip) return track;

          const currentItem = (track.items || []).find(
            (item) => item._id === itemId
          );
          if (!currentItem) return track;

          // Check if update is needed
          const needsUpdate =
            (updates.startTime !== undefined &&
              currentItem.startTime !== updates.startTime) ||
            (updates.duration !== undefined &&
              currentItem.duration !== updates.duration) ||
            (updates.offset !== undefined &&
              currentItem.offset !== updates.offset);

          if (!needsUpdate) return track;

          // Apply updates optimistically
          const updatedItem = {
            ...currentItem,
            ...updates,
          };

          return {
            ...track,
            items: (track.items || []).map((item) =>
              item._id === itemId ? normalizeTimelineItem(updatedItem) : item
            ),
          };
        })
      );
    };

    const handleRemotePresence = (payload) => {
      const {
        type,
        collaborators: remoteCollaborators,
        userId: eventUserId,
      } = payload || {};

      const ensureCollaboratorEntry = (list, userId, profile, roleLabel) => {
        if (!userId) return;
        const exists = list.some(
          (entry) => String(entry.userId) === String(userId)
        );
        if (exists) return;
        list.push({
          userId,
          user: profile
            ? {
                _id: profile._id || profile.id || userId,
                displayName: profile.displayName || profile.username || "",
                username: profile.username,
                avatarUrl: profile.avatarUrl,
                email: profile.email,
              }
            : undefined,
          role: roleLabel,
          status: "accepted",
        });
      };

      const normalizeCollaborators = (list = []) => {
        const next = Array.isArray(list) ? [...list] : [];
        const ownerProfile = project?.creatorId;
        const ownerId = ownerProfile?._id || ownerProfile?.id;

        ensureCollaboratorEntry(next, ownerId, ownerProfile, "owner");
        ensureCollaboratorEntry(
          next,
          currentUserId,
          currentUserProfile,
          userRole || "collaborator"
        );

        return next;
      };

      if (type === "SYNC" || type === "JOIN") {
        if (remoteCollaborators) {
          setCollaborators(normalizeCollaborators(remoteCollaborators));
        }
      } else if (type === "LEAVE") {
        if (eventUserId) {
          setCollaborators((prev) =>
            prev.filter((c) => c.userId !== eventUserId)
          );
        }
      } else if (remoteCollaborators) {
        setCollaborators(normalizeCollaborators(remoteCollaborators));
      }
    };

    const handleRemoteConnection = (payload) => {
      const { connected } = payload || {};
      setIsConnected(connected);
    };

    const handleRemoteEditingActivity = (payload) => {
      if (isRemoteUpdateRef.current) return;
      const { userId, itemId, isEditing } = payload || {};

      if (!userId || !itemId) return;

      setActiveEditors((prev) => {
        const next = new Map(prev);

        if (isEditing) {
          // Find user info from collaborators
          const collaborator = collaborators.find((c) => c.userId === userId);
          if (collaborator) {
            next.set(itemId, {
              userId,
              userName:
                collaborator.user?.displayName ||
                collaborator.user?.username ||
                "Someone",
              avatarUrl: collaborator.user?.avatarUrl,
            });
          }
        } else {
          // Remove editing indicator
          const current = next.get(itemId);
          if (current && current.userId === userId) {
            next.delete(itemId);
          }
        }

        return next;
      });
    };

    const handleRemoteSnapshot = (snapshot) => {
      if (!snapshot) {
        if (typeof refreshProjectRef.current === "function") {
          refreshProjectRef.current(false);
        }
        return;
      }

      const { project: snapshotProject, tracks: snapshotTracks } = snapshot;

      if (snapshotProject) {
        setProject((prev) => ({
          ...(prev || {}),
          ...snapshotProject,
        }));

        if (snapshotProject.chordProgression) {
          setChordProgression(
            hydrateChordProgression(snapshotProject.chordProgression)
          );
        }

        if (snapshotProject.tempo !== undefined) {
          setTempoDraft(String(snapshotProject.tempo));
        }

        if (snapshotProject.swingAmount !== undefined) {
          setSwingDraft(String(snapshotProject.swingAmount));
        }
      }

      if (Array.isArray(snapshotTracks)) {
        const normalizedTracks = normalizeTracks(
          snapshotTracks,
          TRACK_COLOR_PALETTE
        );
        setTracks(normalizedTracks);
      } else if (typeof refreshProjectRef.current === "function") {
        refreshProjectRef.current(false);
      }
    };

    const unsubscribers = [
      collabChannel.on(
        "project:remote:chordProgression",
        handleRemoteChordProgression
      ),
      collabChannel.on("project:remote:lickAdd", handleRemoteLickAdd),
      collabChannel.on(
        "project:remote:timelineUpdate",
        handleRemoteTimelineUpdate
      ),
      collabChannel.on(
        "project:remote:timelineDelete",
        handleRemoteTimelineDelete
      ),
      collabChannel.on(
        "project:remote:settingsUpdate",
        handleRemoteSettingsUpdate
      ),
      collabChannel.on("project:remote:trackAdd", handleRemoteTrackAdd),
      collabChannel.on("project:remote:trackUpdate", handleRemoteTrackUpdate),
      collabChannel.on("project:remote:trackDelete", handleRemoteTrackDelete),
      collabChannel.on(
        "project:remote:timelineBulkUpdate",
        handleRemoteTimelineBulkUpdate
      ),
      collabChannel.on(
        "project:remote:timelinePositionUpdate",
        handleRemoteTimelinePositionUpdate
      ),
      collabChannel.on("project:remote:presence", handleRemotePresence),
      collabChannel.on("project:remote:connection", handleRemoteConnection),
      collabChannel.on(
        "project:remote:editingActivity",
        handleRemoteEditingActivity
      ),
      collabChannel.on("project:remote:snapshot", handleRemoteSnapshot),
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe && unsubscribe());
    };
  }, [
    collaborators,
    setTracks,
    setChordProgression,
    saveChordProgression,
    setTempoDraft,
    setSwingDraft,
    setProject,
    refreshProjectRef,
    project?.creatorId?._id,
    currentUserId,
    userRole,
    currentUserProfile,
    setCollaborators,
    setActiveEditors,
    setIsConnected,
    isRemoteUpdateRef,
  ]);
};

