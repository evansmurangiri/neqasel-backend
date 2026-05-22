const axios = require('axios');

const BASE_URL =
  process.env.MPESA_ENV === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';

/**
 * =========================
 * ACCESS TOKEN (DEBUG)
 * =========================
 */
const getAccessToken = async () => {
  try {
    console.log('🔐 Getting M-Pesa access token...');

    const credentials = Buffer.from(
      `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
    ).toString('base64');

    console.log('🧾 Encoded credentials ready');

    const response = await axios.get(
      `${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
      {
        headers: {
          Authorization: `Basic ${credentials}`,
        },
      }
    );

    console.log('✅ Access token received');

    return response.data.access_token;
  } catch (err) {
    console.error('❌ TOKEN ERROR FULL:', err.response?.data || err.message);
    throw err;
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

  console.log('⏱ Timestamp:', timestamp);

  return timestamp;
};

/**
 * =========================
 * PASSWORD
 * =========================
 */
const generatePassword = (timestamp) => {
  const shortcode = process.env.MPESA_SHORTCODE;
  const passkey = process.env.MPESA_PASSKEY;

  if (!shortcode || !passkey) {
    console.error('❌ Missing shortcode or passkey');
    throw new Error('Missing M-Pesa credentials');
  }

  const password = Buffer.from(
    `${shortcode}${passkey}${timestamp}`
  ).toString('base64');

  console.log('🔑 Password generated');

  return password;
};

/**
 * =========================
 * STK PUSH (FULL DEBUG)
 * =========================
 */
const stkPush = async ({ phone, amount, orderId, description }) => {
  try {
    console.log('📩 ===== STK PUSH START =====');
    console.log('📱 Phone:', phone);
    console.log('💰 Amount:', amount);
    console.log('🧾 Order ID:', orderId);

    const token = await getAccessToken();
    const timestamp = getTimestamp();
    const password = generatePassword(timestamp);

    const callbackUrl =
      process.env.MPESA_ENV === 'production'
        ? process.env.MPESA_CALLBACK_URL
        : process.env.MPESA_CALLBACK_URL_LOCAL;

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

    console.log('📦 STK Payload:', JSON.stringify(payload, null, 2));

    const response = await axios.post(
      `${BASE_URL}/mpesa/stkpush/v1/processrequest`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('📲 ===== STK RESPONSE =====');
    console.log(response.data);

    if (response.data.ResponseCode === '0') {
      console.log('✅ STK PUSH SUCCESS');
    } else {
      console.log('⚠️ STK PUSH FAILED RESPONSE');
    }

    return response.data;
  } catch (err) {
    console.error('❌ STK ERROR FULL:', err.response?.data || err.message);
    throw err;
  }
};

module.exports = { stkPush };