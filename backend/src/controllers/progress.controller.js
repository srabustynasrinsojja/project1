// ============================================================
// LearnSpace - Progress + Certificate Controller
// ============================================================
const { Op } = require('sequelize');
const { Progress, Enrollment, Lesson, Course, User, Certificate } = require('../models');
const { sequelize } = require('../config/database');
const logger = require('../utils/logger');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const { uploadToCloud } = require('../services/upload.service');

// ── POST /api/progress/lesson/:lessonId ───────────────────
const markLessonComplete = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { lessonId } = req.params;
    const { watch_time, last_position } = req.body;
    const student_id = req.user.id;

    const lesson = await Lesson.findByPk(lessonId);
    if (!lesson) return res.status(404).json({ success: false, message: 'Lesson not found.' });

    const [progress, created] = await Progress.findOrCreate({
      where: { student_id, lesson_id: lessonId, course_id: lesson.course_id },
      defaults: {
        student_id, lesson_id: lessonId, course_id: lesson.course_id,
        is_completed: true, completed_at: new Date(),
        watch_time: watch_time || 0, last_position: last_position || 0
      },
      transaction: t
    });

    if (!created) {
      await progress.update({
        is_completed: true,
        completed_at: progress.completed_at || new Date(),
        watch_time: Math.max(progress.watch_time, watch_time || 0),
        last_position: last_position || progress.last_position
      }, { transaction: t });
    }

    const totalLessons = await Lesson.count({
      where: { course_id: lesson.course_id, is_published: true, type: { [Op.ne]: 'quiz' } }
    });

    const completedLessons = await Progress.count({
      where: { student_id, course_id: lesson.course_id, is_completed: true }
    });

    const progressPercent = totalLessons > 0 ? Math.min(100, (completedLessons / totalLessons) * 100) : 0;

    await Enrollment.update(
      { progress_percent: progressPercent, last_accessed: new Date() },
      { where: { student_id, course_id: lesson.course_id }, transaction: t }
    );

    await t.commit();

    if (progressPercent >= 100) {
      generateCertificate(
        { user: { id: student_id }, params: { courseId: lesson.course_id } },
        { json: () => {}, status: () => ({ json: () => {} }) }
      ).catch(err => logger.error('Auto cert error:', err));
    }

    res.json({ success: true, message: 'Progress updated.', data: { progress_percent: progressPercent, is_completed: true } });
  } catch (error) {
    await t.rollback();
    logger.error('Mark lesson complete error:', error);
    res.status(500).json({ success: false, message: 'Failed to update progress.' });
  }
};

