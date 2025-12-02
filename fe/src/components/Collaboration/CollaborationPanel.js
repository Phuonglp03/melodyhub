import React from "react";
import { FaUserPlus, FaUser } from "react-icons/fa";

/**
 * CollaborationPanel - Panel showing collaborators and invite button
 *
 * Props:
 * - collaborators: Array - list of collaborators
 * - currentUserId: string - current user's ID
 * - isConnected: boolean - whether connection is active
 * - onInvite: () => void - callback to open invite modal
 * - className?: string - optional custom classes
 */
const CollaborationPanel = ({
  collaborators = [],
  currentUserId,
  isConnected = false,
  onInvite,
  className = "",
}) => {
  const allCollaborators = collaborators || [];
  // Filter out current user to show only other collaborators
  const otherCollaborators = allCollaborators.filter((c) => {
    // Handle various collaborator structures - userId can be object with _id or direct ID
    const collaboratorId =
      c.userId?._id || c.userId || c._id || c.user?._id || c.user?.id;
    return collaboratorId && String(collaboratorId) !== String(currentUserId);
  });
  const onlineCount = otherCollaborators.length;
  // Show all collaborators, but limit to first 5 for UI space
  const visibleCollaborators = otherCollaborators.slice(0, 5);
  const remainingCount = Math.max(onlineCount - 5, 0);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Connection Status Indicator */}
      <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-900/60 border border-gray-800 rounded-full">
        <div
          className={`w-2 h-2 rounded-full ${
            isConnected ? "bg-green-500 animate-pulse" : "bg-gray-500"
          }`}
          title={isConnected ? "Connected" : "Connecting..."}
        />
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase text-gray-400">
            {isConnected
              ? onlineCount > 0
                ? `Live · ${onlineCount} ${
                    onlineCount === 1 ? "online" : "online"
                  }`
                : "Live"
              : "Offline"}
          </span>

          {isConnected && onlineCount > 0 && (
            <div className="flex items-center gap-1">
              {visibleCollaborators.map((collaborator, index) => {
                // Handle various collaborator structures
                const collaboratorId =
                  collaborator.userId?._id ||
                  collaborator.userId ||
                  collaborator._id ||
                  collaborator.user?._id ||
                  collaborator.user?.id;
                return (
                  <div
                    key={collaboratorId || index}
                    className="w-5 h-5 rounded-full border border-gray-800 bg-gray-800 overflow-hidden flex items-center justify-center -ml-1 first:ml-0"
                    title={
                      collaborator.user?.displayName ||
                      collaborator.user?.username ||
                      "Collaborator"
                    }
                  >
                    {collaborator.user?.avatarUrl ? (
                      <img
                        src={collaborator.user.avatarUrl}
                        alt={
                          collaborator.user.displayName ||
                          collaborator.user.username
                        }
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <FaUser size={9} className="text-gray-300" />
                    )}
                  </div>
                );
              })}
              {remainingCount > 0 && (
                <span className="text-[10px] text-gray-400 font-semibold ml-1">
                  +{remainingCount}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onInvite}
        className="px-3 py-1.5 bg-gray-900/60 border border-gray-800 rounded-full text-xs text-white hover:bg-gray-800 transition-colors flex items-center gap-2"
        title="Invite collaborator"
      >
        <FaUserPlus size={12} />
        <span>Invite</span>
      </button>
    </div>
  );
};

export default CollaborationPanel;
