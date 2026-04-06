const express = require('express');
const router = express.Router();
const { generateCertificate, verifyCertificate, getMyCertificates } = require('../controllers/progress.controller');
const { protect } = require('../middleware/auth.middleware');

router.post('/generate/:courseId', protect, generateCertificate);
router.get('/verify/:hash', verifyCertificate);
router.get('/my', protect, getMyCertificates);

module.exports = router;
