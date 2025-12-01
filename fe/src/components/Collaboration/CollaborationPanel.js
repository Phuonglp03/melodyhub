import React from "react";
import { FaUserPlus } from "react-icons/fa";
import CollaboratorAvatars from "../CollaboratorAvatars";

/**
 * CollaborationPanel - Panel showing collaborators and invite button
 *
 * Props:
 * - collaborators: Array - list of collaborators
 * - currentUserId: string - current user's ID
 * - activeEditors: Map - map of active editors by itemId
 * - isConnected: boolean - whether connection is active
 * - onInvite: () => void - callback to open invite modal
 * - className?: string - optional custom classes
 */
const CollaborationPanel = ({
  collaborators = [],
  currentUserId,
  activeEditors = new Map(),
  isConnected = false,
  onInvite,
  className = "",
}) => {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {isConnected && (
        <CollaboratorAvatars
          collaborators={collaborators}
          currentUserId={currentUserId}
          activeEditors={activeEditors}
        />
      )}
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
