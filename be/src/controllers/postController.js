import Post from '../models/Post.js';
import User from '../models/User.js';
import PostLike from '../models/PostLike.js';
import PostComment from '../models/PostComment.js';
import { uploadToCloudinary } from '../middleware/file.js';

// Helper function to detect media type from mimetype
const detectMediaType = (mimetype) => {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype.startsWith('audio/')) return 'audio';
  return 'unknown';
};

// Parse JSON only when input is a JSON string; otherwise return as-is
const parseJsonIfString = (value) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) return value;
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    return value;
  }
};

// Create a new post
export const createPost = async (req, res) => {
  try {
    // Get userId from token (set by verifyToken middleware) - more secure than from body
    const userId = req.userId;
    
    // Debug logging
    console.log('[createPost] Request body:', JSON.stringify(req.body, null, 2));
    console.log('[createPost] Request files:', req.files ? req.files.length : 0);
    console.log('[createPost] Content-Type:', req.headers['content-type']);
    console.log('[createPost] UserId from token:', userId);
    
    const { postType, textContent } = req.body;
    const linkPreviewInput = parseJsonIfString(req.body.linkPreview);
    
    // Parse originalPostId if it's a string
    const originalPostId = req.body.originalPostId;

    // Validate userId from token
    if (!userId) {
      console.error('[createPost] Missing userId from token - authentication required');
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please login to create a post.'
      });
    }
    
    // Validate required fields
    if (!postType) {
      console.error('[createPost] Missing postType in request body');
      return res.status(400).json({
        success: false,
        message: 'postType is required',
        received: { postType: req.body.postType }
      });
    }

    // Validate postType enum
    const validPostTypes = ['status_update', 'shared_post'];
    if (!validPostTypes.includes(postType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid postType. Must be one of: status_update, shared_post'
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

    // Validate originalPostId exists if provided (for shared_post)
    if (postType === 'shared_post' && !originalPostId) {
      return res.status(400).json({
        success: false,
        message: 'originalPostId is required for shared_post type'
      });
    }

    if (originalPostId) {
      const originalPost = await Post.findById(originalPostId);
      if (!originalPost) {
        return res.status(404).json({
          success: false,
          message: 'Original post not found'
        });
      }
    }

    let mediaArray = [];
    if (req.files && req.files.length > 0) {
      // Upload each file to Cloudinary
      for (const file of req.files) {
        const mediaType = detectMediaType(file.mimetype);
        if (mediaType === 'image') {
          return res.status(400).json({
            success: false,
            message: 'Không cho phép upload hình ảnh cho bài đăng này'
          });
        }
        const folder = `melodyhub/posts/${mediaType}`;
        const resourceType = mediaType === 'video' ? 'video' : 'video'; // audio dùng resource_type 'video' trên Cloudinary
        
        let result;
        try {
          result = await uploadToCloudinary(file.buffer, folder, resourceType);
        } catch (e) {
          return res.status(400).json({ success: false, message: 'Upload media thất bại', error: e.message });
        }
        
        mediaArray.push({
          url: result.secure_url,
          type: mediaType
        });
      }
    } else if (req.body.media) {
      // If media is provided as array in body (for external URLs)
      const mediaBody = parseJsonIfString(req.body.media);
      if (Array.isArray(mediaBody)) {
        for (const item of mediaBody) {
          if (!item.url || !item.type) {
            return res.status(400).json({
              success: false,
              message: 'Each media item must have url and type'
            });
          }
          if (!['video', 'audio'].includes(item.type)) {
            return res.status(400).json({
              success: false,
              message: 'Media type must be one of: video, audio'
            });
          }
          if (item.type === 'image') {
            return res.status(400).json({
              success: false,
              message: 'Không cho phép ảnh trong media'
            });
          }
          mediaArray.push(item);
        }
      }
    }

    // Create new post
    const newPost = new Post({
      userId,
      postType,
      textContent,
      linkPreview: linkPreviewInput,
      media: mediaArray.length > 0 ? mediaArray : undefined,
      originalPostId,
      moderationStatus: 'approved' // Default to approved
    });

    const savedPost = await newPost.save();

    // Populate user information for response
    const populatedPost = await Post.findById(savedPost._id)
      .populate('userId', 'username displayName avatarUrl')
      .populate('originalPostId')
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
    // Include legacy posts that may not have moderationStatus field
    const visibilityFilter = {
      $or: [
        { moderationStatus: 'approved' },
        { moderationStatus: { $exists: false } },
      ],
    };

    const posts = await Post.find(visibilityFilter)
      .populate('userId', 'username displayName avatarUrl')
      .populate('originalPostId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalPosts = await Post.countDocuments(visibilityFilter);
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

    const visibilityFilter = {
      $or: [
        { moderationStatus: 'approved' },
        { moderationStatus: { $exists: false } },
      ],
    };

    const posts = await Post.find({ 
      userId,
      ...visibilityFilter,
    })
      .populate('userId', 'username displayName avatarUrl')
      .populate('originalPostId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalPosts = await Post.countDocuments({ 
      userId,
      ...visibilityFilter,
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
      .populate('originalPostId')
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
    const { textContent, linkPreview, postType } = req.body;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Update allowed fields
    if (textContent !== undefined) post.textContent = textContent;
    if (linkPreview !== undefined) {
      post.linkPreview = typeof linkPreview === 'string' ? JSON.parse(linkPreview) : linkPreview;
    }
    
    // Handle uploaded files
    if (req.files && req.files.length > 0) {
      let mediaArray = [];
      // Upload each file to Cloudinary
      for (const file of req.files) {
        const mediaType = detectMediaType(file.mimetype);
        if (mediaType === 'image') {
          return res.status(400).json({
            success: false,
            message: 'Không cho phép upload hình ảnh cho bài đăng này'
          });
        }
        const folder = `melodyhub/posts/${mediaType}`;
        const resourceType = mediaType === 'video' ? 'video' : 'video'; // audio dùng resource_type 'video' trên Cloudinary
        
        const result = await uploadToCloudinary(file.buffer, folder, resourceType);
        
        mediaArray.push({
          url: result.secure_url,
          type: mediaType
        });
      }
      post.media = mediaArray;
    } else if (req.body.media !== undefined) {
      // Validate media array if provided
      if (Array.isArray(req.body.media)) {
        for (const item of req.body.media) {
          if (!item.url || !item.type) {
            return res.status(400).json({
              success: false,
              message: 'Each media item must have url and type'
            });
          }
          if (!['video', 'audio'].includes(item.type)) {
            return res.status(400).json({
              success: false,
              message: 'Media type must be one of: video, audio'
            });
          }
          if (item.type === 'image') {
            return res.status(400).json({
              success: false,
              message: 'Không cho phép ảnh trong media'
            });
          }
        }
        post.media = req.body.media;
      } else if (req.body.media === null) {
        post.media = [];
      }
    }
    
    if (postType !== undefined) {
      const validPostTypes = ['status_update', 'shared_post'];
      if (!validPostTypes.includes(postType)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid postType. Must be one of: status_update, shared_post'
        });
      }
      post.postType = postType;
    }

    const updatedPost = await post.save();

    const populatedPost = await Post.findById(updatedPost._id)
      .populate('userId', 'username displayName avatarUrl')
      .populate('originalPostId')
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

// Like a post (idempotent)
export const likePost = async (req, res) => {
  try {
    const userId = req.userId;
    const { postId } = req.params;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    try {
      const like = await PostLike.create({ postId, userId });
      return res.status(201).json({ success: true, liked: true, data: { id: like._id } });
    } catch (err) {
      if (err && err.code === 11000) {
        return res.status(200).json({ success: true, liked: true, message: 'Already liked' });
      }
      throw err;
    }
  } catch (error) {
    console.error('likePost error:', error);
    return res.status(500).json({ success: false, message: 'Failed to like post' });
  }
};

// Unlike a post (idempotent)
export const unlikePost = async (req, res) => {
  try {
    const userId = req.userId;
    const { postId } = req.params;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const deleted = await PostLike.findOneAndDelete({ postId, userId });
    if (!deleted) {
      return res.status(200).json({ success: true, liked: false, message: 'Not liked yet' });
    }
    return res.status(200).json({ success: true, liked: false });
  } catch (error) {
    console.error('unlikePost error:', error);
    return res.status(500).json({ success: false, message: 'Failed to unlike post' });
  }
};

// Get post stats: likes count and top-level comments count
export const getPostStats = async (req, res) => {
  try {
    const { postId } = req.params;
    const post = await Post.findById(postId).lean();
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }
    const [likesCount, commentsCount] = await Promise.all([
      PostLike.countDocuments({ postId }),
      PostComment.countDocuments({ postId, parentCommentId: { $exists: false } })
    ]);
    return res.status(200).json({ success: true, data: { likesCount, commentsCount } });
  } catch (error) {
    console.error('getPostStats error:', error);
    return res.status(500).json({ success: false, message: 'Failed to get post stats' });
  }
};
