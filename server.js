require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const app = express();

// ========================
// DB CONNECTION
// ========================
connectDB().catch((err) => {
  console.error('❌ DB connection failed:', err);
  process.exit(1);
});

// ========================
// BODY PARSING
// ========================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========================
// CORS (LOCAL + PRODUCTION FIX)
// ========================
const allowedOrigins = [
  'http://localhost:5173',
  'https://neqasel-frontend.vercel.app',
  'https://neqasel-frontend-225wj5j36-evansmurangiris-projects.vercel.app'
];

app.use(
  cors({
    origin: function (origin, callback) {
      // allow server-to-server or mobile apps (no origin)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.log('❌ Blocked CORS origin:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

// ========================
// ROUTES
// ========================
app.use('/api/auth', require('./routes/auth'));
app.use('/api/mpesa', require('./routes/mpesa'));
app.use('/api/download', require('./routes/download'));
app.use('/api/bookings', require('./routes/bookings'));

// ========================
// HEALTH CHECK
// ========================
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Neqasel API running ✅',
  });
});

// ========================
// 404 HANDLER
// ========================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found.',
  });
});

// ========================
// START SERVER
// ========================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Neqasel backend running on port ${PORT}`);
});