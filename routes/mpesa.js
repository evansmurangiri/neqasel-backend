const express = require('express');
const crypto = require('crypto');
const { stkPush } = require('../utils/mpesa');
const Order = require('../models/Order');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

const PRODUCTS = {
  comrades: {
    name: 'Comrades Masterset',
    amount: 5000,
    file: 'comrades-masterset.zip',
  },
  majiq: {
    name: 'MasterSet Majiq',
    amount: 14499,
    file: 'masterset-majiq.zip',
  },
};

/**
 * ================================
 * STK PUSH INITIATION
 * ================================
 */
router.post('/pay', protect, async (req, res) => {
  try {
    console.log('📩 STK INIT REQUEST:', req.body);

    const { phone, productKey } = req.body;

    const product = PRODUCTS[productKey];
    if (!product) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product.',
      });
    }

    // FORMAT PHONE
    let formattedPhone = phone.replace(/\D/g, '');

    if (formattedPhone.startsWith('0')) {
      formattedPhone = '254' + formattedPhone.slice(1);
    }

    if (formattedPhone.startsWith('7') && formattedPhone.length === 9) {
      formattedPhone = '254' + formattedPhone;
    }

    if (formattedPhone.length !== 12) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format.',
      });
    }

    console.log('📱 Formatted phone:', formattedPhone);

    // CREATE ORDER
    const order = await Order.create({
      user: req.user._id,
      productKey,
      productName: product.name,
      amount: product.amount,
      phone: formattedPhone,
      status: 'pending',
    });

    console.log('🧾 Order created:', order._id.toString());

    // STK PUSH
    const stkResponse = await stkPush({
      phone: formattedPhone,
      amount: product.amount,
      orderId: order._id.toString(),
      description: `${product.name} Purchase`,
    });

    console.log('📲 STK RESPONSE:', stkResponse);

    // IMPORTANT FIX: Safaricom uses ResponseCode string "0"
    if (!stkResponse || stkResponse.ResponseCode !== '0') {
      order.status = 'failed';
      await order.save();

      return res.status(400).json({
        success: false,
        message:
          stkResponse?.ResponseDescription || 'STK Push failed.',
      });
    }

    // FIX: SAFARICOM FIELD NAME CONSISTENCY
    order.checkoutRequestId =
      stkResponse.CheckoutRequestID || stkResponse.CheckoutRequestId;

    order.merchantRequestId = stkResponse.MerchantRequestID;

    await order.save();

    console.log('✅ STK SENT SUCCESSFULLY');

    res.json({
      success: true,
      message: 'STK Push sent successfully.',
      checkoutRequestId: order.checkoutRequestId,
      orderId: order._id,
    });
  } catch (err) {
    console.error('❌ STK PUSH ERROR (ROUTE):', err.response?.data || err.message);

    res.status(500).json({
      success: false,
      message: 'Payment initiation failed.',
    });
  }
});

/**
 * ================================
 * CALLBACK (IMPORTANT)
 * ================================
 */
router.post('/callback', async (req, res) => {
  try {
    console.log('📥 CALLBACK RECEIVED:', JSON.stringify(req.body, null, 2));

    const { Body } = req.body;
    const stkCallback = Body?.stkCallback;

    if (!stkCallback) {
      return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    const checkoutId = stkCallback.CheckoutRequestID;
    const resultCode = stkCallback.ResultCode;

    const order = await Order.findOne({
      checkoutRequestId: checkoutId,
    });

    if (!order) {
      return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    if (resultCode === 0) {
      const meta = stkCallback.CallbackMetadata?.Item || [];

      const receipt = meta.find(
        (i) => i.Name === 'MpesaReceiptNumber'
      )?.Value;

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

      console.log('💰 PAYMENT COMPLETED');
    } else {
      order.status = 'failed';
      await order.save();

      console.log('❌ PAYMENT FAILED');
    }

    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (err) {
    console.error('❌ CALLBACK ERROR:', err.message);
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
});

/**
 * ================================
 * STATUS CHECK
 * ================================
 */
router.get('/status/:checkoutRequestId', protect, async (req, res) => {
  try {
    const order = await Order.findOne({
      checkoutRequestId: req.params.checkoutRequestId,
      user: req.user._id,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.',
      });
    }

    res.json({
      success: true,
      status: order.status,
      downloadToken:
        order.status === 'completed' ? order.downloadToken : null,
      orderId: order._id,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

module.exports = router;