import express from 'express';
import {
  createPost,
  getPosts,
  getPostsByUser,
  getPostById,
  updatePost,
  deletePost
} from '../controllers/postController.js';
import { handlePostMediaUpload, handleUploadError } from '../middleware/file.js';

const router = express.Router();

// POST /api/posts - Create a new post with media upload
router.post('/', handlePostMediaUpload, handleUploadError, createPost);

// GET /api/posts - Get all posts with pagination
router.get('/', getPosts);

// GET /api/posts/user/:userId - Get posts by user ID
router.get('/user/:userId', getPostsByUser);

// GET /api/posts/:postId - Get post by ID
router.get('/:postId', getPostById);

// PUT /api/posts/:postId - Update post with media upload
router.put('/:postId', handlePostMediaUpload, handleUploadError, updatePost);

// DELETE /api/posts/:postId - Delete post
router.delete('/:postId', deletePost);

export default router;
