const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware');
const { getInstructorAnalytics } = require('../controllers/lesson.controller');
const { Op } = require('sequelize');

router.get('/instructor', protect, authorize('instructor'), getInstructorAnalytics);

router.get('/platform', protect, authorize('admin'), async (req, res) => {
  try {
    const { User, Course, Enrollment, Payment } = require('../models');
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [newUsers, newCourses, newEnrollments, revenue] = await Promise.all([
      User.count({ where: { created_at: { [Op.gte]: thirtyDaysAgo } } }),
      Course.count({ where: { created_at: { [Op.gte]: thirtyDaysAgo } } }),
      Enrollment.count({ where: { enrolled_at: { [Op.gte]: thirtyDaysAgo } } }),
      Payment.sum('amount', { where: { status: 'paid', created_at: { [Op.gte]: thirtyDaysAgo } } })
    ]);
    res.json({ success: true, data: { newUsers, newCourses, newEnrollments, revenue: revenue || 0 } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch analytics.' });
  }
});

module.exports = router;
