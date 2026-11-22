const router = require('express').Router();
const mongoose = require('mongoose');
const { streamImage } = require('../services/mediaStore');

router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: 'Image not found.' });
    }
    streamImage(req.params.id, res);
  } catch (error) {
    console.error('[Media] Read failed:', error.message);
    if (!res.headersSent) res.status(500).json({ error: 'Image could not be loaded.' });
  }
});

module.exports = router;
