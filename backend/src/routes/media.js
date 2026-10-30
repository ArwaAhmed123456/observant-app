const router = require('express').Router();
const mongoose = require('mongoose');
const { authenticate } = require('../middleware/auth');
const { imageBelongsToOrganisation, streamImage } = require('../services/mediaStore');
const { verifySignedMedia } = require('../utils/signedMedia');

router.get('/:id', (req, res, next) => {
  if (req.headers.authorization) return authenticate(req, res, next);
  next();
}, async (req, res) => {
  try {
    const organisationId = req.user?.organisationId || req.query.org;
    const signedAccess = !req.user && verifySignedMedia(req.params.id, organisationId, req.query.expires, req.query.signature);
    if (!mongoose.isValidObjectId(req.params.id) || (!req.user && !signedAccess) || !(await imageBelongsToOrganisation(req.params.id, organisationId))) {
      return res.status(404).json({ error: 'Image not found.' });
    }
    streamImage(req.params.id, res);
  } catch (error) {
    console.error('[Media] Read failed:', error.message);
    if (!res.headersSent) res.status(500).json({ error: 'Image could not be loaded.' });
  }
});

module.exports = router;
