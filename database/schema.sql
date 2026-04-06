-- ============================================================
-- LearnSpace - Complete MySQL Database Schema
-- ============================================================
-- Run: mysql -u root -p < schema.sql

CREATE DATABASE IF NOT EXISTS learnspace_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE learnspace_db;

-- ── Users ──────────────────────────────────────────────────
CREATE TABLE users (
  id                     INT AUTO_INCREMENT PRIMARY KEY,
  name                   VARCHAR(100)   NOT NULL,
  email                  VARCHAR(150)   NOT NULL UNIQUE,
  password               VARCHAR(255)   NOT NULL,
  role                   ENUM('student','instructor','admin') NOT NULL DEFAULT 'student',
  phone                  VARCHAR(20),
  avatar                 VARCHAR(500),
  bio                    TEXT,
  language               ENUM('en','bn') DEFAULT 'en',
  is_active              TINYINT(1)     DEFAULT 1,
  is_verified            TINYINT(1)     DEFAULT 0,
  email_verified_at      DATETIME,
  reset_password_token   VARCHAR(255),
  reset_password_expires DATETIME,
  last_login             DATETIME,
  created_at             DATETIME       DEFAULT CURRENT_TIMESTAMP,
  updated_at             DATETIME       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_role  (role)
);

-- ── Instructor Profiles ────────────────────────────────────
CREATE TABLE instructor_profiles (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  user_id               INT          NOT NULL UNIQUE,
  verification_status   ENUM('pending','verified','rejected') DEFAULT 'pending',
  expertise             VARCHAR(255),
  qualifications        TEXT,
  nid_document          VARCHAR(500),
  certificate_document  VARCHAR(500),
  rejection_reason      TEXT,
  total_earnings        DECIMAL(12,2) DEFAULT 0.00,
  bank_account          VARCHAR(100),
  payout_method         ENUM('bank','bkash','paypal') DEFAULT 'bank',
  created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_verification_status (verification_status)
);

