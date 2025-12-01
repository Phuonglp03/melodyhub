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
  const onlineCount = allCollaborators.length;
  const otherCollaborators = allCollaborators.filter(
    (c) => c.userId !== currentUserId
  );
  const primaryCollaborator = otherCollaborators[0];
  const additionalCount = Math.max(onlineCount - 1, 0);

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

          {isConnected && primaryCollaborator && (
            <div className="flex items-center gap-1">
              <div className="w-5 h-5 rounded-full border border-gray-800 bg-gray-800 overflow-hidden flex items-center justify-center">
                {primaryCollaborator.user?.avatarUrl ? (
                  <img
                    src={primaryCollaborator.user.avatarUrl}
                    alt={
                      primaryCollaborator.user.displayName ||
                      primaryCollaborator.user.username
                    }
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <FaUser size={9} className="text-gray-300" />
                )}
              </div>
              {additionalCount > 0 && (
                <span className="text-[10px] text-gray-400 font-semibold">
                  +{additionalCount}
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
