const express = require('express');
const router = express.Router();
const { Enrollment, Course, User } = require('../models');
const { protect, authorize, verifiedInstructor } = require('../middleware/auth.middleware');

// GET /api/enrollments/my
router.get('/my', protect, authorize('student'), async (req, res) => {
  try {
    const enrollments = await Enrollment.findAll({
      where: { student_id: req.user.id },
      include: [{
        model: Course, as: 'course',
        attributes: ['id', 'title', 'thumbnail', 'instructor_id', 'total_lessons'],
        include: [{ model: User, as: 'instructor', attributes: ['name'] }]
      }],
      order: [['enrolled_at', 'DESC']]
    });
    res.json({ success: true, data: { enrollments } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch enrollments.' });
  }
});

// GET /api/enrollments/course/:courseId
router.get('/course/:courseId', protect, verifiedInstructor, async (req, res) => {
  try {
    const enrollments = await Enrollment.findAll({
      where: { course_id: req.params.courseId },
      include: [{ model: User, as: 'student', attributes: ['id', 'name', 'email', 'avatar'] }],
      order: [['enrolled_at', 'DESC']]
    });
    res.json({ success: true, data: { enrollments, total: enrollments.length } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch enrollments.' });
  }
});

module.exports = router;
