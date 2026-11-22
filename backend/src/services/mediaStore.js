const mongoose = require('mongoose');
const multer = require('multer');
const { Readable } = require('stream');

const BUCKET = 'observantMedia';

function fileFilter(_req, file, done) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) return done(new Error('Only JPEG, PNG, or WebP images are accepted.'));
  done(null, true);
}
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 }, fileFilter });
const uploadAvatar = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter,
});

function bucket() {
  if (mongoose.connection.readyState !== 1) throw new Error('MongoDB is not connected.');
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: BUCKET });
}

async function saveImage(file, metadata) {
  if (!file?.buffer) throw new Error('An image file is required.');
  const grid = bucket();
  const uploadStream = grid.openUploadStream(file.originalname || 'patrol.jpg', {
    contentType: file.mimetype,
    metadata,
  });
  await new Promise((resolve, reject) => {
    Readable.from(file.buffer).pipe(uploadStream).on('error', reject).on('finish', resolve);
  });
  return uploadStream.id.toString();
}

function streamImage(id, response) {
  const grid = bucket();
  const stream = grid.openDownloadStream(new mongoose.Types.ObjectId(id));
  stream.on('file', file => {
    let type = file.contentType;
    if (!type || type === 'application/octet-stream') {
      const ext = (file.filename || '').split('.').pop().toLowerCase();
      if (ext === 'png') type = 'image/png';
      else if (ext === 'webp') type = 'image/webp';
      else type = 'image/jpeg';
    }
    response.setHeader('Content-Type', type);
    response.setHeader('Cache-Control', 'public, max-age=86400');
  });
  stream.on('error', error => {
    if (!response.headersSent) response.status(error.code === 'ENOENT' ? 404 : 400).json({ error: 'Image not found.' });
    else response.destroy(error);
  });
  stream.pipe(response);
}

async function imageBelongsToOrganisation(id, organisationId) {
  if (!mongoose.isValidObjectId(id)) return false;
  const file = await bucket().find({ _id: new mongoose.Types.ObjectId(id) }, { limit: 1 }).next();
  return !!file && String(file.metadata?.organisationId) === String(organisationId);
}

module.exports = { upload, uploadAvatar, saveImage, streamImage, imageBelongsToOrganisation };
