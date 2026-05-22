const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  name:    { type: String, required: true },
  email:   { type: String, required: true },
  phone:   { type: String, required: true },
  className: {
    type: String,
    required: true,
    enum: ['beginner', 'advanced', 'masterclass'],
  },
  classDate:  { type: Date, required: true },
  message:    { type: String },
  amount:     { type: Number, required: true },
  checkoutRequestId:  { type: String },
  mpesaReceiptNumber: { type: String },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled'],
    default: 'pending',
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Booking', bookingSchema);