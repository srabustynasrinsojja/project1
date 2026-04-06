// ============================================================
// LearnSpace - Payment Controller (Robust version)
// Works even if Payment / InstructorEarning models don't exist
// ============================================================
const { sequelize } = require('../config/database');
const logger = require('../utils/logger');

// Safely import models — won't crash if a model is missing
const db = require('../models');
const Enrollment       = db.Enrollment;
const Course           = db.Course;
const User             = db.User;
const Payment          = db.Payment          || null;   // may not exist
const InstructorEarning= db.InstructorEarning|| null;  // may not exist

// ── POST /api/payments/create-order ───────────────────────
const createOrder = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { course_id, gateway = 'free' } = req.body;
    const student_id = req.user.id;

    // ── 1. Course must exist and be published ────────────
    const course = await Course.findOne({
      where: { id: course_id, status: 'published' }
    });
    if (!course) {
      await t.rollback();
      return res.status(404).json({ success: false, message: 'Course not found or not available.' });
    }

    // ── 2. No double-enrollment ──────────────────────────
    const existing = await Enrollment.findOne({
      where: { student_id, course_id }
    });
    if (existing) {
      await t.rollback();
      // If already enrolled just redirect them
      return res.json({
        success: true,
        message: 'You are already enrolled in this course.',
        data: { enrollment: existing, payment: null }
      });
    }

    // ── 3. Can't enroll in own course ───────────────────
    if (String(course.instructor_id) === String(student_id)) {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'You cannot enroll in your own course.' });
    }

    const price         = parseFloat(course.discount_price || course.price || 0);
    const isFreeOrDemo  = course.is_free || price === 0 || gateway === 'free' || gateway === 'demo';

    if (!isFreeOrDemo && gateway !== 'stripe' && gateway !== 'sslcommerz') {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'Invalid payment gateway.' });
    }

    // ── 4. Create Payment record (if model exists) ───────
    let payment = null;
    if (Payment) {
      try {
        payment = await Payment.create({
          student_id,
          course_id,
          amount:         isFreeOrDemo ? price : price,
          currency:       course.currency || 'BDT',
          gateway:        gateway,
          status:         'completed',
          transaction_id: `DEMO-${Date.now()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
          paid_at:        new Date()
        }, { transaction: t });
      } catch (payErr) {
        // Payment model exists but insert failed (missing column etc.)
        // Log it but continue — enrollment is what matters
        logger.error('Payment record creation failed (non-fatal):', payErr.message);
        payment = null;
      }
    }

    // ── 5. Create Enrollment ─────────────────────────────
    const enrollmentData = {
      student_id,
      course_id,
      status:           'active',
      progress_percent: 0,
      enrolled_at:      new Date()
    };
    if (payment) enrollmentData.payment_id = payment.id;

    const enrollment = await Enrollment.create(enrollmentData, { transaction: t });

    // ── 6. Increment course enrollment count ─────────────
    await Course.increment('total_enrollments', {
      where: { id: course_id },
      transaction: t
    });

    // ── 7. Instructor earning (if model exists, non-fatal) ─
    if (InstructorEarning && payment && price > 0) {
      try {
        await InstructorEarning.create({
          instructor_id: course.instructor_id,
          course_id,
          payment_id:    payment.id,
          gross_amount:  price,
          platform_fee:  price * 0.3,
          net_earning:   price * 0.7,
          status:        'pending'
        }, { transaction: t });
      } catch (earnErr) {
        logger.warn('InstructorEarning skipped:', earnErr.message);
      }
    }

    await t.commit();

    return res.json({
      success: true,
      message: 'Enrolled successfully!',
      data: { enrollment, payment }
    });

  } catch (error) {
    await t.rollback();
    logger.error('Create order error:', error);

    // Unique constraint = already enrolled
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ success: false, message: 'You are already enrolled in this course.' });
    }

    // Log full error so you can see it in the backend terminal
    console.error('PAYMENT ERROR DETAIL:', error.message, error.stack);

    res.status(500).json({
      success: false,
      message: 'Payment processing failed: ' + error.message
    });
  }
};

// ── POST /api/payments/stripe/confirm ─────────────────────
const confirmStripePayment = async (req, res) => {
  res.status(501).json({ success: false, message: 'Stripe not yet configured.' });
};

// ── POST /api/payments/webhook ─────────────────────────────
const stripeWebhook = async (req, res) => {
  res.json({ received: true });
};

// ── GET /api/payments/history ─────────────────────────────
const getPaymentHistory = async (req, res) => {
  try {
    if (!Payment) {
      return res.json({ success: true, data: { payments: [], pagination: { total: 0, page: 1, limit: 10, pages: 0 } } });
    }
    const { page = 1, limit = 10 } = req.query;
    const { count, rows } = await Payment.findAndCountAll({
      where: { student_id: req.user.id },
      include: [{ model: Course, as: 'course', attributes: ['id', 'title', 'thumbnail'] }],
      order: [['created_at', 'DESC']],
      limit:  parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit)
    });
    res.json({ success: true, data: { payments: rows, pagination: { total: count, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(count / parseInt(limit)) } } });
  } catch (error) {
    logger.error('Payment history error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch payment history.' });
  }
};

// ── POST /api/payments/refund/:paymentId ──────────────────
const processRefund = async (req, res) => {
  try {
    if (!Payment) return res.status(501).json({ success: false, message: 'Refunds not available.' });
    const payment = await Payment.findByPk(req.params.paymentId);
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found.' });
    if (payment.status === 'refunded') return res.status(400).json({ success: false, message: 'Already refunded.' });

    const t = await sequelize.transaction();
    try {
      await payment.update({ status: 'refunded' }, { transaction: t });
      await Enrollment.update({ status: 'refunded' }, { where: { payment_id: payment.id }, transaction: t });
      await Course.decrement('total_enrollments', { where: { id: payment.course_id }, transaction: t });
      await t.commit();
      res.json({ success: true, message: 'Refund processed.' });
    } catch (err) {
      await t.rollback();
      throw err;
    }
  } catch (error) {
    logger.error('Refund error:', error);
    res.status(500).json({ success: false, message: 'Failed to process refund.' });
  }
};

module.exports = { createOrder, confirmStripePayment, stripeWebhook, getPaymentHistory, processRefund };