// ============================================================
// LearnSpace - Lesson, Quiz & Analytics Controller
// ============================================================
const { Op } = require('sequelize');
const { Lesson, Course, Quiz, QuizQuestion, QuizResult, Enrollment, InstructorEarning, Review } = require('../models');
const { sequelize } = require('../config/database');
const { uploadToCloud } = require('../services/upload.service');
const logger = require('../utils/logger');

// ── GET /api/lessons/course/:courseId ─────────────────────
const getLessons = async (req, res) => {
  try {
    const { courseId } = req.params;
    const isInstructor = req.user?.role === 'instructor' || req.user?.role === 'admin';
    const where = { course_id: courseId };
    if (!isInstructor) where.is_published = true;
    const lessons = await Lesson.findAll({ where, order: [['order_index', 'ASC']] });
    res.json({ success: true, data: { lessons } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch lessons.' });
  }
};

// ── POST /api/lessons/course/:courseId ────────────────────
const createLesson = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { title, title_bn, description, type, is_preview, order_index } = req.body;

    const course = await Course.findOne({ where: { id: courseId, instructor_id: req.user.id } });
    if (!course) return res.status(403).json({ success: false, message: 'Not authorized.' });

    let content_url = null;
    if (req.file) {
      content_url = await uploadToCloud(req.file, type === 'video' ? 'lesson-videos' : 'lesson-docs');
    }

    const lastLesson = await Lesson.findOne({ where: { course_id: courseId }, order: [['order_index', 'DESC']] });
    const nextOrder = order_index || (lastLesson ? lastLesson.order_index + 1 : 1);

    const lesson = await Lesson.create({
      course_id: courseId, title, title_bn, description,
      type: type || 'video', content_url, duration: 0,
      order_index: nextOrder,
      is_preview: is_preview === 'true' || is_preview === true,
      is_published: false
    });

    await Course.increment('total_lessons', { where: { id: courseId } });
    res.status(201).json({ success: true, message: 'Lesson added.', data: { lesson } });
  } catch (error) {
    logger.error('Create lesson error:', error);
    res.status(500).json({ success: false, message: 'Failed to create lesson.' });
  }
};

