import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import User from '../models/User.js';
import { generateTokens } from './authController.js';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Verify Google ID token
const verifyIdToken = async (token) => {
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    return ticket.getPayload();
  } catch (error) {
    console.error('Error verifying Google ID token:', error);
    return null;
  }
};

// Find or create user from Google profile
export const findOrCreateUser = async (profile) => {
  try {
    // Check if user exists with this Google ID
    let user = await User.findOne({ googleId: profile.sub });

    if (!user) {
      // Check if user exists with this email but no Google ID
      user = await User.findOne({ email: profile.email });
      
      if (user) {
        // If user exists with email but no Google ID, update with Google ID
        if (!user.googleId) {
          user.googleId = profile.sub;
          await user.save();
        }
      } else {
        // Generate a random password for Google users
        const randomPassword = Math.random().toString(36).slice(-16);
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(randomPassword, salt);

        // Create new user
        user = new User({
          googleId: profile.sub,
          email: profile.email,
          username: await generateUniqueUsername(profile.email.split('@')[0]),
          displayName: profile.name,
          avatarUrl: profile.picture,
          passwordHash: passwordHash,
          verifiedEmail: true,
        });
        await user.save();
      }
    }

    return user;
  } catch (error) {
    console.error('Error in findOrCreateUser:', error);
    throw error;
  }
};

// Helper function to generate unique username
async function generateUniqueUsername(baseUsername) {
  let username = baseUsername;
  let counter = 1;
  
  while (await User.exists({ username })) {
    username = `${baseUsername}${counter}`;
    counter++;
  }
  
  return username;
}

// Google OAuth login
export const googleLogin = async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing Google token' 
      });
    }

    // Verify Google token
    const profile = await verifyIdToken(token);
    if (!profile) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid Google token' 
      });
    }

    // Find or create user
    const user = await findOrCreateUser(profile);

    // Generate JWT tokens
    const { accessToken, refreshToken } = generateTokens(user);

    // Set refresh token in HTTP-only cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Return user data and access token
    const userData = {
      id: user._id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      roleId: user.roleId,
      verifiedEmail: user.verifiedEmail,
    };

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token: accessToken,
      user: userData,
    });
  } catch (error) {
    console.error('Google login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
