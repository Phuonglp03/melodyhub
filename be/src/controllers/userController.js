import User from '../models/User.js';
import Post from '../models/Post.js';
import UserFollow from '../models/UserFollow.js';
import cloudinary, { uploadImage } from '../config/cloudinary.js';

// Get current user profile (authenticated user)
export const getCurrentUserProfile = async (req, res) => {
  try {
    const userId = req.userId; // From auth middleware

    const user = await User.findById(userId).select('-passwordHash');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user's post count
    const postCount = await Post.countDocuments({ 
      userId,
      $or: [
        { moderationStatus: 'approved' },
        { moderationStatus: { $exists: false } },
      ],
    });

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          displayName: user.displayName,
          birthday: user.birthday,
          gender: user.gender,
          location: user.location,
          bio: user.bio,
          avatarUrl: user.avatarUrl,
          roleId: user.roleId,
          isActive: user.isActive,
          verifiedEmail: user.verifiedEmail,
          totalLikesReceived: user.totalLikesReceived,
          totalCommentsReceived: user.totalCommentsReceived,
          followersCount: user.followersCount,
          followingCount: user.followingCount,
          emailNotifications: user.emailNotifications,
          pushNotifications: user.pushNotifications,
          privacyProfile: user.privacyProfile,
          theme: user.theme,
          language: user.language,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        },
        postCount
      }
    });

  } catch (error) {
    console.error('Error fetching current user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get other user profile by user ID
export const getUserProfileById = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.userId; // From auth middleware (optional)

    const user = await User.findById(userId).select('-passwordHash -email');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check privacy settings
    let canViewProfile = true;
    let isFollowing = false;

    if (user.privacyProfile === 'private') {
      canViewProfile = false;
    } else if (user.privacyProfile === 'followers') {
      if (currentUserId) {
        const followRelation = await UserFollow.findOne({
          followerId: currentUserId,
          followingId: userId
        });
        isFollowing = !!followRelation;
        canViewProfile = isFollowing;
      } else {
        canViewProfile = false;
      }
    }

    if (!canViewProfile) {
      return res.status(403).json({
        success: false,
        message: 'This profile is private'
      });
    }

    // Get user's post count
    const postCount = await Post.countDocuments({ 
      userId,
      $or: [
        { moderationStatus: 'approved' },
        { moderationStatus: { $exists: false } },
      ],
    });

    // Check if current user is following this user
    if (currentUserId && currentUserId !== userId) {
      const followRelation = await UserFollow.findOne({
        followerId: currentUserId,
        followingId: userId
      });
      isFollowing = !!followRelation;
    }

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          username: user.username,
          displayName: user.displayName,
          birthday: user.birthday,
          bio: user.bio,
          avatarUrl: user.avatarUrl,
          verifiedEmail: user.verifiedEmail,
          totalLikesReceived: user.totalLikesReceived,
          totalCommentsReceived: user.totalCommentsReceived,
          followersCount: user.followersCount,
          followingCount: user.followingCount,
          privacyProfile: user.privacyProfile,
          createdAt: user.createdAt
        },
        postCount,
        isFollowing
      }
    });

  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get other user profile by username
