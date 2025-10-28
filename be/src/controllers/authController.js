import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import sendMail from './sendMail.js';
import { validationResult } from 'express-validator';

// Login user
export const login = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ 
        message: 'Invalid email or password' 
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({ 
        message: 'Account is deactivated. Please contact support.' 
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        message: 'Invalid email or password' 
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user._id, 
        email: user.email,
        roleId: user.roleId 
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        roleId: user.roleId,
        verifiedEmail: user.verifiedEmail
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      message: 'Server error during login',
      error: error.message 
    });
  }
};

// Register new user
export const register = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { fullName, email, password, birthday } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ 
        message: 'Email already registered' 
      });
    }

    // Generate username from email (before @)
    let username = email.split('@')[0].toLowerCase();
    
    // Check if username exists, if so, add random numbers
    let usernameExists = await User.findOne({ username });
    while (usernameExists) {
      username = `${email.split('@')[0].toLowerCase()}${Math.floor(Math.random() * 10000)}`;
      usernameExists = await User.findOne({ username });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create new user
    const newUser = new User({
      email,
      passwordHash,
      username,
      displayName: fullName,
      birthday: birthday ? new Date(birthday) : undefined,
      roleId: 'user',
      isActive: true,
      verifiedEmail: false
    });

    await newUser.save();
    await sendMail({
        email: email,
        subject: "Congratulations! Your MelodyHub account has been successfully registered!",
        html: `
                <h2>Wellcome ${fullName} to MelodyHub - A Collborative Space for Artists to Shape Soundscapes!</h2>
                        <p>Thank you for registering with MelodyHub. We're excited to have you on board!</p>
                        <p>Start exploring and sharing your music with the world.</p>
                        <p>Here are your account details:</p>
                    <ul>
                        <li><strong>Name:</strong> ${fullName}</li>
                        <li><strong>Email:</strong> ${email}</li>   
                    </ul>
                        <p>If you have any questions, feel free to reply to this email.</p>
                        <br/>
                        <p>Best regards,</p>
                        <p>The MelodyHub Team</p>
            `
    })
    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: newUser._id, 
        email: newUser.email,
        roleId: newUser.roleId 
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: newUser._id,
        email: newUser.email,
        username: newUser.username,
        displayName: newUser.displayName,
        birthday: newUser.birthday,
        roleId: newUser.roleId
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      message: 'Server error during registration',
      error: error.message 
    });
  }
};