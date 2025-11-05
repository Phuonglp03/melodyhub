import express from 'express';
import {
  createPost,
  getPosts,
  getPostsByUser,
  getPostById,
  updatePost,
  deletePost,
  likePost,
  unlikePost,
  getPostStats
} from '../controllers/postController.js';
import middlewareController from '../middleware/auth.js';
import { 
  createPostComment,
  getPostComments,
  deletePostComment
} from '../controllers/postCommentController.js';
import { handlePostMediaUpload, handleUploadError } from '../middleware/file.js';

const router = express.Router();
const { verifyToken } = middlewareController;

// POST /api/posts - Create a new post with media upload
router.post('/', handlePostMediaUpload, handleUploadError, createPost);

// GET /api/posts - Get all posts with pagination
router.get('/', getPosts);

// GET /api/posts/user/:userId - Get posts by user ID
router.get('/user/:userId', getPostsByUser);

// GET /api/posts/:postId - Get post by ID
router.get('/:postId', getPostById);

// GET /api/posts/:postId/stats - likesCount & commentsCount
router.get('/:postId/stats', getPostStats);

// PUT /api/posts/:postId - Update post with media upload
router.put('/:postId', handlePostMediaUpload, handleUploadError, updatePost);

// DELETE /api/posts/:postId - Delete post
router.delete('/:postId', deletePost);

// POST /api/posts/:postId/like - like a post
router.post('/:postId/like', verifyToken, likePost);

// DELETE /api/posts/:postId/like - unlike a post
router.delete('/:postId/like', verifyToken, unlikePost);

// COMMENTS
// POST /api/posts/:postId/comments - create comment
router.post('/:postId/comments', verifyToken, createPostComment);

// GET /api/posts/:postId/comments - list comments (parent or replies via ?parentCommentId=)
router.get('/:postId/comments', getPostComments);

// DELETE /api/posts/:postId/comments/:commentId - delete comment (owner/admin)
router.delete('/:postId/comments/:commentId', verifyToken, deletePostComment);

export default router;
