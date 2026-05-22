const express = require('express');
const Booking = require('../models/Booking');
const { stkPush } = require('../utils/mpesa');
const { protect } = require('../middleware/auth');

const router = express.Router();

const CLASSES = {
  beginner:    { name: 'Beginner Forex Class',   amount: 1500 },
  advanced:    { name: 'Advanced Trading Class',  amount: 3000 },
  masterclass: { name: 'Masterclass',             amount: 5000 },
};

// POST /api/bookings
router.post('/', protect, async (req, res) => {
  try {
    const { name, email, phone, className, classDate, message } = req.body;

    const cls = CLASSES[className];
    if (!cls) return res.status(400).json({ success: false, message: 'Invalid class.' });

    let formattedPhone = phone.replace(/\D/g, '');
    if (formattedPhone.startsWith('0')) formattedPhone = '254' + formattedPhone.slice(1);

    const booking = await Booking.create({
      user: req.user._id,
      name, email,
      phone: formattedPhone,
      className,
      classDate: new Date(classDate),
      message,
      amount: cls.amount,
    });

    const stkResponse = await stkPush({
      phone: formattedPhone,
      amount: cls.amount,
      orderId: booking._id.toString(),
      description: cls.name,
    });

    booking.checkoutRequestId = stkResponse.CheckoutRequestID;
    await booking.save();

    res.json({
      success: true,
      message: 'Booking created. M-Pesa prompt sent.',
      checkoutRequestId: stkResponse.CheckoutRequestID,
      bookingId: booking._id,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/bookings/my
router.get('/my', protect, async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user._id }).sort('-createdAt');
    res.json({ success: true, bookings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;