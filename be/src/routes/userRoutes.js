import express from 'express';
import { body } from 'express-validator';
import { 
  getCurrentUserProfile, 
  getUserProfileById, 
  getUserProfileByUsername, 
  updateUserProfile 
} from '../controllers/userController.js';
import middlewareController from '../middleware/auth.js';
const { verifyToken } = middlewareController;

const router = express.Router();

// Input validation rules for profile update
const validateProfileUpdate = [
  body('displayName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Display name must be between 2 and 100 characters'),
    
  body('bio')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Bio must be less than 500 characters'),
    
  body('birthday')
    .optional()
    .isISO8601()
    .withMessage('Please enter a valid date in YYYY-MM-DD format'),
    
  body('avatarUrl')
    .optional()
    .isURL()
    .withMessage('Please enter a valid URL for avatar'),
    
  body('privacyProfile')
    .optional()
    .isIn(['public', 'followers', 'private'])
    .withMessage('Privacy profile must be public, followers, or private'),
    
  body('theme')
    .optional()
    .isIn(['light', 'dark', 'auto'])
    .withMessage('Theme must be light, dark, or auto'),
    
  body('language')
    .optional()
    .isLength({ min: 2, max: 5 })
    .withMessage('Language must be between 2 and 5 characters')
];

// User profile routes

// GET /api/users/profile - Get current user's profile (requires authentication)
router.get('/profile', verifyToken, getCurrentUserProfile);

// GET /api/users/:userId - Get user profile by user ID (public, respects privacy settings)
router.get('/:userId', getUserProfileById);

// GET /api/users/username/:username - Get user profile by username (public, respects privacy settings)
router.get('/username/:username', getUserProfileByUsername);

// PUT /api/users/profile - Update current user's profile (requires authentication)
router.put('/profile', verifyToken, validateProfileUpdate, updateUserProfile);

export default router;
