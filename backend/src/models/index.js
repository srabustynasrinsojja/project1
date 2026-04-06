// ============================================================
// LearnSpace - All Database Models (Sequelize + MySQL)
// ============================================================
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// ── USER MODEL ─────────────────────────────────────────────
const User = sequelize.define('users', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  email: { type: DataTypes.STRING(150), allowNull: false, unique: true },
  password: { type: DataTypes.STRING(255), allowNull: false },
  role: {
    type: DataTypes.ENUM('student', 'instructor', 'admin'),
    allowNull: false,
    defaultValue: 'student'
  },
  phone: { type: DataTypes.STRING(20) },
  avatar: { type: DataTypes.STRING(500) },
  bio: { type: DataTypes.TEXT },
  language: { type: DataTypes.ENUM('en', 'bn'), defaultValue: 'en' },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  is_verified: { type: DataTypes.BOOLEAN, defaultValue: false },
  email_verified_at: { type: DataTypes.DATE },
  reset_password_token: { type: DataTypes.STRING(255) },
  reset_password_expires: { type: DataTypes.DATE },
  last_login: { type: DataTypes.DATE }
});

// ── INSTRUCTOR PROFILE MODEL ───────────────────────────────
const InstructorProfile = sequelize.define('instructor_profiles', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    references: { model: 'users', key: 'id' }
  },
  verification_status: {
    type: DataTypes.ENUM('pending', 'verified', 'rejected'),
    defaultValue: 'pending'
  },
  expertise: { type: DataTypes.STRING(255) },
  qualifications: { type: DataTypes.TEXT },
  nid_document: { type: DataTypes.STRING(500) },
  certificate_document: { type: DataTypes.STRING(500) },
  rejection_reason: { type: DataTypes.TEXT },
  total_earnings: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0.00 },
  bank_account: { type: DataTypes.STRING(100) },
  payout_method: { type: DataTypes.ENUM('bank', 'bkash', 'paypal'), defaultValue: 'bank' }
});

// ── CATEGORY MODEL ─────────────────────────────────────────
const Category = sequelize.define('categories', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  name_bn: { type: DataTypes.STRING(100) },
  slug: { type: DataTypes.STRING(120), unique: true },
  icon: { type: DataTypes.STRING(100) },
  description: { type: DataTypes.TEXT },
  parent_id: {
    type: DataTypes.INTEGER,
    references: { model: 'categories', key: 'id' },
    defaultValue: null
  }
});

// ── COURSE MODEL ───────────────────────────────────────────
const Course = sequelize.define('courses', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  instructor_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'users', key: 'id' }
  },
  category_id: {
    type: DataTypes.INTEGER,
    references: { model: 'categories', key: 'id' }
  },
  title: { type: DataTypes.STRING(200), allowNull: false },
  title_bn: { type: DataTypes.STRING(200) },
  slug: { type: DataTypes.STRING(250), unique: true },
  description: { type: DataTypes.TEXT, allowNull: false },
  description_bn: { type: DataTypes.TEXT },
  short_description: { type: DataTypes.STRING(500) },
  thumbnail: { type: DataTypes.STRING(500) },
  preview_video: { type: DataTypes.STRING(500) },
  price: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0.00 },
  discount_price: { type: DataTypes.DECIMAL(10, 2) },
  currency: { type: DataTypes.STRING(10), defaultValue: 'BDT' },
  level: {
    type: DataTypes.ENUM('beginner', 'intermediate', 'advanced', 'all_levels'),
    defaultValue: 'all_levels'
  },
  language: { type: DataTypes.ENUM('en', 'bn', 'both'), defaultValue: 'en' },
  status: {
    type: DataTypes.ENUM('draft', 'pending_review', 'published', 'rejected', 'archived'),
    defaultValue: 'draft'
  },
  rejection_reason: { type: DataTypes.TEXT },
  total_lessons: { type: DataTypes.INTEGER, defaultValue: 0 },
  total_duration: { type: DataTypes.INTEGER, defaultValue: 0 }, // in minutes
  total_enrollments: { type: DataTypes.INTEGER, defaultValue: 0 },
  avg_rating: { type: DataTypes.DECIMAL(3, 2), defaultValue: 0.00 },
  total_reviews: { type: DataTypes.INTEGER, defaultValue: 0 },
  is_featured: { type: DataTypes.BOOLEAN, defaultValue: false },
  is_free: { type: DataTypes.BOOLEAN, defaultValue: false },
  requirements: { type: DataTypes.JSON },
  what_you_learn: { type: DataTypes.JSON },
  tags: { type: DataTypes.JSON }
});

