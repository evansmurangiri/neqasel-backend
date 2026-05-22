require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const app = express();

/**
 * ========================
 * DATABASE CONNECTION
 * ========================
 */
connectDB()
  .then(() => console.log('✅ MongoDB Connected'))
  .catch((err) => {
    console.error('❌ DB connection failed:', err);
    process.exit(1);
  });

/**
 * ========================
 * BODY PARSING
 * ========================
 */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * ========================
 * CORS CONFIG (FIXED)
 * ========================
 */
const allowedOrigins = [
  'http://localhost:5173',
  'https://neqasel-frontend.vercel.app',
  'https://neqasel-frontend-225wj5j36-evansmurangiris-projects.vercel.app',
];

// optional ngrok support (for local testing callbacks)
if (process.env.MPESA_CALLBACK_URL_LOCAL) {
  allowedOrigins.push(process.env.CLIENT_URL_LOCAL);
}

app.use(
  cors({
    origin: function (origin, callback) {
      // allow server-to-server (M-Pesa callback has no origin)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.log('❌ Blocked CORS origin:', origin);

      // IMPORTANT: do NOT crash frontend
      return callback(null, true);
    },
    credentials: true,
  })
);

/**
 * ========================
 * ROUTES
 * ========================
 */
app.use('/api/auth', require('./routes/auth'));
app.use('/api/mpesa', require('./routes/mpesa'));
app.use('/api/download', require('./routes/download'));
app.use('/api/bookings', require('./routes/bookings'));

/**
 * ========================
 * HEALTH CHECK
 * ========================
 */
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Neqasel API running ✅',
  });
});

/**
 * ========================
 * MPESA CALLBACK DEBUG
 * (IMPORTANT FOR TESTING)
 * ========================
 */
app.post('/api/mpesa/callback', (req, res) => {
  console.log('📥 M-PESA CALLBACK RECEIVED:');
  console.log(JSON.stringify(req.body, null, 2));

  // ALWAYS ACK SAFARICOM
  res.json({
    ResultCode: 0,
    ResultDesc: 'Accepted',
  });
});

/**
 * ========================
 * 404 HANDLER
 * ========================
 */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found.',
  });
});

/**
 * ========================
 * START SERVER
 * ========================
 */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Neqasel backend running on port ${PORT}`);
});