export const getUserProfileByUsername = async (req, res) => {
  try {
    const { username } = req.params;
    const currentUserId = req.userId; // From auth middleware (optional)

    const user = await User.findOne({ username }).select('-passwordHash -email');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check privacy settings
    let canViewProfile = true;
    let isFollowing = false;

    if (user.privacyProfile === 'private') {
      canViewProfile = false;
    } else if (user.privacyProfile === 'followers') {
      if (currentUserId) {
        const followRelation = await UserFollow.findOne({
          followerId: currentUserId,
          followingId: user._id
        });
        isFollowing = !!followRelation;
        canViewProfile = isFollowing;
      } else {
        canViewProfile = false;
      }
    }

    if (!canViewProfile) {
      return res.status(403).json({
        success: false,
        message: 'This profile is private'
      });
    }

    // Get user's post count
    const postCount = await Post.countDocuments({ 
      userId: user._id,
      $or: [
        { moderationStatus: 'approved' },
        { moderationStatus: { $exists: false } },
      ],
    });

    // Check if current user is following this user
    if (currentUserId && currentUserId !== user._id.toString()) {
      const followRelation = await UserFollow.findOne({
        followerId: currentUserId,
        followingId: user._id
      });
      isFollowing = !!followRelation;
    }

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          username: user.username,
          displayName: user.displayName,
          birthday: user.birthday,
          bio: user.bio,
          avatarUrl: user.avatarUrl,
          verifiedEmail: user.verifiedEmail,
          totalLikesReceived: user.totalLikesReceived,
          totalCommentsReceived: user.totalCommentsReceived,
          followersCount: user.followersCount,
          followingCount: user.followingCount,
          privacyProfile: user.privacyProfile,
          createdAt: user.createdAt
        },
        postCount,
        isFollowing
      }
    });

  } catch (error) {
    console.error('Error fetching user profile by username:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Update user profile
export const updateUserProfile = async (req, res) => {
  try {
    const userId = req.userId; // From auth middleware
    
    console.log('📝 Update profile - Content-Type:', req.headers['content-type']);
    console.log('📝 Update profile - req.file:', req.file ? 'File exists' : 'No file');
    console.log('📝 Update profile - req.body keys:', Object.keys(req.body || {}));

    // Parse body fields (có thể từ JSON hoặc multipart)
    const { displayName, bio, birthday, avatarUrl, privacyProfile, theme, language, gender, location } = req.body;

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update allowed fields
    if (displayName !== undefined) user.displayName = displayName;
    if (bio !== undefined) user.bio = bio;
    if (birthday !== undefined) user.birthday = birthday ? new Date(birthday) : undefined;
    
    // Xử lý avatar: ưu tiên file upload (Cloudinary), sau đó mới đến URL string
    if (req.file) {
      // File đã được upload lên Cloudinary bởi multer-storage-cloudinary
      // CloudinaryStorage trả về file object với path (URL) hoặc secure_url
      const uploadedUrl = req.file.path || req.file.secure_url || req.file.url;
      console.log('📸 Uploaded file URL:', uploadedUrl);
      console.log('📸 Full file object keys:', Object.keys(req.file || {}));
      
      if (uploadedUrl) {
        user.avatarUrl = uploadedUrl;
        console.log('✅ Avatar URL updated from uploaded file:', uploadedUrl);
      } else {
        console.error('❌ No URL found in uploaded file object:', req.file);
      }
    } else if (avatarUrl !== undefined) {
      // Nếu là JSON và có avatarUrl string
      if (typeof avatarUrl === 'string' && avatarUrl.trim() !== '') {
        user.avatarUrl = avatarUrl.trim();
        console.log('✅ Avatar URL updated from body:', avatarUrl.trim());
      }
      // If empty string is sent, ignore to prevent accidental clearing
    }
    if (privacyProfile !== undefined) user.privacyProfile = privacyProfile;
    if (theme !== undefined) user.theme = theme;
    if (language !== undefined) user.language = language;
    if (gender !== undefined) user.gender = gender;
    if (location !== undefined) user.location = location;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          displayName: user.displayName,
          birthday: user.birthday,
          gender: user.gender,
          location: user.location,
          bio: user.bio,
          avatarUrl: user.avatarUrl,
          roleId: user.roleId,
          verifiedEmail: user.verifiedEmail,
          totalLikesReceived: user.totalLikesReceived,
          totalCommentsReceived: user.totalCommentsReceived,
          followersCount: user.followersCount,
          followingCount: user.followingCount,
          emailNotifications: user.emailNotifications,
          pushNotifications: user.pushNotifications,
          privacyProfile: user.privacyProfile,
          theme: user.theme,
          language: user.language,
          updatedAt: user.updatedAt
        }
      }
    });

  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Upload avatar image and update user's avatarUrl