// ── GET /api/progress/course/:courseId ─────────────────────
const getCourseProgress = async (req, res) => {
  try {
    const { courseId } = req.params;
    const student_id = req.user.id;

    const lessons = await Lesson.findAll({
      where: { course_id: courseId, is_published: true },
      attributes: ['id', 'title', 'type', 'order_index'],
      order: [['order_index', 'ASC']]
    });

    const progressRecords = await Progress.findAll({ where: { student_id, course_id: courseId } });
    const progressMap = {};
    progressRecords.forEach(p => { progressMap[p.lesson_id] = p; });

    const enrollment = await Enrollment.findOne({ where: { student_id, course_id: courseId } });

    const lessonsWithProgress = lessons.map(lesson => ({
      ...lesson.toJSON(),
      is_completed: progressMap[lesson.id]?.is_completed || false,
      last_position: progressMap[lesson.id]?.last_position || 0,
      watch_time: progressMap[lesson.id]?.watch_time || 0
    }));

    res.json({ success: true, data: { lessons: lessonsWithProgress, overall_progress: enrollment?.progress_percent || 0, last_accessed: enrollment?.last_accessed } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch progress.' });
  }
};

// ── PATCH /api/progress/lesson/:lessonId/position ─────────
const updateWatchPosition = async (req, res) => {
  try {
    const { last_position, watch_time } = req.body;
    const lesson = await Lesson.findByPk(req.params.lessonId);
    if (!lesson) return res.status(404).json({ success: false, message: 'Lesson not found.' });

    await Progress.upsert({
      student_id: req.user.id, lesson_id: req.params.lessonId,
      course_id: lesson.course_id, last_position: last_position || 0, watch_time: watch_time || 0
    });

    res.json({ success: true, message: 'Position saved.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update position.' });
  }
};

// ── POST /api/certificates/generate/:courseId ─────────────
const generateCertificate = async (req, res) => {
  try {
    const { courseId } = req.params;
    const student_id = req.user.id;

    const enrollment = await Enrollment.findOne({ where: { student_id, course_id: courseId, status: 'active' } });
    if (!enrollment) return res.status(403).json({ success: false, message: 'You are not enrolled in this course.' });

    if (parseFloat(enrollment.progress_percent) < 100) {
      return res.status(400).json({ success: false, message: `Course not yet complete. Progress: ${enrollment.progress_percent}%` });
    }

    const existing = await Certificate.findOne({ where: { student_id, course_id: courseId } });
    if (existing) return res.json({ success: true, data: { certificate: existing } });

    const student = await User.findByPk(student_id);
    const course = await Course.findByPk(courseId, {
      include: [{ model: User, as: 'instructor', attributes: ['name'] }]
    });

    const certNumber = `LS-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const verificationHash = crypto.createHash('sha256').update(`${student_id}-${courseId}-${certNumber}`).digest('hex');

    const pdfBuffer = await generateCertificatePDF({
      studentName: student.name, courseName: course.title,
      instructorName: course.instructor?.name, certNumber,
      issuedAt: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    });

    let pdfUrl = null;
    try {
      pdfUrl = await uploadToCloud(pdfBuffer, 'certificates', `${certNumber}.pdf`, 'application/pdf');
    } catch (uploadErr) {
      logger.error('PDF upload error (non-fatal):', uploadErr.message);
    }

    const certificate = await Certificate.create({ student_id, course_id: courseId, certificate_number: certNumber, pdf_url: pdfUrl, verification_hash: verificationHash });
    await enrollment.update({ completed_at: new Date() });

    res.json({ success: true, message: 'Certificate generated!', data: { certificate } });
  } catch (error) {
    logger.error('Generate certificate error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate certificate.' });
  }
};

// ── GET /api/certificates/verify/:hash ────────────────────
const verifyCertificate = async (req, res) => {
  try {
    const certificate = await Certificate.findOne({
      where: { verification_hash: req.params.hash },
      include: [
        { model: User, as: 'student', attributes: ['name'] },
        { model: Course, as: 'course', attributes: ['title'] }
      ]
    });

    if (!certificate) return res.status(404).json({ success: false, message: 'Certificate not found or invalid.' });

    res.json({ success: true, data: { valid: true, certificate_number: certificate.certificate_number, student_name: certificate.student.name, course_title: certificate.course.title, issued_at: certificate.issued_at } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Verification failed.' });
  }
};

// ── GET /api/certificates/my ───────────────────────────────
const getMyCertificates = async (req, res) => {
  try {
    const certificates = await Certificate.findAll({
      where: { student_id: req.user.id },
      include: [{ model: Course, as: 'course', attributes: ['id', 'title', 'thumbnail'] }],
      order: [['issued_at', 'DESC']]
    });
    res.json({ success: true, data: { certificates } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch certificates.' });
  }
};

// ── PDF Generation Helper ──────────────────────────────────
const generateCertificatePDF = ({ studentName, courseName, instructorName, certNumber, issuedAt }) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [842, 595], layout: 'landscape' });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.rect(0, 0, 842, 595).fill('#FFFFFF');
    doc.rect(20, 20, 802, 555).stroke('#1a73e8').lineWidth(3);
    doc.fillColor('#1a73e8').fontSize(36).font('Helvetica-Bold').text('LearnSpace', 0, 60, { align: 'center' });
    doc.fillColor('#333').fontSize(18).font('Helvetica').text('CERTIFICATE OF COMPLETION', 0, 110, { align: 'center' });
    doc.fillColor('#555').fontSize(14).text('This is to certify that', 0, 170, { align: 'center' });
    doc.fillColor('#1a73e8').fontSize(28).font('Helvetica-Bold').text(studentName, 0, 200, { align: 'center' });
    doc.fillColor('#555').fontSize(14).font('Helvetica').text('has successfully completed the course', 0, 250, { align: 'center' });
    doc.fillColor('#333').fontSize(22).font('Helvetica-Bold').text(courseName, 0, 275, { align: 'center' });
    if (instructorName) doc.fillColor('#666').fontSize(12).font('Helvetica').text(`Instructed by: ${instructorName}`, 0, 320, { align: 'center' });
    doc.fillColor('#999').fontSize(10).text(`Issued on: ${issuedAt}`, 100, 480).text(`Certificate No: ${certNumber}`, 100, 500);
    doc.end();
  });
};

module.exports = { markLessonComplete, getCourseProgress, updateWatchPosition, generateCertificate, verifyCertificate, getMyCertificates };
