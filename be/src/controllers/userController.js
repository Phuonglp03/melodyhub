import User from '../models/User.js';
import Post from '../models/Post.js';
import UserFollow from '../models/UserFollow.js';

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
    const { displayName, bio, birthday, avatarUrl, privacyProfile, theme, language } = req.body;

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
    if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;
    if (privacyProfile !== undefined) user.privacyProfile = privacyProfile;
    if (theme !== undefined) user.theme = theme;
    if (language !== undefined) user.language = language;

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
