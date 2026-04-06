const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { User, InstructorProfile } = require('../models');
const { protect, authorize } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');
const { uploadToCloud } = require('../services/upload.service');

// GET /api/users/profile
router.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password', 'reset_password_token', 'reset_password_expires'] },
      include: [{ model: InstructorProfile, as: 'instructor_profile' }]
    });
    res.json({ success: true, data: { user } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch profile.' });
  }
});

// PUT /api/users/profile
router.put('/profile', protect, upload.single('avatar'), async (req, res) => {
  try {
    const { name, phone, bio, language } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (phone) updates.phone = phone;
    if (bio !== undefined) updates.bio = bio;
    if (language) updates.language = language;
    if (req.file) {
      updates.avatar = await uploadToCloud(req.file, 'avatars');
    }
    await req.user.update(updates);
    res.json({ success: true, message: 'Profile updated.', data: { user: req.user } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update profile.' });
  }
});

// PUT /api/users/change-password
router.put('/change-password', protect, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const user = await User.findByPk(req.user.id);
    const match = await bcrypt.compare(current_password, user.password);
    if (!match) return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    const hashed = await bcrypt.hash(new_password, 12);
    await user.update({ password: hashed });
    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to change password.' });
  }
});

// POST /api/users/instructor/apply
router.post('/instructor/apply', protect, authorize('instructor'), upload.fields([{ name: 'nid' }, { name: 'certificate' }]), async (req, res) => {
  try {
    const { expertise, qualifications } = req.body;
    const [profile] = await InstructorProfile.findOrCreate({
      where: { user_id: req.user.id },
      defaults: { user_id: req.user.id }
    });
    let nid_doc = profile.nid_document;
    let cert_doc = profile.certificate_document;
    if (req.files?.nid) nid_doc = await uploadToCloud(req.files.nid[0], 'instructor-docs');
    if (req.files?.certificate) cert_doc = await uploadToCloud(req.files.certificate[0], 'instructor-docs');
    await profile.update({ expertise, qualifications, nid_document: nid_doc, certificate_document: cert_doc, verification_status: 'pending', rejection_reason: null });
    res.json({ success: true, message: 'Application submitted for review.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Application failed.' });
  }
});

module.exports = router;