// ── LESSON MODEL ───────────────────────────────────────────
const Lesson = sequelize.define('lessons', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  course_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'courses', key: 'id' }
  },
  title: { type: DataTypes.STRING(200), allowNull: false },
  title_bn: { type: DataTypes.STRING(200) },
  description: { type: DataTypes.TEXT },
  type: {
    type: DataTypes.ENUM('video', 'document', 'quiz', 'assignment', 'live'),
    defaultValue: 'video'
  },
  content_url: { type: DataTypes.STRING(500) },
  duration: { type: DataTypes.INTEGER, defaultValue: 0 }, // in seconds
  order_index: { type: DataTypes.INTEGER, allowNull: false },
  is_preview: { type: DataTypes.BOOLEAN, defaultValue: false },
  is_published: { type: DataTypes.BOOLEAN, defaultValue: false },
  resources: { type: DataTypes.JSON } // [{name, url, type}]
});

// ── ENROLLMENT MODEL ───────────────────────────────────────
const Enrollment = sequelize.define('enrollments', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  student_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'users', key: 'id' }
  },
  course_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'courses', key: 'id' }
  },
  payment_id: { type: DataTypes.INTEGER, references: { model: 'payments', key: 'id' } },
  enrolled_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  completed_at: { type: DataTypes.DATE },
  progress_percent: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0.00 },
  status: {
    type: DataTypes.ENUM('active', 'completed', 'refunded', 'suspended'),
    defaultValue: 'active'
  },
  last_accessed: { type: DataTypes.DATE },
  expiry_date: { type: DataTypes.DATE }
});

// ── PAYMENT MODEL ──────────────────────────────────────────
const Payment = sequelize.define('payments', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  student_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'users', key: 'id' }
  },
  course_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'courses', key: 'id' }
  },
  amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  currency: { type: DataTypes.STRING(10), defaultValue: 'BDT' },
  gateway: {
    type: DataTypes.ENUM('stripe', 'sslcommerz', 'paypal', 'free'),
    allowNull: false
  },
  gateway_transaction_id: { type: DataTypes.STRING(255) },
  gateway_order_id: { type: DataTypes.STRING(255), unique: true },
  status: {
    type: DataTypes.ENUM('pending', 'paid', 'failed', 'refunded', 'cancelled'),
    defaultValue: 'pending'
  },
  platform_fee: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0.00 },
  instructor_earning: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0.00 },
  refund_reason: { type: DataTypes.TEXT },
  refunded_at: { type: DataTypes.DATE },
  payment_metadata: { type: DataTypes.JSON }
});

// ── QUIZ MODEL ─────────────────────────────────────────────
const Quiz = sequelize.define('quizzes', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  lesson_id: {
    type: DataTypes.INTEGER,
    references: { model: 'lessons', key: 'id' }
  },
  course_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'courses', key: 'id' }
  },
  title: { type: DataTypes.STRING(200), allowNull: false },
  description: { type: DataTypes.TEXT },
  time_limit: { type: DataTypes.INTEGER }, // in minutes
  passing_score: { type: DataTypes.INTEGER, defaultValue: 60 }, // percentage
  max_attempts: { type: DataTypes.INTEGER, defaultValue: 3 },
  is_published: { type: DataTypes.BOOLEAN, defaultValue: false }
});

// ── QUIZ QUESTION MODEL ────────────────────────────────────
const QuizQuestion = sequelize.define('quiz_questions', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  quiz_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'quizzes', key: 'id' }
  },
  question_text: { type: DataTypes.TEXT, allowNull: false },
  question_type: {
    type: DataTypes.ENUM('multiple_choice', 'true_false', 'short_answer'),
    defaultValue: 'multiple_choice'
  },
  options: { type: DataTypes.JSON }, // [{text, is_correct}]
  correct_answer: { type: DataTypes.TEXT },
  explanation: { type: DataTypes.TEXT },
  points: { type: DataTypes.INTEGER, defaultValue: 1 },
  order_index: { type: DataTypes.INTEGER }
});

