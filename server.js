require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const app = express();

// Connect DB safely
connectDB().catch((err) => {
  console.error('❌ DB connection failed:', err);
  process.exit(1);
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS setup for production + local
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/mpesa', require('./routes/mpesa'));
app.use('/api/download', require('./routes/download'));
app.use('/api/bookings', require('./routes/bookings'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Neqasel API running ✅' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

// PORT (Render uses process.env.PORT)
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Neqasel backend running on port ${PORT}`);
});