import Post from '../models/Post.js';
import User from '../models/User.js';

// Create a new post
export const createPost = async (req, res) => {
  try {
    const { userId, postType, textContent, contentId, contentType, originalPostId } = req.body;

    // Validate required fields
    if (!userId || !postType) {
      return res.status(400).json({
        success: false,
        message: 'userId and postType are required'
      });
    }

    // Validate postType enum
    const validPostTypes = ['status_update', 'new_lick', 'new_project', 'shared_post'];
    if (!validPostTypes.includes(postType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid postType. Must be one of: status_update, new_lick, new_project, shared_post'
      });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Validate contentId and contentType for specific post types
    if ((postType === 'new_lick' || postType === 'new_project') && (!contentId || !contentType)) {
      return res.status(400).json({
        success: false,
        message: 'contentId and contentType are required for new_lick and new_project posts'
      });
    }

    // Validate contentType enum if provided
    if (contentType && !['lick', 'project'].includes(contentType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid contentType. Must be one of: lick, project'
      });
    }

    // Create new post
    const newPost = new Post({
      userId,
      postType,
      textContent,
      contentId,
      contentType,
      originalPostId,
      moderationStatus: 'approved' // Default to approved
    });

    const savedPost = await newPost.save();

    // Populate user information for response
    const populatedPost = await Post.findById(savedPost._id)
      .populate('userId', 'username displayName avatarUrl')
      .populate('originalPostId', 'textContent postType')
      .lean();

    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      data: populatedPost
    });

  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get all posts with pagination
export const getPosts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const posts = await Post.find({ moderationStatus: 'approved' })
      .populate('userId', 'username displayName avatarUrl')
      .populate('originalPostId', 'textContent postType')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalPosts = await Post.countDocuments({ moderationStatus: 'approved' });
    const totalPages = Math.ceil(totalPosts / limit);

    res.status(200).json({
      success: true,
      data: {
        posts,
        pagination: {
          currentPage: page,
          totalPages,
          totalPosts,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get posts by user ID
export const getPostsByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const posts = await Post.find({ 
      userId, 
      moderationStatus: 'approved' 
    })
      .populate('userId', 'username displayName avatarUrl')
      .populate('originalPostId', 'textContent postType')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalPosts = await Post.countDocuments({ 
      userId, 
      moderationStatus: 'approved' 
    });
    const totalPages = Math.ceil(totalPosts / limit);

    res.status(200).json({
      success: true,
      data: {
        posts,
        pagination: {
          currentPage: page,
          totalPages,
          totalPosts,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Error fetching user posts:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get post by ID
export const getPostById = async (req, res) => {
  try {
    const { postId } = req.params;

    const post = await Post.findById(postId)
      .populate('userId', 'username displayName avatarUrl')
      .populate('originalPostId', 'textContent postType')
      .lean();

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    res.status(200).json({
      success: true,
      data: post
    });

  } catch (error) {
    console.error('Error fetching post:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Update post
export const updatePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const { textContent, postType } = req.body;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Update allowed fields
    if (textContent !== undefined) post.textContent = textContent;
    if (postType !== undefined) {
      const validPostTypes = ['status_update', 'new_lick', 'new_project', 'shared_post'];
      if (!validPostTypes.includes(postType)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid postType'
        });
      }
      post.postType = postType;
    }

    const updatedPost = await post.save();

    const populatedPost = await Post.findById(updatedPost._id)
      .populate('userId', 'username displayName avatarUrl')
      .populate('originalPostId', 'textContent postType')
      .lean();

    res.status(200).json({
      success: true,
      message: 'Post updated successfully',
      data: populatedPost
    });

  } catch (error) {
    console.error('Error updating post:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Delete post
export const deletePost = async (req, res) => {
  try {
    const { postId } = req.params;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    await Post.findByIdAndDelete(postId);

    res.status(200).json({
      success: true,
      message: 'Post deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};
