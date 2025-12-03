import express from 'express';
import { reportPost, getPostReports, checkPostReport, getAllReports, adminRestorePost, adminDeletePost } from '../../controllers/admin/reportController.js';
import { getReportLimitSetting, updateReportLimitSetting } from '../../controllers/admin/reportSettingsController.js';
import { verifyToken, isAdmin } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permissions.js';

const router = express.Router();

// Get all reports (admin only) - MUST be before parameterized routes
// Require handle_support permission (Super Admin và User Support)
router.get('/all', verifyToken, isAdmin, requirePermission('handle_support'), getAllReports);

// Report settings (admin only)
// Require handle_support permission
router
  .route('/settings/report-limit')
  .get(verifyToken, isAdmin, requirePermission('handle_support'), getReportLimitSetting)
  .put(verifyToken, isAdmin, requirePermission('handle_support'), updateReportLimitSetting);

// Report a post
router.post('/posts/:postId', verifyToken, reportPost);

// Check if current user has reported a post (MUST be before /posts/:postId)
router.get('/posts/:postId/check', verifyToken, checkPostReport);

// Admin restore post (admin only) - MUST be before /posts/:postId
// Require handle_support permission
router.post('/posts/:postId/restore', verifyToken, isAdmin, requirePermission('handle_support'), adminRestorePost);

// Admin delete post (admin only) - MUST be before GET /posts/:postId
// Require handle_support permission
router.delete('/posts/:postId', verifyToken, isAdmin, requirePermission('handle_support'), adminDeletePost);

// Get reports for a post (admin only - can add admin middleware later)
router.get('/posts/:postId', verifyToken, getPostReports);

export default router;

