import express from 'express';
import { reportPost, getPostReports, checkPostReport } from '../controllers/reportController.js';
import middlewareController from '../middleware/auth.js';

const router = express.Router();
const { verifyToken } = middlewareController;

// Report a post
router.post('/posts/:postId', verifyToken, reportPost);

// Get reports for a post (admin only - can add admin middleware later)
router.get('/posts/:postId', verifyToken, getPostReports);

// Check if current user has reported a post
router.get('/posts/:postId/check', verifyToken, checkPostReport);

export default router;

