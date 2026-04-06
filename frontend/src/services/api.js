// ============================================================
// LearnSpace - API Service (Axios)
// ============================================================
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
});

// Request interceptor - attach token
api.interceptors.request.use(
  (config) => {
    const auth = JSON.parse(localStorage.getItem('learnspace-auth') || '{}');
    const token = auth?.state?.token;
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const auth = JSON.parse(localStorage.getItem('learnspace-auth') || '{}');
        const refreshToken = auth?.state?.refreshToken;

        if (!refreshToken) {
          window.location.href = '/login';
          return Promise.reject(error);
        }

        const res = await axios.post('/api/auth/refresh-token', { refreshToken });
        const { token } = res.data.data;

        // Update stored token
        const stored = JSON.parse(localStorage.getItem('learnspace-auth'));
        stored.state.token = token;
        localStorage.setItem('learnspace-auth', JSON.stringify(stored));

        originalRequest.headers['Authorization'] = `Bearer ${token}`;
        return api(originalRequest);
      } catch {
        localStorage.removeItem('learnspace-auth');
        window.location.href = '/login';
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default api;

// ── Course API helpers ─────────────────────────────────────
export const courseAPI = {
  getAll: (params) => api.get('/courses', { params }),
  getFeatured: () => api.get('/courses/featured'),
  getOne: (id) => api.get(`/courses/${id}`),
  create: (data) => api.post('/courses', data),
  update: (id, data) => api.put(`/courses/${id}`, data),
  submit: (id) => api.post(`/courses/${id}/submit`),
  delete: (id) => api.delete(`/courses/${id}`),
  getMine: (params) => api.get('/courses/instructor/my-courses', { params })
};

export const paymentAPI = {
  createOrder: (data) => api.post('/payments/create-order', data),
  confirmStripe: (data) => api.post('/payments/stripe/confirm', data),
  getHistory: (params) => api.get('/payments/history', { params })
};

export const progressAPI = {
  markComplete: (lessonId, data) => api.post(`/progress/lesson/${lessonId}`, data),
  getCourseProgress: (courseId) => api.get(`/progress/course/${courseId}`),
  updatePosition: (lessonId, data) => api.patch(`/progress/lesson/${lessonId}/position`, data)
};

export const certAPI = {
  generate: (courseId) => api.post(`/certificates/generate/${courseId}`),
  verify: (hash) => api.get(`/certificates/verify/${hash}`),
  getMine: () => api.get('/certificates/my')
};

export const adminAPI = {
  getDashboard: () => api.get('/admin/dashboard'),
  getPendingInstructors: () => api.get('/admin/instructors/pending'),
  verifyInstructor: (id, data) => api.patch(`/admin/instructors/${id}/verify`, data),
  getPendingCourses: () => api.get('/admin/courses/pending'),
  reviewCourse: (id, data) => api.patch(`/admin/courses/${id}/review`, data),
  getUsers: (params) => api.get('/admin/users', { params }),
  toggleUser: (id) => api.patch(`/admin/users/${id}/toggle`),
  getRevenue: (params) => api.get('/admin/reports/revenue', { params })
};
