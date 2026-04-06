// ============================================================
// LearnSpace - Admin Controller
// ============================================================
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const {
  User, Course, InstructorProfile, Enrollment,
  Payment, InstructorEarning, Category
} = require('../models');
const { sendEmail } = require('../services/email.service');
const logger = require('../utils/logger');

// ── GET /api/admin/dashboard ───────────────────────────────
const getDashboard = async (req, res) => {
  try {
    const [
      totalUsers, totalCourses, totalEnrollments, totalRevenue,
      pendingInstructors, pendingCourses, recentPayments
    ] = await Promise.all([
      User.count(),
      Course.count({ where: { status: 'published' } }),
      Enrollment.count({ where: { status: 'active' } }),
      Payment.sum('amount', { where: { status: 'paid' } }),
      InstructorProfile.count({ where: { verification_status: 'pending' } }),
      Course.count({ where: { status: 'pending_review' } }),
      Payment.findAll({
        where: { status: 'paid' },
        include: [
          { model: User, as: 'student', attributes: ['name', 'email'] },
          { model: Course, as: 'course', attributes: ['title'] }
        ],
        order: [['created_at', 'DESC']],
        limit: 10
      })
    ]);

    // Revenue by month (last 6 months)
    const revenueByMonth = await Payment.findAll({
      where: {
        status: 'paid',
        created_at: { [Op.gte]: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000) }
      },
      attributes: [
        [sequelize.fn('MONTH', sequelize.col('created_at')), 'month'],
        [sequelize.fn('YEAR', sequelize.col('created_at')), 'year'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'total']
      ],
      group: ['year', 'month'],
      order: [['year', 'ASC'], ['month', 'ASC']]
    });

    res.json({
      success: true,
      data: {
        stats: {
          totalUsers,
          totalCourses,
          totalEnrollments,
          totalRevenue: totalRevenue || 0,
          pendingInstructors,
          pendingCourses
        },
        revenueByMonth,
        recentPayments
      }
    });
  } catch (error) {
    logger.error('Admin dashboard error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard data.' });
  }
};

