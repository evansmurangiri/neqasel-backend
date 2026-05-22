require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const app = express();

connectDB();

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth',     require('./routes/auth'));
app.use('/api/mpesa',    require('./routes/mpesa'));
app.use('/api/download', require('./routes/download'));
app.use('/api/bookings', require('./routes/bookings'));

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Neqasel API running ✅' });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Neqasel backend running on port ${PORT}`);
});