-- ── Categories ─────────────────────────────────────────────
CREATE TABLE categories (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE,
  name_bn     VARCHAR(100),
  slug        VARCHAR(120) UNIQUE,
  icon        VARCHAR(100),
  description TEXT,
  parent_id   INT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- ── Courses ────────────────────────────────────────────────
CREATE TABLE courses (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  instructor_id       INT          NOT NULL,
  category_id         INT,
  title               VARCHAR(200) NOT NULL,
  title_bn            VARCHAR(200),
  slug                VARCHAR(250) UNIQUE,
  description         TEXT         NOT NULL,
  description_bn      TEXT,
  short_description   VARCHAR(500),
  thumbnail           VARCHAR(500),
  preview_video       VARCHAR(500),
  price               DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  discount_price      DECIMAL(10,2),
  currency            VARCHAR(10)   DEFAULT 'BDT',
  level               ENUM('beginner','intermediate','advanced','all_levels') DEFAULT 'all_levels',
  language            ENUM('en','bn','both') DEFAULT 'en',
  status              ENUM('draft','pending_review','published','rejected','archived') DEFAULT 'draft',
  rejection_reason    TEXT,
  total_lessons       INT           DEFAULT 0,
  total_duration      INT           DEFAULT 0,
  total_enrollments   INT           DEFAULT 0,
  avg_rating          DECIMAL(3,2)  DEFAULT 0.00,
  total_reviews       INT           DEFAULT 0,
  is_featured         TINYINT(1)    DEFAULT 0,
  is_free             TINYINT(1)    DEFAULT 0,
  requirements        JSON,
  what_you_learn      JSON,
  tags                JSON,
  created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (instructor_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (category_id)   REFERENCES categories(id) ON DELETE SET NULL,
  INDEX idx_status      (status),
  INDEX idx_instructor  (instructor_id),
  FULLTEXT INDEX idx_search (title, description)
);

-- ── Lessons ────────────────────────────────────────────────
CREATE TABLE lessons (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  course_id    INT          NOT NULL,
  title        VARCHAR(200) NOT NULL,
  title_bn     VARCHAR(200),
  description  TEXT,
  type         ENUM('video','document','quiz','assignment','live') DEFAULT 'video',
  content_url  VARCHAR(500),
  duration     INT          DEFAULT 0,
  order_index  INT          NOT NULL,
  is_preview   TINYINT(1)   DEFAULT 0,
  is_published TINYINT(1)   DEFAULT 0,
  resources    JSON,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  INDEX idx_course_order (course_id, order_index)
);

-- ── Payments ───────────────────────────────────────────────
CREATE TABLE payments (
  id                     INT AUTO_INCREMENT PRIMARY KEY,
  student_id             INT          NOT NULL,
  course_id              INT          NOT NULL,
  amount                 DECIMAL(10,2) NOT NULL,
  currency               VARCHAR(10)  DEFAULT 'BDT',
  gateway                ENUM('stripe','sslcommerz','paypal','free') NOT NULL,
  gateway_transaction_id VARCHAR(255),
  gateway_order_id       VARCHAR(255) UNIQUE,
  status                 ENUM('pending','paid','failed','refunded','cancelled') DEFAULT 'pending',
  platform_fee           DECIMAL(10,2) DEFAULT 0.00,
  instructor_earning     DECIMAL(10,2) DEFAULT 0.00,
  refund_reason          TEXT,
  refunded_at            DATETIME,
  payment_metadata       JSON,
  created_at             DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at             DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES users(id)   ON DELETE RESTRICT,
  FOREIGN KEY (course_id)  REFERENCES courses(id)  ON DELETE RESTRICT,
  INDEX idx_student (student_id),
  INDEX idx_status  (status)
);

-- ── Enrollments ────────────────────────────────────────────
CREATE TABLE enrollments (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  student_id       INT NOT NULL,
  course_id        INT NOT NULL,
  payment_id       INT,
  enrolled_at      DATETIME     DEFAULT CURRENT_TIMESTAMP,
  completed_at     DATETIME,
  progress_percent DECIMAL(5,2) DEFAULT 0.00,
  status           ENUM('active','completed','refunded','suspended') DEFAULT 'active',
  last_accessed    DATETIME,
  expiry_date      DATETIME,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_student_course (student_id, course_id),
  FOREIGN KEY (student_id) REFERENCES users(id)    ON DELETE RESTRICT,
  FOREIGN KEY (course_id)  REFERENCES courses(id)  ON DELETE RESTRICT,
  FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL,
  INDEX idx_student (student_id),
  INDEX idx_status  (status)
);

-- ── Quizzes ────────────────────────────────────────────────
CREATE TABLE quizzes (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  lesson_id    INT,
  course_id    INT NOT NULL,
  title        VARCHAR(200) NOT NULL,
  description  TEXT,
  time_limit   INT,
  passing_score INT DEFAULT 60,
  max_attempts INT DEFAULT 3,
  is_published TINYINT(1) DEFAULT 0,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE SET NULL,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- ── Quiz Questions ─────────────────────────────────────────
CREATE TABLE quiz_questions (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  quiz_id       INT  NOT NULL,
  question_text TEXT NOT NULL,
  question_type ENUM('multiple_choice','true_false','short_answer') DEFAULT 'multiple_choice',
  options       JSON,
  correct_answer TEXT,
  explanation   TEXT,
  points        INT DEFAULT 1,
  order_index   INT,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
);

-- ── Quiz Results ───────────────────────────────────────────
CREATE TABLE quiz_results (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  quiz_id        INT NOT NULL,
  student_id     INT NOT NULL,
  score          DECIMAL(5,2) NOT NULL,
  total_points   INT,
  earned_points  INT,
  passed         TINYINT(1),
  answers        JSON,
  attempt_number INT DEFAULT 1,
  time_taken     INT,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (quiz_id)    REFERENCES quizzes(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES users(id)   ON DELETE CASCADE,
  INDEX idx_student_quiz (student_id, quiz_id)
);

-- ── Progress Tracking ──────────────────────────────────────
CREATE TABLE progress_tracking (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  student_id     INT NOT NULL,
  course_id      INT NOT NULL,
  lesson_id      INT NOT NULL,
  is_completed   TINYINT(1) DEFAULT 0,
  completed_at   DATETIME,
  watch_time     INT DEFAULT 0,
  last_position  INT DEFAULT 0,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_student_lesson (student_id, lesson_id),
  FOREIGN KEY (student_id) REFERENCES users(id)   ON DELETE CASCADE,
  FOREIGN KEY (course_id)  REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (lesson_id)  REFERENCES lessons(id) ON DELETE CASCADE,
  INDEX idx_student_course (student_id, course_id)
);

-- ── Certificates ───────────────────────────────────────────
CREATE TABLE certificates (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  student_id         INT          NOT NULL,
  course_id          INT          NOT NULL,
  certificate_number VARCHAR(50)  NOT NULL UNIQUE,
  issued_at          DATETIME     DEFAULT CURRENT_TIMESTAMP,
  pdf_url            VARCHAR(500),
  verification_hash  VARCHAR(255) UNIQUE,
  created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_student_course_cert (student_id, course_id),
  FOREIGN KEY (student_id) REFERENCES users(id)   ON DELETE CASCADE,
  FOREIGN KEY (course_id)  REFERENCES courses(id) ON DELETE CASCADE
);

-- ── Instructor Earnings ────────────────────────────────────
CREATE TABLE instructor_earnings (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  instructor_id  INT          NOT NULL,
  payment_id     INT          NOT NULL,
  course_id      INT          NOT NULL,
  gross_amount   DECIMAL(10,2) NOT NULL,
  platform_fee   DECIMAL(10,2) NOT NULL,
  net_earning    DECIMAL(10,2) NOT NULL,
  status         ENUM('pending','available','paid_out') DEFAULT 'pending',
  paid_out_at    DATETIME,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (instructor_id) REFERENCES users(id)    ON DELETE RESTRICT,
  FOREIGN KEY (payment_id)    REFERENCES payments(id) ON DELETE RESTRICT,
  FOREIGN KEY (course_id)     REFERENCES courses(id)  ON DELETE RESTRICT,
  INDEX idx_instructor_status (instructor_id, status)
);

-- ── Reviews ────────────────────────────────────────────────
CREATE TABLE reviews (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  course_id    INT NOT NULL,
  student_id   INT NOT NULL,
  rating       INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment      TEXT,
  is_published TINYINT(1) DEFAULT 1,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_student_course_review (student_id, course_id),
  FOREIGN KEY (course_id)  REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES users(id)   ON DELETE CASCADE
);

-- ── Announcements ──────────────────────────────────────────
CREATE TABLE announcements (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  sender_id INT          NOT NULL,
  course_id INT,
  title     VARCHAR(200) NOT NULL,
  content   TEXT         NOT NULL,
  type      ENUM('course','platform','system') DEFAULT 'course',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sender_id) REFERENCES users(id)   ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- ── Seed Default Admin ─────────────────────────────────────
-- Password: Admin@12345 (bcrypt hashed)
INSERT INTO users (name, email, password, role, is_active, is_verified) VALUES
('Platform Admin', 'admin@learnspace.com',
 '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/4Wujqsm',
 'admin', 1, 1);

-- ── Seed Categories ────────────────────────────────────────
INSERT INTO categories (name, name_bn, slug, icon) VALUES
('Web Development',   'ওয়েব ডেভেলপমেন্ট', 'web-development',   '💻'),
('Data Science',      'ডেটা সায়েন্স',      'data-science',      '📊'),
('UI/UX Design',      'UI/UX ডিজাইন',      'ui-ux-design',      '🎨'),
('Mobile Apps',       'মোবাইল অ্যাপ',       'mobile-apps',       '📱'),
('Digital Marketing', 'ডিজিটাল মার্কেটিং', 'digital-marketing', '📣'),
('Business',          'ব্যবসা',             'business',          '💼'),
('Python',            'পাইথন',              'python',            '🐍'),
('Machine Learning',  'মেশিন লার্নিং',      'machine-learning',  '🤖');
