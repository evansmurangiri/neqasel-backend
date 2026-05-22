const express = require('express');
const path = require('path');
const fs = require('fs');
const Order = require('../models/Order');
const { protect } = require('../middleware/auth');

const router = express.Router();

const FILES_DIR = path.join(__dirname, '../private-files');

// GET /api/download/:token
router.get('/:token', protect, async (req, res) => {
  try {
    const order = await Order.findOne({
      downloadToken: req.params.token,
      user: req.user._id,
      status: 'completed',
    });

    if (!order) {
      return res.status(403).json({ success: false, message: 'Invalid or expired download link.' });
    }

    const PRODUCTS = {
      comrades: 'comrades-masterset.zip',
      majiq:    'masterset-majiq.zip',
    };

    const filename = PRODUCTS[order.productKey];
    const filePath = path.join(FILES_DIR, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'File not found. Contact support.' });
    }

    order.downloadCount += 1;
    await order.save();

    res.download(filePath, filename);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;