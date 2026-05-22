const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  productKey:  { type: String, required: true },
  productName: { type: String, required: true },
  amount:      { type: Number, required: true },
  phone:       { type: String, required: true },
  checkoutRequestId:  { type: String },
  merchantRequestId:  { type: String },
  mpesaReceiptNumber: { type: String },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'pending',
  },
  downloadCount: { type: Number, default: 0 },
  downloadToken: { type: String },
  createdAt: { type: Date, default: Date.now },
  paidAt:    { type: Date },
});

module.exports = mongoose.model('Order', orderSchema);