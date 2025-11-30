// CollaboratorAvatars - Phase 4: UI Feedback - Presence Indicators
// Displays active collaborators in the project header
import React from "react";
import { FaUser } from "react-icons/fa";

export default function CollaboratorAvatars({ collaborators = [], currentUserId }) {
  if (!collaborators || collaborators.length === 0) {
    return null;
  }

  // Filter out current user
  const otherCollaborators = collaborators.filter(
    (c) => c.userId !== currentUserId
  );

  if (otherCollaborators.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900/60 border border-gray-800 rounded-full">
      <span className="text-[10px] uppercase text-gray-400 mr-1">
        {otherCollaborators.length} {otherCollaborators.length === 1 ? "collaborator" : "collaborators"}
      </span>
      <div className="flex items-center -space-x-2">
        {otherCollaborators.slice(0, 5).map((collab) => (
          <div
            key={collab.userId}
            className="relative group"
            title={collab.user?.displayName || collab.user?.username || "Collaborator"}
          >
            {collab.user?.avatarUrl ? (
              <img
                src={collab.user.avatarUrl}
                alt={collab.user.displayName || collab.user.username}
                className="w-6 h-6 rounded-full border-2 border-gray-800 bg-gray-700 object-cover"
              />
            ) : (
              <div className="w-6 h-6 rounded-full border-2 border-gray-800 bg-indigo-600 flex items-center justify-center">
                <FaUser size={10} className="text-white" />
              </div>
            )}
            {/* Online indicator */}
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-gray-900 rounded-full"></div>
          </div>
        ))}
        {otherCollaborators.length > 5 && (
          <div className="w-6 h-6 rounded-full border-2 border-gray-800 bg-gray-700 flex items-center justify-center">
            <span className="text-[8px] text-gray-300 font-semibold">
              +{otherCollaborators.length - 5}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

