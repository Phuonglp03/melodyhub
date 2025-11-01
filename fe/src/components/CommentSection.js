import React, { useState, useEffect } from 'react';
import { getLickComments, addLickComment } from '../services/user/lickService';

const CommentSection = ({ lickId, currentUser }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchComments = async () => {
      try {
        const response = await getLickComments(lickId);
        if (response.success) {
          setComments(response.data);
        } else {
          setError('Failed to fetch comments');
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchComments();
  }, [lickId]);

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      const response = await addLickComment(lickId, {
        userId: currentUser.id,
        comment: newComment,
      });

      if (response.success) {
        setComments((prev) => [response.data, ...prev]);
        setNewComment('');
      } else {
        setError('Failed to post comment');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return <div>Loading comments...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div>
      <h3 className="text-xl font-semibold text-white mb-4">Comments</h3>
      <form onSubmit={handleCommentSubmit} className="mb-6">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          rows={3}
          className="w-full bg-gray-800 border border-gray-700 rounded-md px-4 py-2 text-white"
        />
        <button type="submit" className="mt-2 bg-orange-600 text-white px-4 py-2 rounded-md">
          Post Comment
        </button>
      </form>
      <div className="space-y-4">
        {comments.map((comment) => (
          <div key={comment.comment_id} className="flex space-x-4">
            <img src={comment.avatar_url} alt={comment.display_name} className="w-10 h-10 rounded-full" />
            <div>
              <p className="font-semibold text-white">{comment.display_name}</p>
              <p className="text-gray-400">{comment.comment}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CommentSection;
