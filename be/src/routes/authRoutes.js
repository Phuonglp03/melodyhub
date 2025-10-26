import express from 'express';
import { body } from 'express-validator';
import { register, login } from '../controllers/authController.js';

const router = express.Router();

// Input validation rules for login
const validateLogin = [
  body('email')
    .isEmail()
    .withMessage('Please enter a valid email')
    .normalizeEmail(),
    
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Input validation rules for registration
const validateRegistration = [
  body('fullName')
    .trim()
    .notEmpty()
    .withMessage('Full name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters'),
    
  body('email')
    .isEmail()
    .withMessage('Please enter a valid email')
    .normalizeEmail(),
    
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
    
  body('birthday')
    .optional()
    .isISO8601()
    .withMessage('Please enter a valid date in YYYY-MM-DD format')
];

// Auth routes
router.post('/login', validateLogin, login);
router.post('/register', validateRegistration, register);

export default router;