// ── QUIZ RESULT MODEL ──────────────────────────────────────
const QuizResult = sequelize.define('quiz_results', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  quiz_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'quizzes', key: 'id' }
  },
  student_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'users', key: 'id' }
  },
  score: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
  total_points: { type: DataTypes.INTEGER },
  earned_points: { type: DataTypes.INTEGER },
  passed: { type: DataTypes.BOOLEAN },
  answers: { type: DataTypes.JSON }, // [{question_id, selected_answer, is_correct}]
  attempt_number: { type: DataTypes.INTEGER, defaultValue: 1 },
  time_taken: { type: DataTypes.INTEGER } // seconds
});

// ── PROGRESS TRACKING MODEL ────────────────────────────────
const Progress = sequelize.define('progress_tracking', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  student_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'users', key: 'id' }
  },
  course_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'courses', key: 'id' }
  },
  lesson_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'lessons', key: 'id' }
  },
  is_completed: { type: DataTypes.BOOLEAN, defaultValue: false },
  completed_at: { type: DataTypes.DATE },
  watch_time: { type: DataTypes.INTEGER, defaultValue: 0 }, // seconds watched
  last_position: { type: DataTypes.INTEGER, defaultValue: 0 } // video position in seconds
});

// ── CERTIFICATE MODEL ──────────────────────────────────────
const Certificate = sequelize.define('certificates', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  student_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'users', key: 'id' }
  },
  course_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'courses', key: 'id' }
  },
  certificate_number: { type: DataTypes.STRING(50), unique: true },
  issued_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  pdf_url: { type: DataTypes.STRING(500) },
  verification_hash: { type: DataTypes.STRING(255), unique: true }
});

// ── INSTRUCTOR EARNINGS MODEL ──────────────────────────────
const InstructorEarning = sequelize.define('instructor_earnings', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  instructor_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'users', key: 'id' }
  },
  payment_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'payments', key: 'id' }
  },
  course_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'courses', key: 'id' }
  },
  gross_amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  platform_fee: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  net_earning: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  status: {
    type: DataTypes.ENUM('pending', 'available', 'paid_out'),
    defaultValue: 'pending'
  },
  paid_out_at: { type: DataTypes.DATE }
});

// ── REVIEW MODEL ───────────────────────────────────────────
const Review = sequelize.define('reviews', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  course_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'courses', key: 'id' }
  },
  student_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'users', key: 'id' }
  },
  rating: { type: DataTypes.INTEGER, allowNull: false }, // 1-5
  comment: { type: DataTypes.TEXT },
  is_published: { type: DataTypes.BOOLEAN, defaultValue: true }
});

// ── ANNOUNCEMENT MODEL ─────────────────────────────────────
const Announcement = sequelize.define('announcements', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  sender_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'users', key: 'id' }
  },
  course_id: { type: DataTypes.INTEGER, references: { model: 'courses', key: 'id' } },
  title: { type: DataTypes.STRING(200), allowNull: false },
  content: { type: DataTypes.TEXT, allowNull: false },
  type: {
    type: DataTypes.ENUM('course', 'platform', 'system'),
    defaultValue: 'course'
  }
});

// ──────────────────────────────────────────────────────────
// ASSOCIATIONS
// ──────────────────────────────────────────────────────────

// User associations
User.hasOne(InstructorProfile, { foreignKey: 'user_id', as: 'instructor_profile' });
InstructorProfile.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(Course, { foreignKey: 'instructor_id', as: 'courses' });
Course.belongsTo(User, { foreignKey: 'instructor_id', as: 'instructor' });

User.hasMany(Enrollment, { foreignKey: 'student_id', as: 'enrollments' });
Enrollment.belongsTo(User, { foreignKey: 'student_id', as: 'student' });