// ── PUT /api/lessons/:id ──────────────────────────────────
const updateLesson = async (req, res) => {
  try {
    const lesson = await Lesson.findByPk(req.params.id);
    if (!lesson) return res.status(404).json({ success: false, message: 'Lesson not found.' });

    const course = await Course.findOne({ where: { id: lesson.course_id, instructor_id: req.user.id } });
    if (!course && req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Not authorized.' });

    const updates = {};
    ['title', 'title_bn', 'description', 'is_preview', 'order_index'].forEach(f => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });
    if (req.file) {
      updates.content_url = await uploadToCloud(req.file, lesson.type === 'video' ? 'lesson-videos' : 'lesson-docs');
    }
    await lesson.update(updates);
    res.json({ success: true, message: 'Lesson updated.', data: { lesson } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update lesson.' });
  }
};

// ── PATCH /api/lessons/:id/toggle-publish ─────────────────
const togglePublish = async (req, res) => {
  try {
    const lesson = await Lesson.findByPk(req.params.id);
    if (!lesson) return res.status(404).json({ success: false, message: 'Lesson not found.' });
    await lesson.update({ is_published: !lesson.is_published });
    res.json({ success: true, data: { lesson } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to toggle lesson.' });
  }
};

// ── DELETE /api/lessons/:id ───────────────────────────────
const deleteLesson = async (req, res) => {
  try {
    const lesson = await Lesson.findByPk(req.params.id);
    if (!lesson) return res.status(404).json({ success: false, message: 'Lesson not found.' });
    const course = await Course.findOne({ where: { id: lesson.course_id, instructor_id: req.user.id } });
    if (!course && req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Not authorized.' });
    await lesson.destroy();
    await Course.decrement('total_lessons', { where: { id: lesson.course_id } });
    res.json({ success: true, message: 'Lesson deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete lesson.' });
  }
};

// ── GET /api/quizzes/:id ──────────────────────────────────
const getQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findByPk(req.params.id, {
      include: [{ model: QuizQuestion, as: 'questions', order: [['order_index', 'ASC']] }]
    });
    if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found.' });

    if (req.user?.role === 'student') {
      const sanitized = quiz.toJSON();
      sanitized.questions = sanitized.questions.map(q => {
        const { correct_answer, explanation, ...rest } = q;
        if (rest.options) rest.options = rest.options.map(o => (typeof o === 'object' ? { text: o.text } : o));
        return rest;
      });
      return res.json({ success: true, data: { quiz: sanitized } });
    }
    res.json({ success: true, data: { quiz } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch quiz.' });
  }
};

// ── POST /api/quizzes/:id/submit ──────────────────────────
const submitQuiz = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { answers, time_taken } = req.body;
    const student_id = req.user.id;

    const quiz = await Quiz.findByPk(req.params.id, {
      include: [{ model: QuizQuestion, as: 'questions' }]
    });
    if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found.' });

    const attemptCount = await QuizResult.count({ where: { quiz_id: quiz.id, student_id } });
    if (attemptCount >= quiz.max_attempts) {
      return res.status(400).json({ success: false, message: `Maximum ${quiz.max_attempts} attempts allowed.` });
    }

    let earnedPoints = 0;
    let totalPoints = 0;
    const gradedAnswers = quiz.questions.map(q => {
      totalPoints += q.points || 1;
      const userAnswer = answers[q.id];
      let isCorrect = false;
      if (q.question_type === 'short_answer') {
        isCorrect = userAnswer?.toLowerCase().trim() === q.correct_answer?.toLowerCase().trim();
      } else {
        const correctText = typeof q.correct_answer === 'string' ? q.correct_answer : q.options?.find(o => o.is_correct)?.text;
        isCorrect = userAnswer === correctText;
      }
      if (isCorrect) earnedPoints += q.points || 1;
      return { question_id: q.id, selected_answer: userAnswer, is_correct: isCorrect };
    });

    const score = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;
    const passed = score >= quiz.passing_score;

    const result = await QuizResult.create({
      quiz_id: quiz.id, student_id,
      score: parseFloat(score.toFixed(2)),
      total_points: totalPoints, earned_points: earnedPoints,
      passed, answers: gradedAnswers,
      attempt_number: attemptCount + 1,
      time_taken: time_taken || 0
    }, { transaction: t });

    await t.commit();

    const fullResult = {
      ...result.toJSON(),
      answers: gradedAnswers.map((a, i) => ({ ...a, correct_answer: quiz.questions[i]?.correct_answer }))
    };
    res.json({ success: true, data: { result: fullResult } });
  } catch (error) {
    await t.rollback();
    logger.error('Submit quiz error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit quiz.' });
  }
};

// ── POST /api/quizzes ─────────────────────────────────────
const createQuiz = async (req, res) => {
  try {
    const { course_id, lesson_id, title, description, time_limit, passing_score, max_attempts, questions } = req.body;
    const quiz = await Quiz.create({
      course_id, lesson_id, title, description,
      time_limit, passing_score: passing_score || 60,
      max_attempts: max_attempts || 3, is_published: false
    });
    if (questions?.length) {
      await QuizQuestion.bulkCreate(questions.map((q, i) => ({ ...q, quiz_id: quiz.id, order_index: i + 1 })));
    }
    const full = await Quiz.findByPk(quiz.id, { include: [{ model: QuizQuestion, as: 'questions' }] });
    res.status(201).json({ success: true, data: { quiz: full } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create quiz.' });
  }
};

// ── GET /api/analytics/instructor ────────────────────────
const getInstructorAnalytics = async (req, res) => {
  try {
    const instructor_id = req.user.id;
    const { sequelize: db } = require('../config/database');

    const [totalEarnings, totalEnrollments, earningsByMonth] = await Promise.all([
      InstructorEarning.sum('net_earning', { where: { instructor_id } }),
      Enrollment.count({
        include: [{ model: Course, as: 'course', where: { instructor_id }, required: true }]
      }),
      InstructorEarning.findAll({
        where: { instructor_id, created_at: { [Op.gte]: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000) } },
        attributes: [
          [db.fn('MONTH', db.col('created_at')), 'month'],
          [db.fn('SUM', db.col('net_earning')), 'earning']
        ],
        group: ['month'],
        order: [[db.fn('MONTH', db.col('created_at')), 'ASC']]
      })
    ]);

    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const chartData = earningsByMonth.map(e => ({
      month: MONTHS[(e.dataValues.month || e.month) - 1],
      earning: parseFloat(e.dataValues.earning || 0)
    }));

    res.json({
      success: true,
      data: {
        stats: { totalEarnings: totalEarnings || 0, totalEnrollments: totalEnrollments || 0, avgRating: 0 },
        earningsByMonth: chartData
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch analytics.' });
  }
};

module.exports = { getLessons, createLesson, updateLesson, togglePublish, deleteLesson, getQuiz, submitQuiz, createQuiz, getInstructorAnalytics };
