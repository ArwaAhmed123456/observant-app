/**
 * Cloudinary upload service.
 * Uses multer + multer-storage-cloudinary for multipart upload handling.
 *
 * Setup:
 *  Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in .env
 */
const cloudinary         = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer             = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── Patrol checkpoint photo storage ──────────────────────────────────────────
const patrolStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder:         `observant/${req.user.organisationId}/patrols`,
    allowed_formats:['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1200, crop: 'limit', quality: 'auto' }],
    public_id:      `patrol_${req.user._id}_${Date.now()}`,
  }),
});

const uploadPatrolPhoto = multer({
  storage: patrolStorage,
  limits:  { fileSize: 10 * 1024 * 1024 }, // 10 MB max
}).single('photo');

// ── Avatar / logo storage ────────────────────────────────────────────────────
const avatarStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:         'observant/avatars',
    allowed_formats:['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 400, height: 400, crop: 'fill', quality: 'auto' }],
  },
});

const uploadAvatar = multer({
  storage: avatarStorage,
  limits:  { fileSize: 5 * 1024 * 1024 },
}).single('avatar');

// ── Delete a Cloudinary asset ─────────────────────────────────────────────────
async function deleteAsset(publicId) {
  try {
    return await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error('[Cloudinary] Delete error:', err.message);
    return null;
  }
}

module.exports = { cloudinary, uploadPatrolPhoto, uploadAvatar, deleteAsset };
