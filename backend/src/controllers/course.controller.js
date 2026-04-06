// ============================================================
// LearnSpace - Course Controller (Fixed)
// ============================================================
const { Op } = require('sequelize');
const { Course, User, Category, Lesson, Enrollment, Review, InstructorProfile } = require('../models');
const { sequelize } = require('../config/database');
const { uploadToCloud } = require('../services/upload.service');
const logger = require('../utils/logger');

// Helper: safely parse JSON or return array
const safeParseJSON = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try { return JSON.parse(val); } catch { return []; }
};

// Helper: generate a URL-safe slug from title + unique suffix
const generateSlug = (title, suffix) => {
  const base = (title || 'course')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')       // remove special chars except hyphen
    .replace(/[\s_]+/g, '-')        // spaces/underscores → hyphen
    .replace(/-+/g, '-')            // collapse multiple hyphens
    .substring(0, 80);              // max 80 chars
  return `${base}-${suffix}`;
};

// ── GET /api/courses ───────────────────────────────────────
const getCourses = async (req, res) => {
  try {
    const {
      page = 1, limit = 12, search, category, level,
      language, min_price, max_price, sort = 'newest', is_free
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const where = { status: 'published' };

    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }
    if (category) where.category_id = category;
    if (level)    where.level = level;
    if (language) where.language = language;
    if (is_free === 'true') where.is_free = true;
    if (min_price || max_price) {
      where.price = {};
      if (min_price) where.price[Op.gte] = parseFloat(min_price);
      if (max_price) where.price[Op.lte] = parseFloat(max_price);
    }

    const orderMap = {
      newest:     [['created_at', 'DESC']],
      oldest:     [['created_at', 'ASC']],
      popular:    [['total_enrollments', 'DESC']],
      rating:     [['avg_rating', 'DESC']],
      price_low:  [['price', 'ASC']],
      price_high: [['price', 'DESC']]
    };

    const { count, rows } = await Course.findAndCountAll({
      where,
      include: [
        { model: User,     as: 'instructor', attributes: ['id', 'name', 'avatar'] },
        { model: Category, as: 'category',   attributes: ['id', 'name', 'name_bn'] }
      ],
      order: orderMap[sort] || orderMap.newest,
      limit: parseInt(limit),
      offset,
      attributes: { exclude: ['rejection_reason'] }
    });

    res.json({
      success: true,
      data: {
        courses: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / parseInt(limit))
        }
      }
    });
  } catch (error) {
    logger.error('Get courses error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch courses.' });
  }
};

// ── GET /api/courses/featured ──────────────────────────────
const getFeaturedCourses = async (req, res) => {
  try {
    const courses = await Course.findAll({
      where: { status: 'published' },
      include: [
        { model: User,     as: 'instructor', attributes: ['id', 'name', 'avatar'] },
        { model: Category, as: 'category',   attributes: ['id', 'name'] }
      ],
      limit: 8,
      order: [['total_enrollments', 'DESC']]
    });
    res.json({ success: true, data: { courses } });
  } catch (error) {
    logger.error('Get featured courses error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch featured courses.' });
  }
};

// ── GET /api/courses/instructor/my-courses ─────────────────
const getInstructorCourses = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const where = { instructor_id: req.user.id };
    if (status) where.status = status;

    const { count, rows } = await Course.findAndCountAll({
      where,
      include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit)
    });

    res.json({
      success: true,
      data: {
        courses: rows,
        pagination: { total: count, page: parseInt(page), limit: parseInt(limit) }
      }
    });
  } catch (error) {
    logger.error('Get instructor courses error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch your courses.' });
  }
};

// ── GET /api/courses/:id ───────────────────────────────────
const getCourse = async (req, res) => {
  try {
    const course = await Course.findOne({
      where: { id: req.params.id, status: 'published' },
      include: [
        { model: User,     as: 'instructor', attributes: ['id', 'name', 'avatar', 'bio'] },
        { model: Category, as: 'category' },
        {
          model: Lesson, as: 'lessons',
          where: { is_published: true }, required: false,
          attributes: ['id', 'title', 'title_bn', 'type', 'duration', 'order_index', 'is_preview'],
          order: [['order_index', 'ASC']]
        },
        {
          model: Review, as: 'reviews', limit: 5,
          include: [{ model: User, as: 'student', attributes: ['id', 'name', 'avatar'] }]
        }
      ]
    });

    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found.' });
    }

    let isEnrolled = false;
    if (req.user) {
      const enrollment = await Enrollment.findOne({
        where: { student_id: req.user.id, course_id: course.id, status: 'active' }
      });
      isEnrolled = !!enrollment;
    }

    res.json({ success: true, data: { course, isEnrolled } });
  } catch (error) {
    logger.error('Get course error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch course.' });
  }
};

