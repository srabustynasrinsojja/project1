<<<<<<< HEAD
# LearnSpace 🚀
### A Production-Ready E-Learning Marketplace Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20-green.svg)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://reactjs.org)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-orange.svg)](https://mysql.com)

---

## 📋 Overview

LearnSpace is a full-stack online learning marketplace where:
- **Students** browse, purchase, and learn from structured courses with video lessons, quizzes, and certificates
- **Instructors** create and publish courses, manage students, and earn revenue
- **Admins** verify instructors, approve courses, and monitor the platform

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND LAYER                        │
│         React.js + TailwindCSS + Zustand               │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTP/REST
┌───────────────────────▼─────────────────────────────────┐
│                   API LAYER (Nginx)                      │
│              Rate Limiting + SSL/TLS                     │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│              BUSINESS LOGIC LAYER                        │
│    Node.js + Express.js + JWT + bcrypt                  │
│  ┌──────────┬──────────┬──────────┬──────────────────┐  │
│  │   Auth   │  Course  │ Payment  │    Analytics     │  │
│  │ Service  │ Service  │ Service  │    Service       │  │
│  └──────────┴──────────┴──────────┴──────────────────┘  │
└───────────────────────┬─────────────────────────────────┘
                        │ Sequelize ORM
┌───────────────────────▼─────────────────────────────────┐
│                  DATABASE LAYER                          │
│               MySQL 8.0 (Relational)                    │
└─────────────────────────────────────────────────────────┘
         │                    │                    │
┌────────▼────────┐ ┌────────▼────────┐ ┌────────▼────────┐
│   Cloudinary    │ │     Stripe      │ │   SSLCommerz    │
│ (Media Storage) │ │ (Int'l Payment) │ │ (BD Payment)    │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

---

## 📁 Project Structure

```
learnspace/
├── backend/
│   ├── src/
│   │   ├── config/         # DB config
│   │   ├── controllers/    # Auth, Course, Payment, Progress, Admin, Lesson
│   │   ├── middleware/     # JWT auth, RBAC, validation, upload
│   │   ├── models/         # All Sequelize models + associations
│   │   ├── routes/         # Express route definitions
│   │   ├── services/       # Email, Upload (Cloudinary)
│   │   └── utils/          # Logger (Winston)
│   ├── Dockerfile
│   ├── package.json
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── common/     # Navbar, UI components, Route guards
│   │   ├── context/        # Zustand auth store
│   │   ├── pages/
│   │   │   ├── student/    # Dashboard, Learn, Certificates
│   │   │   ├── instructor/ # Dashboard, CreateCourse, Earnings
│   │   │   └── admin/      # Dashboard, Users, Instructors, Reports
│   │   ├── services/       # Axios API client
│   │   └── App.js          # Routes
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
│
├── database/
│   └── schema.sql          # Complete MySQL schema + seed data
│
├── deployment/
│   └── docker-compose.yml  # Docker Compose stack
│
└── .github/
    └── workflows/
        └── ci-cd.yml       # GitHub Actions CI/CD pipeline
```

---

## 🚀 Quick Start (Development)

### Prerequisites
- Node.js 20+
- MySQL 8.0+
- Git

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/learnspace.git
cd learnspace
```

### 2. Database Setup
```bash
mysql -u root -p < database/schema.sql
```

### 3. Backend Setup
```bash
cd backend
cp .env.example .env
# Fill in your values in .env
npm install
npm run dev
```

### 4. Frontend Setup
```bash
cd frontend
npm install
npm start
```

### Default Admin Login
```
Email:    admin@learnspace.com
Password: Admin@12345
```

---

## 🐳 Docker Deployment

```bash
# Copy and configure environment
cp backend/.env.example backend/.env

# Build and start all services
cd deployment
docker compose up -d --build

# View logs
docker compose logs -f backend
```

---

## 🔑 Environment Variables

See `backend/.env.example` for all required variables:

| Variable | Description |
|----------|-------------|
| `DB_*` | MySQL connection details |
| `JWT_SECRET` | JWT signing key (use long random string) |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `SSLCOMMERZ_STORE_ID` | SSLCommerz store credentials |
| `CLOUDINARY_*` | Cloudinary media storage |
| `SMTP_*` | Email server (Gmail/Sendgrid) |
| `PLATFORM_COMMISSION` | Revenue split % (default: 30) |

---

## 📡 API Endpoints Summary

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | Public | Register student/instructor |
| POST | `/api/auth/login` | Public | Login |
| GET | `/api/courses` | Public | Browse courses |
| POST | `/api/courses` | Instructor | Create course |
| POST | `/api/payments/create-order` | Student | Initiate payment |
| POST | `/api/progress/lesson/:id` | Student | Mark lesson complete |
| POST | `/api/certificates/generate/:courseId` | Student | Get certificate |
| GET | `/api/admin/dashboard` | Admin | Platform stats |
| PATCH | `/api/admin/instructors/:id/verify` | Admin | Verify instructor |
| PATCH | `/api/admin/courses/:id/review` | Admin | Approve/reject course |

---

## 🛡️ Security Features

- **Passwords**: bcrypt (12 rounds)
- **Auth**: JWT with refresh token rotation
- **API**: Rate limiting (100 req/15min), stricter on auth routes
- **Headers**: Helmet.js security headers
- **Input**: express-validator on all inputs
- **RBAC**: Role-based access (student / instructor / admin)
- **Payments**: Stripe webhook signature verification

---

## 🌐 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TailwindCSS, Zustand, React Router v6 |
| Backend | Node.js 20, Express.js, Sequelize ORM |
| Database | MySQL 8.0 |
| Auth | JWT + bcrypt |
| Payments | Stripe, SSLCommerz |
| Storage | Cloudinary |
| Email | Nodemailer |
| Deployment | Docker, Nginx, GitHub Actions |

---

## 👥 User Roles

| Feature | Student | Instructor | Admin |
|---------|---------|-----------|-------|
| Browse courses | ✅ | ✅ | ✅ |
| Enroll & pay | ✅ | ❌ | ❌ |
| Watch lessons | ✅ | ✅ | ✅ |
| Create courses | ❌ | ✅ | ✅ |
| Verify instructors | ❌ | ❌ | ✅ |
| Approve courses | ❌ | ❌ | ✅ |
| View all payments | ❌ | ❌ | ✅ |

---

## 📄 License

MIT License — see [LICENSE](LICENSE)

---

*Built with ❤️ for Bangladesh's digital education ecosystem*
=======
# project1
my first project<br>
author-sojja
>>>>>>> bea36ce67f2eb8ad4a4f9a6dc9a8667a09ab7dca