// ── GET /api/admin/instructors/pending ─────────────────────
const getPendingInstructors = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const { count, rows } = await InstructorProfile.findAndCountAll({
      where: { verification_status: 'pending' },
      include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email', 'created_at'] }],
      order: [['created_at', 'ASC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit)
    });

    res.json({ success: true, data: { instructors: rows, pagination: { total: count } } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch pending instructors.' });
  }
};

// ── PATCH /api/admin/instructors/:id/verify ────────────────
const verifyInstructor = async (req, res) => {
  try {
    const { action, reason } = req.body; // action: 'approve' | 'reject'

    const profile = await InstructorProfile.findByPk(req.params.id, {
      include: [{ model: User, as: 'user' }]
    });

    if (!profile) return res.status(404).json({ success: false, message: 'Instructor not found.' });

    if (action === 'approve') {
      await profile.update({ verification_status: 'verified' });
      await sendEmail({
        to: profile.user.email,
        subject: 'Your Instructor Application is Approved!',
        template: 'instructor-approved',
        data: { name: profile.user.name }
      });
    } else if (action === 'reject') {
      await profile.update({ verification_status: 'rejected', rejection_reason: reason });
      await sendEmail({
        to: profile.user.email,
        subject: 'Instructor Application Update',
        template: 'instructor-rejected',
        data: { name: profile.user.name, reason }
      });
    } else {
      return res.status(400).json({ success: false, message: 'Invalid action. Use approve or reject.' });
    }

    res.json({ success: true, message: `Instructor ${action}d successfully.` });
  } catch (error) {
    logger.error('Verify instructor error:', error);
    res.status(500).json({ success: false, message: 'Verification action failed.' });
  }
};

// ── GET /api/admin/courses/pending ─────────────────────────
const getPendingCourses = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const { count, rows } = await Course.findAndCountAll({
      where: { status: 'pending_review' },
      include: [
        { model: User, as: 'instructor', attributes: ['id', 'name', 'email'] },
        { model: Category, as: 'category', attributes: ['id', 'name'] }
      ],
      order: [['updated_at', 'ASC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit)
    });

    res.json({ success: true, data: { courses: rows, pagination: { total: count } } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch pending courses.' });
  }
};

// ── PATCH /api/admin/courses/:id/review ───────────────────
const reviewCourse = async (req, res) => {
  try {
    const { action, reason } = req.body; // action: 'approve' | 'reject'

    const course = await Course.findByPk(req.params.id, {
      include: [{ model: User, as: 'instructor', attributes: ['name', 'email'] }]
    });

    if (!course) return res.status(404).json({ success: false, message: 'Course not found.' });

    if (action === 'approve') {
      await course.update({ status: 'published', rejection_reason: null });
      await sendEmail({
        to: course.instructor.email,
        subject: `Course Approved: ${course.title}`,
        template: 'course-approved',
        data: { name: course.instructor.name, courseName: course.title }
      });
    } else if (action === 'reject') {
      await course.update({ status: 'rejected', rejection_reason: reason });
      await sendEmail({
        to: course.instructor.email,
        subject: `Course Review Update: ${course.title}`,
        template: 'course-rejected',
        data: { name: course.instructor.name, courseName: course.title, reason }
      });
    } else {
      return res.status(400).json({ success: false, message: 'Invalid action.' });
    }

    res.json({ success: true, message: `Course ${action}d successfully.` });
  } catch (error) {
    logger.error('Review course error:', error);
    res.status(500).json({ success: false, message: 'Course review failed.' });
  }
};

// ── GET /api/admin/users ───────────────────────────────────
const getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, role, search, is_active } = req.query;
    const where = {};
    if (role) where.role = role;
    if (is_active !== undefined) where.is_active = is_active === 'true';
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await User.findAndCountAll({
      where,
      attributes: { exclude: ['password', 'reset_password_token', 'reset_password_expires'] },
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit)
    });

    res.json({ success: true, data: { users: rows, pagination: { total: count } } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch users.' });
  }
};

// ── PATCH /api/admin/users/:id/toggle ─────────────────────
const toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    if (user.role === 'admin') return res.status(403).json({ success: false, message: 'Cannot modify admin.' });

    await user.update({ is_active: !user.is_active });
    res.json({
      success: true,
      message: `User ${user.is_active ? 'activated' : 'deactivated'}.`,
      data: { is_active: user.is_active }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update user status.' });
  }
};

// ── GET /api/admin/reports/revenue ────────────────────────
const getRevenueReport = async (req, res) => {
  try {
    const { from, to } = req.query;
    const where = { status: 'paid' };
    if (from || to) {
      where.created_at = {};
      if (from) where.created_at[Op.gte] = new Date(from);
      if (to) where.created_at[Op.lte] = new Date(to);
    }

    const [totalRevenue, platformRevenue, instructorRevenue, byGateway, topCourses] = await Promise.all([
      Payment.sum('amount', { where }),
      Payment.sum('platform_fee', { where }),
      Payment.sum('instructor_earning', { where }),
      Payment.findAll({
        where,
        attributes: ['gateway', [sequelize.fn('SUM', sequelize.col('amount')), 'total']],
        group: ['gateway']
      }),
      Course.findAll({
        attributes: ['id', 'title', 'total_enrollments', 'price'],
        order: [['total_enrollments', 'DESC']],
        limit: 10
      })
    ]);

    res.json({
      success: true,
      data: {
        totalRevenue: totalRevenue || 0,
        platformRevenue: platformRevenue || 0,
        instructorRevenue: instructorRevenue || 0,
        byGateway,
        topCourses
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to generate report.' });
  }
};

module.exports = {
  getDashboard, getPendingInstructors, verifyInstructor,
  getPendingCourses, reviewCourse, getUsers, toggleUserStatus, getRevenueReport
};