// ── POST /api/courses ──────────────────────────────────────
const createCourse = async (req, res) => {
  let course = null;
  try {
    const {
      title, title_bn, description, description_bn, short_description,
      category_id, price, discount_price, currency, level, language,
      requirements, what_you_learn, tags, is_free
    } = req.body;

    // ── Validate required fields ───────────────────────────
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Course title is required.' });
    }
    if (!description || !description.trim()) {
      return res.status(400).json({ success: false, message: 'Course description is required.' });
    }

    const isFreeVal      = is_free === true || is_free === 'true';
    const parsedPrice    = isFreeVal ? 0 : (parseFloat(price) || 0);
    const parsedDiscount = (!isFreeVal && discount_price !== '' && discount_price != null && !isNaN(parseFloat(discount_price)))
      ? parseFloat(discount_price) : null;

    // ── Build a guaranteed-unique slug ─────────────────────
    const uniqueSuffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const slug = generateSlug(title.trim(), uniqueSuffix);

    // ── Create the course ──────────────────────────────────
    course = await Course.create({
      instructor_id:    req.user.id,
      title:            title.trim(),
      title_bn:         title_bn?.trim()            || null,
      description:      description.trim(),
      description_bn:   description_bn?.trim()      || null,
      short_description:short_description?.trim()   || null,
      category_id:      category_id                 || null,
      price:            parsedPrice,
      discount_price:   parsedDiscount,
      currency:         currency                    || 'BDT',
      level:            level                       || 'all_levels',
      language:         language                    || 'en',
      requirements:     safeParseJSON(requirements),
      what_you_learn:   safeParseJSON(what_you_learn),
      tags:             safeParseJSON(tags),
      is_free:          isFreeVal,
      status:           'draft',
      slug,
      // Counters default to 0 — make sure DB columns have defaults too
      total_lessons:     0,
      total_enrollments: 0,
      avg_rating:        0,
    });

    // ── Handle thumbnail upload ────────────────────────────
    if (req.file) {
      try {
        const thumbnailUrl = await uploadToCloud(req.file, 'course-thumbnails');
        if (thumbnailUrl) {
          await course.update({ thumbnail: thumbnailUrl });
        }
      } catch (uploadErr) {
        // Non-fatal: course is already saved, just log the upload failure
        logger.error('Thumbnail upload error (non-fatal):', uploadErr.message);
      }
    }

    // Return fresh record
    const freshCourse = await Course.findByPk(course.id, {
      include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }]
    });

    res.status(201).json({
      success: true,
      message: 'Course created successfully.',
      data: { course: freshCourse }
    });

  } catch (error) {
    logger.error('Create course error:', error);

    // Sequelize validation / unique constraint details
    if (error.name === 'SequelizeValidationError') {
      const messages = error.errors.map(e => e.message).join(', ');
      return res.status(400).json({ success: false, message: `Validation error: ${messages}` });
    }
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ success: false, message: 'A course with that slug already exists. Please change the title.' });
    }

    res.status(500).json({ success: false, message: 'Failed to create course. Please try again.' });
  }
};

// ── PUT /api/courses/:id ───────────────────────────────────
const updateCourse = async (req, res) => {
  try {
    const course = await Course.findOne({
      where: { id: req.params.id, instructor_id: req.user.id }
    });
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found or not authorized.' });
    }

    const allowedFields = [
      'title', 'title_bn', 'description', 'description_bn', 'short_description',
      'category_id', 'price', 'discount_price', 'level', 'language',
      'requirements', 'what_you_learn', 'tags', 'is_free'
    ];

    const updates = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    // Parse JSON fields that might arrive as strings
    ['requirements', 'what_you_learn', 'tags'].forEach(field => {
      if (updates[field] !== undefined) {
        updates[field] = safeParseJSON(updates[field]);
      }
    });

    // Recalculate price logic
    if (updates.is_free === true || updates.is_free === 'true') {
      updates.price = 0;
      updates.discount_price = null;
    }

    if (req.file) {
      try {
        const url = await uploadToCloud(req.file, 'course-thumbnails');
        if (url) updates.thumbnail = url;
      } catch (e) {
        logger.error('Thumbnail update error:', e.message);
      }
    }

    await course.update(updates);

    const updatedCourse = await Course.findByPk(course.id, {
      include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }]
    });

    res.json({ success: true, message: 'Course updated.', data: { course: updatedCourse } });
  } catch (error) {
    logger.error('Update course error:', error);
    res.status(500).json({ success: false, message: 'Failed to update course.' });
  }
};

// ── POST /api/courses/:id/submit ──────────────────────────
const submitForReview = async (req, res) => {
  try {
    const course = await Course.findOne({
      where: { id: req.params.id, instructor_id: req.user.id }
    });
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found.' });
    }

    if (!course.title || !course.description) {
      return res.status(400).json({ success: false, message: 'Course must have a title and description.' });
    }

    const lessonCount = await Lesson.count({
      where: { course_id: course.id, is_published: true }
    });
    if (lessonCount === 0) {
      return res.status(400).json({
        success: false,
        message: 'Add at least one published lesson before submitting.'
      });
    }

    await course.update({ status: 'pending_review' });
    res.json({ success: true, message: 'Course submitted for admin review.' });
  } catch (error) {
    logger.error('Submit for review error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit course.' });
  }
};

// ── DELETE /api/courses/:id ────────────────────────────────
const deleteCourse = async (req, res) => {
  try {
    const course = await Course.findOne({
      where: { id: req.params.id, instructor_id: req.user.id }
    });
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found.' });
    }

    if (course.total_enrollments > 0) {
      await course.update({ status: 'archived' });
      return res.json({ success: true, message: 'Course archived (has enrolled students).' });
    }

    await course.destroy();
    res.json({ success: true, message: 'Course deleted successfully.' });
  } catch (error) {
    logger.error('Delete course error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete course.' });
  }
};

module.exports = {
  getCourses, getCourse, createCourse, updateCourse,
  submitForReview, deleteCourse, getInstructorCourses, getFeaturedCourses
};