User.hasMany(Payment, { foreignKey: 'student_id', as: 'payments' });
Payment.belongsTo(User, { foreignKey: 'student_id', as: 'student' });

User.hasMany(Certificate, { foreignKey: 'student_id', as: 'certificates' });
Certificate.belongsTo(User, { foreignKey: 'student_id', as: 'student' });

User.hasMany(InstructorEarning, { foreignKey: 'instructor_id', as: 'earnings' });
InstructorEarning.belongsTo(User, { foreignKey: 'instructor_id', as: 'instructor' });

// Course associations
Course.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });
Category.hasMany(Course, { foreignKey: 'category_id', as: 'courses' });

Course.hasMany(Lesson, { foreignKey: 'course_id', as: 'lessons', onDelete: 'CASCADE' });
Lesson.belongsTo(Course, { foreignKey: 'course_id', as: 'course' });

Course.hasMany(Enrollment, { foreignKey: 'course_id', as: 'enrollments' });
Enrollment.belongsTo(Course, { foreignKey: 'course_id', as: 'course' });

Course.hasMany(Payment, { foreignKey: 'course_id', as: 'payments' });
Payment.belongsTo(Course, { foreignKey: 'course_id', as: 'course' });

Course.hasMany(Quiz, { foreignKey: 'course_id', as: 'quizzes' });
Quiz.belongsTo(Course, { foreignKey: 'course_id', as: 'course' });

Course.hasMany(Certificate, { foreignKey: 'course_id', as: 'certificates' });
Certificate.belongsTo(Course, { foreignKey: 'course_id', as: 'course' });

Course.hasMany(Review, { foreignKey: 'course_id', as: 'reviews' });
Review.belongsTo(Course, { foreignKey: 'course_id', as: 'course' });

Course.hasMany(InstructorEarning, { foreignKey: 'course_id', as: 'earnings' });
InstructorEarning.belongsTo(Course, { foreignKey: 'course_id', as: 'course' });

// Lesson associations
Lesson.hasOne(Quiz, { foreignKey: 'lesson_id', as: 'quiz' });
Quiz.belongsTo(Lesson, { foreignKey: 'lesson_id', as: 'lesson' });

Lesson.hasMany(Progress, { foreignKey: 'lesson_id', as: 'progress' });
Progress.belongsTo(Lesson, { foreignKey: 'lesson_id', as: 'lesson' });

// Quiz associations
Quiz.hasMany(QuizQuestion, { foreignKey: 'quiz_id', as: 'questions', onDelete: 'CASCADE' });
QuizQuestion.belongsTo(Quiz, { foreignKey: 'quiz_id', as: 'quiz' });

Quiz.hasMany(QuizResult, { foreignKey: 'quiz_id', as: 'results' });
QuizResult.belongsTo(Quiz, { foreignKey: 'quiz_id', as: 'quiz' });

User.hasMany(QuizResult, { foreignKey: 'student_id', as: 'quiz_results' });
QuizResult.belongsTo(User, { foreignKey: 'student_id', as: 'student' });

// Progress associations
User.hasMany(Progress, { foreignKey: 'student_id', as: 'progress' });
Progress.belongsTo(User, { foreignKey: 'student_id', as: 'student' });

Course.hasMany(Progress, { foreignKey: 'course_id', as: 'progress' });
Progress.belongsTo(Course, { foreignKey: 'course_id', as: 'course' });

// Payment → Earning
Payment.hasOne(InstructorEarning, { foreignKey: 'payment_id', as: 'earning' });
InstructorEarning.belongsTo(Payment, { foreignKey: 'payment_id', as: 'payment' });

// Enrollment → Payment
Enrollment.belongsTo(Payment, { foreignKey: 'payment_id', as: 'payment' });

// Review → Student
User.hasMany(Review, { foreignKey: 'student_id', as: 'reviews' });
Review.belongsTo(User, { foreignKey: 'student_id', as: 'student' });

module.exports = {
  User,
  InstructorProfile,
  Category,
  Course,
  Lesson,
  Enrollment,
  Payment,
  Quiz,
  QuizQuestion,
  QuizResult,
  Progress,
  Certificate,
  InstructorEarning,
  Review,
  Announcement
};
