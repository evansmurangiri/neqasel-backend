const axios = require('axios');

const BASE_URL =
  process.env.MPESA_ENV === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';

/**
 * =========================
 * ACCESS TOKEN
 * =========================
 */
const getAccessToken = async () => {
  try {
    console.log('🔐 Getting M-Pesa access token...');

    const credentials = Buffer.from(
      `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
    ).toString('base64');

    const response = await axios.get(
      `${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
      {
        headers: {
          Authorization: `Basic ${credentials}`,
        },
        timeout: 15000,
      }
    );

    console.log('✅ Access token received');

    return response.data.access_token;
  } catch (err) {
    console.log('❌ ACCESS TOKEN ERROR');

    if (err.response) {
      console.log('STATUS:', err.response.status);
      console.log('DATA:', err.response.data);
    } else {
      console.log('ERROR:', err.message);
    }

    throw new Error('FAILED TO GET MPESA ACCESS TOKEN');
  }
};

/**
 * =========================
 * TIMESTAMP
 * =========================
 */
const getTimestamp = () => {
  const d = new Date();

  const timestamp =
    d.getFullYear() +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0') +
    String(d.getHours()).padStart(2, '0') +
    String(d.getMinutes()).padStart(2, '0') +
    String(d.getSeconds()).padStart(2, '0');

  return timestamp;
};

/**
 * =========================
 * PASSWORD
 * =========================
 */
const generatePassword = (timestamp) => {
  return Buffer.from(
    `${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`
  ).toString('base64');
};

/**
 * =========================
 * STK PUSH (FIXED)
 * =========================
 */
const stkPush = async ({ phone, amount, orderId, description }) => {
  try {
    console.log('\n📩 ===== STK PUSH START =====');

    const token = await getAccessToken();
    const timestamp = getTimestamp();
    const password = generatePassword(timestamp);

    /**
     * ✅ FIXED: ALWAYS use production callback from env
     * (NO local split — this was breaking your Render deployment)
     */
    const callbackUrl = process.env.MPESA_CALLBACK_URL;

    if (!callbackUrl) {
      throw new Error('MPESA_CALLBACK_URL is not set in environment');
    }

    console.log('🌐 Callback URL:', callbackUrl);

    const payload = {
      BusinessShortCode: process.env.MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(amount),
      PartyA: phone,
      PartyB: process.env.MPESA_SHORTCODE,
      PhoneNumber: phone,
      CallBackURL: callbackUrl,
      AccountReference: `ORDER-${orderId}`,
      TransactionDesc: description || 'Payment',
    };

    console.log('📦 STK Payload Ready');

    const response = await axios.post(
      `${BASE_URL}/mpesa/stkpush/v1/processrequest`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        timeout: 20000,
      }
    );

    console.log('📲 STK RESPONSE:', response.data);

    if (!response.data || response.data.ResponseCode !== '0') {
      throw new Error(
        response.data?.ResponseDescription || 'STK PUSH FAILED'
      );
    }

    console.log('✅ STK PUSH SUCCESS');

    return response.data;
  } catch (err) {
    console.log('\n❌ MPESA STK ERROR');

    if (err.response) {
      console.log('STATUS:', err.response.status);
      console.log('DATA:', err.response.data);
    } else {
      console.log('ERROR:', err.message);
    }

    throw err;
  }
};

module.exports = {
  stkPush,
};