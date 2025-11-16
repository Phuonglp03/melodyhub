import ContentReport from '../models/ContentReport.js';
import Post from '../models/Post.js';
import mongoose from 'mongoose';

/**
 * Report a post
 * POST /api/reports/posts/:postId
 */
export const reportPost = async (req, res) => {
  try {
    const { postId } = req.params;
    const { reason, description } = req.body;
    const reporterId = req.userId;

    // Validate postId
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid post ID',
      });
    }

    // Check if post exists
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    // Check if user is trying to report their own post
    const postAuthorId = post.userId.toString();
    if (postAuthorId === reporterId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot report your own post',
      });
    }

    // Validate reason
    const validReasons = ['spam', 'inappropriate', 'copyright', 'harassment', 'other'];
    if (!reason || !validReasons.includes(reason)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reason. Must be one of: spam, inappropriate, copyright, harassment, other',
      });
    }

    // Check if user has already reported this post
    const existingReport = await ContentReport.findOne({
      reporterId,
      targetContentType: 'post',
      targetContentId: postId,
      status: 'pending',
    });

    if (existingReport) {
      return res.status(400).json({
        success: false,
        message: 'You have already reported this post',
      });
    }

    // Create report
    const report = new ContentReport({
      reporterId,
      targetContentType: 'post',
      targetContentId: postId,
      reason,
      description: description || '',
      status: 'pending',
    });

    await report.save();

    res.status(201).json({
      success: true,
      message: 'Post reported successfully',
      data: report,
    });
  } catch (error) {
    console.error('Error reporting post:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to report post',
    });
  }
};

/**
 * Get reports for a specific post (admin only)
 * GET /api/reports/posts/:postId
 */
export const getPostReports = async (req, res) => {
  try {
    const { postId } = req.params;

    // Validate postId
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid post ID',
      });
    }

    // Check if post exists
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    // Get all reports for this post
    const reports = await ContentReport.find({
      targetContentType: 'post',
      targetContentId: postId,
    })
      .populate('reporterId', 'username displayName avatarUrl')
      .populate('resolvedBy', 'username displayName')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: reports,
    });
  } catch (error) {
    console.error('Error getting post reports:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get post reports',
    });
  }
};

/**
 * Check if current user has reported a post
 * GET /api/reports/posts/:postId/check
 */
export const checkPostReport = async (req, res) => {
  try {
    const { postId } = req.params;
    const reporterId = req.userId;

    // Validate postId
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid post ID',
      });
    }

    // Check if user has reported this post
    const report = await ContentReport.findOne({
      reporterId,
      targetContentType: 'post',
      targetContentId: postId,
    });

    res.status(200).json({
      success: true,
      data: {
        hasReported: !!report,
        report: report || null,
      },
    });
  } catch (error) {
    console.error('Error checking post report:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to check post report',
    });
  }
};