export const uploadAvatar = async (req, res) => {
  try {
    const userId = req.userId;
    const file = req.file;
    
    console.log('📸 Upload avatar - file object:', JSON.stringify(file, null, 2));
    
    if (!file) {
      return res.status(400).json({ success: false, message: 'Missing avatar file' });
    }

    // With CloudinaryStorage, the file object should have path or secure_url
    // Try multiple possible properties from Cloudinary response
    const imageUrl = file.path || file.secure_url || file.url || (file.filename ? `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/${file.filename}` : null);
    
    console.log('📸 Extracted imageUrl:', imageUrl);
    
    if (!imageUrl) {
      console.error('❌ No imageUrl found in file object:', file);
      return res.status(500).json({ 
        success: false, 
        message: 'Upload failed - no URL returned from Cloudinary',
        debug: { fileKeys: Object.keys(file || {}) }
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { avatarUrl: imageUrl },
      { new: true }
    ).select('-passwordHash');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    console.log('✅ Avatar updated successfully:', imageUrl);

    return res.status(200).json({
      success: true,
      message: 'Avatar updated',
      data: { 
        avatarUrl: user.avatarUrl, 
        user 
      }
    });
  } catch (error) {
    console.error('❌ Error uploading avatar:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error', 
      error: error.message 
    });
  }
};

// Follow a user
export const followUser = async (req, res) => {
  try {
    const followerId = req.userId; // Current user (follower)
    const { userId } = req.params; // User to follow (following)

    // Check if trying to follow yourself
    if (followerId === userId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot follow yourself'
      });
    }

    // Check if target user exists
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if already following
    const existingFollow = await UserFollow.findOne({
      followerId,
      followingId: userId
    });

    if (existingFollow) {
      return res.status(400).json({
        success: false,
        message: 'Already following this user'
      });
    }

    // Create follow relationship
    const follow = await UserFollow.create({
      followerId,
      followingId: userId
    });

    // Update follower's followingCount
    await User.findByIdAndUpdate(followerId, {
      $inc: { followingCount: 1 }
    });

    // Update target user's followersCount
    await User.findByIdAndUpdate(userId, {
      $inc: { followersCount: 1 }
    });

    res.status(201).json({
      success: true,
      message: 'Successfully followed user',
      data: {
        follow: {
          id: follow._id,
          followerId: follow.followerId,
          followingId: follow.followingId,
          createdAt: follow.createdAt
        }
      }
    });

  } catch (error) {
    console.error('Error following user:', error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Already following this user'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Unfollow a user
export const unfollowUser = async (req, res) => {
  try {
    const followerId = req.userId; // Current user (follower)
    const { userId } = req.params; // User to unfollow (following)

    // Check if trying to unfollow yourself
    if (followerId === userId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot unfollow yourself'
      });
    }

    // Check if target user exists
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if follow relationship exists
    const follow = await UserFollow.findOneAndDelete({
      followerId,
      followingId: userId
    });

    if (!follow) {
      return res.status(400).json({
        success: false,
        message: 'Not following this user'
      });
    }

    // Update follower's followingCount
    await User.findByIdAndUpdate(followerId, { $inc: { followingCount: -1 } });
    // Prevent negative values in case counts were out-of-sync
    await User.updateOne({ _id: followerId, followingCount: { $lt: 0 } }, { $set: { followingCount: 0 } });

    // Update target user's followersCount
    await User.findByIdAndUpdate(userId, { $inc: { followersCount: -1 } });
    await User.updateOne({ _id: userId, followersCount: { $lt: 0 } }, { $set: { followersCount: 0 } });

    res.status(200).json({
      success: true,
      message: 'Successfully unfollowed user',
      data: {
        unfollowed: {
          followerId,
          followingId: userId
        }
      }
    });

  } catch (error) {
    console.error('Error unfollowing user:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get follow suggestions for current user
export const getFollowSuggestions = async (req, res) => {
  try {
    const currentUserId = req.userId; // requires auth
    const limit = Math.min(parseInt(req.query.limit, 10) || 5, 50);

    // Users the current user already follows
    const following = await UserFollow.find({ followerId: currentUserId }).select('followingId');
    const followingIds = following.map((f) => f.followingId);

    // Exclude current user and already-following users
    const users = await User.find({
      _id: { $nin: [currentUserId, ...followingIds] },
      isActive: { $ne: false },
    })
      .sort({ followersCount: -1, createdAt: -1 })
      .limit(limit)
      .select('username displayName avatarUrl followersCount');

    res.status(200).json({
      success: true,
      data: users.map((u) => ({
        id: u._id,
        username: u.username,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        followersCount: u.followersCount,
      }))
    });
  } catch (error) {
    console.error('Error getting follow suggestions:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};