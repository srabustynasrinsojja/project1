// ============================================================
// LearnSpace - Authentication Controller
// ============================================================
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User, InstructorProfile } = require('../models');
const { sendEmail } = require('../services/email.service');
const logger = require('../utils/logger');
require('dotenv').config();

// Helper: generate JWT
const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

const generateRefreshToken = (id) =>
  jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
  });

// ── POST /api/auth/register ────────────────────────────────
const register = async (req, res) => {
  try {
    const { name, email, password, role = 'student', phone, language = 'en' } = req.body;

    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email is already registered.' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: ['student', 'instructor'].includes(role) ? role : 'student',
      phone,
      language
    });

    // Create instructor profile if role is instructor
    if (user.role === 'instructor') {
      await InstructorProfile.create({ user_id: user.id });
    }

    // Send welcome email
    await sendEmail({
      to: user.email,
      subject: 'Welcome to LearnSpace!',
      template: 'welcome',
      data: { name: user.name }
    });

    const token = generateToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    res.status(201).json({
      success: true,
      message: 'Registration successful!',
      data: {
        token,
        refreshToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          language: user.language
        }
      }
    });
  } catch (error) {
    logger.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Registration failed. Please try again.' });
  }
};

// ── POST /api/auth/login ───────────────────────────────────
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Your account has been deactivated.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    await user.update({ last_login: new Date() });

    const token = generateToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    // Fetch instructor profile if applicable
    let instructorData = null;
    if (user.role === 'instructor') {
      instructorData = await InstructorProfile.findOne({ where: { user_id: user.id } });
    }

    res.json({
      success: true,
      message: 'Login successful!',
      data: {
        token,
        refreshToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          language: user.language,
          is_verified: user.is_verified,
          instructor_status: instructorData?.verification_status || null
        }
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Login failed. Please try again.' });
  }
};

// ── POST /api/auth/refresh-token ───────────────────────────
const refreshToken = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) return res.status(400).json({ success: false, message: 'Refresh token required.' });

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const user = await User.findByPk(decoded.id);

    if (!user || !user.is_active) {
      return res.status(401).json({ success: false, message: 'Invalid refresh token.' });
    }

    const newToken = generateToken(user.id);
    res.json({ success: true, data: { token: newToken } });
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired refresh token.' });
  }
};

// ── POST /api/auth/forgot-password ────────────────────────
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ where: { email } });

    // Always respond the same to prevent email enumeration
    const successMsg = 'If this email is registered, you will receive a password reset link.';

    if (!user) return res.json({ success: true, message: successMsg });

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await user.update({
      reset_password_token: resetHash,
      reset_password_expires: expiresAt
    });

    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

    await sendEmail({
      to: user.email,
      subject: 'LearnSpace Password Reset',
      template: 'reset-password',
      data: { name: user.name, resetUrl, expiresIn: '10 minutes' }
    });

    res.json({ success: true, message: successMsg });
  } catch (error) {
    logger.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Failed to send reset email.' });
  }
};

// ── POST /api/auth/reset-password ─────────────────────────
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    const resetHash = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      where: {
        reset_password_token: resetHash
      }
    });

    if (!user || new Date() > new Date(user.reset_password_expires)) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token.' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await user.update({
      password: hashedPassword,
      reset_password_token: null,
      reset_password_expires: null
    });

    await sendEmail({
      to: user.email,
      subject: 'Password Changed Successfully',
      template: 'password-changed',
      data: { name: user.name }
    });

    res.json({ success: true, message: 'Password reset successful. Please login.' });
  } catch (error) {
    logger.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Password reset failed.' });
  }
};

// ── GET /api/auth/me ───────────────────────────────────────
const getMe = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password', 'reset_password_token', 'reset_password_expires'] },
      include: [{ model: InstructorProfile, as: 'instructor_profile' }]
    });
    res.json({ success: true, data: { user } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch user data.' });
  }
};

module.exports = { register, login, refreshToken, forgotPassword, resetPassword, getMe };
