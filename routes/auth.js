const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const { sendEmailVerificationEmail } = require('../services/emailService');

const EMAIL_VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const EMAIL_VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1000;

const createEmailVerificationToken = async (user) => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  user.emailVerificationToken = tokenHash;
  user.emailVerificationExpires = new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_TTL_MS);
  user.emailVerificationSentAt = new Date();
  await user.save();

  return rawToken;
};

// Register
router.post('/register', [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password, phone, city, userType, sellerType, businessName } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Create user
    const user = new User({
      name,
      email: email.toLowerCase(),
      password,
      emailVerified: false,
      phone: phone || null,
      city: city || null,
      userType: userType || 'buyer',
      sellerType: sellerType || null,
      businessName: businessName || null
    });

    await user.save();
    const verificationToken = await createEmailVerificationToken(user);
    const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;

    await sendEmailVerificationEmail(user.email, user.name, verifyUrl);

    res.status(201).json({
      success: true,
      requiresEmailVerification: true,
      message: 'Registration successful. Please verify your email before logging in.',
      email: user.email
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
router.post('/login', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.emailVerified === false) {
      return res.status(403).json({
        error: 'Email not verified. Please verify your email to continue.',
        code: 'EMAIL_NOT_VERIFIED',
        email: user.email
      });
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'your_jwt_secret_key_here',
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: { 
        id: user._id,
        _id: user._id,
        name: user.name, 
        email: user.email, 
        phone: user.phone, 
        city: user.city,
        userType: user.userType,
        sellerType: user.sellerType,
        businessName: user.businessName,
        role: user.role,
        emailVerified: user.emailVerified !== false,
        verifiedBatch: user.verifiedBatch || false
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Forgot Password
router.post(
  '/forgot-password',
  [body('email').isEmail().withMessage('Valid email is required')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: 'Invalid email' });
      }

      const { email } = req.body;
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        // Do not reveal whether user exists
        return res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
      }

      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
      const expires = Date.now() + 15 * 60 * 1000; // 15 minutes

      user.resetPasswordToken = resetTokenHash;
      user.resetPasswordExpires = new Date(expires);
      await user.save();

      // In a real app, email the reset link. For now, return token for frontend to use.
      return res.json({
        success: true,
        message: 'Password reset link generated',
        resetToken
      });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
);

// Verify email
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ success: false, message: 'Verification token is required' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      emailVerificationToken: tokenHash,
      emailVerificationExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Verification link is invalid or expired' });
    }

    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    user.emailVerificationSentAt = undefined;
    await user.save();

    return res.json({ success: true, message: 'Email verified successfully. You can now log in.' });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Resend verification email
router.post(
  '/resend-verification',
  [body('email').isEmail().withMessage('Valid email is required')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: 'Invalid email' });
      }

      const { email } = req.body;
      const normalizedEmail = email.toLowerCase();
      const user = await User.findOne({ email: normalizedEmail });

      // Generic message to reduce account enumeration risk
      const genericResponse = {
        success: true,
        message: 'If this email is registered and unverified, a verification link has been sent.'
      };

      if (!user || user.emailVerified === true) {
        return res.json(genericResponse);
      }

      const lastSentAt = user.emailVerificationSentAt ? new Date(user.emailVerificationSentAt).getTime() : 0;
      const elapsed = Date.now() - lastSentAt;
      if (elapsed < EMAIL_VERIFICATION_RESEND_COOLDOWN_MS) {
        const secondsRemaining = Math.ceil((EMAIL_VERIFICATION_RESEND_COOLDOWN_MS - elapsed) / 1000);
        return res.status(429).json({
          success: false,
          message: `Please wait ${secondsRemaining} seconds before requesting another email.`
        });
      }

      const verificationToken = await createEmailVerificationToken(user);
      const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;
      await sendEmailVerificationEmail(user.email, user.name, verifyUrl);

      return res.json(genericResponse);
    } catch (error) {
      console.error('Resend verification error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
);

// Verify reset token
router.get('/verify-reset-token', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ valid: false, message: 'Token is required' });
    }
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: tokenHash,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.json({ valid: false, message: 'Token is invalid or expired' });
    }

    return res.json({ valid: true });
  } catch (error) {
    console.error('Verify reset token error:', error);
    res.status(500).json({ valid: false, message: 'Server error' });
  }
});

// Reset password
router.post(
  '/reset-password',
  [
    body('token').notEmpty().withMessage('Token is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: 'Invalid input' });
      }

      const { token, password } = req.body;
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      const user = await User.findOne({
        resetPasswordToken: tokenHash,
        resetPasswordExpires: { $gt: new Date() }
      });

      if (!user) {
        return res.status(400).json({ success: false, message: 'Token is invalid or expired' });
      }

      user.password = password;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();

      return res.json({ success: true, message: 'Password reset successful' });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
);

// Change password (logged-in users)
router.post(
  '/change-password',
  authenticateToken,
  [
    body('oldPassword').notEmpty().withMessage('Old password is required'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: 'Invalid input' });
      }

      const { oldPassword, newPassword } = req.body;
      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      const isValid = await user.comparePassword(oldPassword);
      if (!isValid) {
        return res.status(401).json({ success: false, message: 'Old password is incorrect' });
      }

      user.password = newPassword;
      await user.save();

      res.json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
);

module.exports = router;
