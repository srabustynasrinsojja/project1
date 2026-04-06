// ============================================================
// LearnSpace - Upload Service (Fixed Windows paths)
// ============================================================
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');
require('dotenv').config();

const uploadsDir = path.resolve(__dirname, '../../uploads');

const subdirs = ['course-thumbnails', 'lesson-videos', 'lesson-docs', 'avatars', 'certificates', 'instructor-docs'];
subdirs.forEach(dir => {
  const full = path.join(uploadsDir, dir);
  if (!fs.existsSync(full)) fs.mkdirSync(full, { recursive: true });
});

// ── Multer storage ─────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const isVideo = file.mimetype.startsWith('video/');
    const isImage = file.mimetype.startsWith('image/');
    let folder = 'lesson-docs';
    if (isVideo)      folder = 'lesson-videos';
    else if (isImage) folder = 'course-thumbnails';
    const dest = path.join(uploadsDir, folder);
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo',
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error(`File type not allowed: ${file.mimetype}`), false);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 500 * 1024 * 1024 } });

// ── Build correct public URL from a local file path ────────
// Handles Windows backslashes: C:\Users\Sifat\...\uploads\course-thumbnails\file.jpg
const buildLocalUrl = (filePath, folder) => {
  const BASE = process.env.API_URL || 'http://localhost:5000';
  // Always use forward slashes
  const normalised = filePath.replace(/\\/g, '/');
  // Find "/uploads/" in the path (case-insensitive search)
  const lower = normalised.toLowerCase();
  const idx   = lower.indexOf('/uploads/');
  if (idx !== -1) {
    // e.g. normalised.substring(idx+1) = "uploads/course-thumbnails/xyz.jpg"
    return `${BASE}/${normalised.substring(idx + 1)}`;
  }
  // Fallback: reconstruct from folder + filename
  const fname = normalised.split('/').pop();
  return `${BASE}/uploads/${folder}/${fname}`;
};

// ── uploadToCloud ──────────────────────────────────────────
const uploadToCloud = async (fileOrBuffer, folder, filename, mimeType) => {
  // Cloudinary
  if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
    const cloudinary = require('cloudinary').v2;
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key:    process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });
    return new Promise((resolve, reject) => {
      const isBuffer     = Buffer.isBuffer(fileOrBuffer);
      const mime         = isBuffer ? mimeType : fileOrBuffer.mimetype;
      const resourceType = mime?.startsWith('video/') ? 'video' : mime?.startsWith('image/') ? 'image' : 'raw';
      const stream = cloudinary.uploader.upload_stream(
        { folder: `learnspace/${folder}`, resource_type: resourceType },
        (err, result) => { if (err) return reject(err); resolve(result.secure_url); }
      );
      if (isBuffer)              stream.end(fileOrBuffer);
      else if (fileOrBuffer.path) fs.createReadStream(fileOrBuffer.path).pipe(stream);
      else if (fileOrBuffer.buffer) stream.end(fileOrBuffer.buffer);
      else reject(new Error('Nothing to upload'));
    });
  }

  // Local: multer saved file to disk — build URL from path
  if (fileOrBuffer && fileOrBuffer.path) {
    return buildLocalUrl(fileOrBuffer.path, folder);
  }

  // Local: raw Buffer
  if (Buffer.isBuffer(fileOrBuffer)) {
    const fname    = filename || `${Date.now()}.bin`;
    const savePath = path.join(uploadsDir, folder, fname);
    fs.mkdirSync(path.dirname(savePath), { recursive: true });
    fs.writeFileSync(savePath, fileOrBuffer);
    const BASE = process.env.API_URL || 'http://localhost:5000';
    return `${BASE}/uploads/${folder}/${fname}`;
  }

  return null;
};

module.exports = upload;
module.exports.uploadToCloud = uploadToCloud;
