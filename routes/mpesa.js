const express = require('express');
const crypto = require('crypto');
const { stkPush } = require('../utils/mpesa');
const Order = require('../models/Order');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

const PRODUCTS = {
  comrades: { name: 'Comrades Masterset', amount: 5000,  file: 'comrades-masterset.zip' },
  majiq:    { name: 'MasterSet Majiq',    amount: 14499, file: 'masterset-majiq.zip'    },
};

// POST /api/mpesa/pay
router.post('/pay', protect, async (req, res) => {
  try {
    const { phone, productKey } = req.body;

    const product = PRODUCTS[productKey];
    if (!product) {
      return res.status(400).json({ success: false, message: 'Invalid product.' });
    }

    let formattedPhone = phone.replace(/\D/g, '');
    if (formattedPhone.startsWith('0')) formattedPhone = '254' + formattedPhone.slice(1);
    if (formattedPhone.startsWith('7') && formattedPhone.length === 9) formattedPhone = '254' + formattedPhone;
    if (formattedPhone.length !== 12) {
      return res.status(400).json({ success: false, message: 'Invalid phone number.' });
    }

    const order = await Order.create({
      user: req.user._id,
      productKey,
      productName: product.name,
      amount: product.amount,
      phone: formattedPhone,
    });

    const stkResponse = await stkPush({
      phone: formattedPhone,
      amount: product.amount,
      orderId: order._id.toString(),
      description: `${product.name} Purchase`,
    });

    if (stkResponse.ResponseCode !== '0') {
      order.status = 'failed';
      await order.save();
      return res.status(400).json({ success: false, message: stkResponse.ResponseDescription });
    }

    order.checkoutRequestId = stkResponse.CheckoutRequestID;
    order.merchantRequestId = stkResponse.MerchantRequestID;
    await order.save();

    res.json({
      success: true,
      message: 'STK Push sent.',
      checkoutRequestId: stkResponse.CheckoutRequestID,
      orderId: order._id,
    });
  } catch (err) {
    console.error('STK Push Error:', err.message);
    res.status(500).json({ success: false, message: 'Payment initiation failed. Try again.' });
  }
});

// POST /api/mpesa/callback  (Safaricom calls this)
router.post('/callback', async (req, res) => {
  try {
    const { Body } = req.body;
    const { stkCallback } = Body;
    const { CheckoutRequestID, ResultCode, CallbackMetadata } = stkCallback;

    const order = await Order.findOne({ checkoutRequestId: CheckoutRequestID });
    if (!order) return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });

    if (ResultCode === 0) {
      const meta = CallbackMetadata.Item;
      const receipt = meta.find(i => i.Name === 'MpesaReceiptNumber')?.Value;

      order.status = 'completed';
      order.mpesaReceiptNumber = receipt;
      order.paidAt = new Date();
      order.downloadToken = crypto.randomBytes(32).toString('hex');
      await order.save();

      await User.findByIdAndUpdate(order.user, {
        $push: {
          purchases: {
            productKey: order.productKey,
            productName: order.productName,
            amount: order.amount,
            paidAt: new Date(),
            mpesaReceiptNumber: receipt,
          },
        },
      });
    } else {
      order.status = 'failed';
      await order.save();
    }

    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (err) {
    console.error('Callback error:', err.message);
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
});

// GET /api/mpesa/status/:checkoutRequestId
router.get('/status/:checkoutRequestId', protect, async (req, res) => {
  try {
    const order = await Order.findOne({
      checkoutRequestId: req.params.checkoutRequestId,
      user: req.user._id,
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    res.json({
      success: true,
      status: order.status,
      downloadToken: order.status === 'completed' ? order.downloadToken : null,
      orderId: order._id,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;