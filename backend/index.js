// server.js
require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const expenseRoutes = require('./routes/expense');

const app = express();
app.use(helmet());
app.use(express.json());
app.use(cookieParser());

// Simple CORS for local dev
const cors = require('cors');
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.get('/', (req, res) => res.send('Expense Auth Service'));
app.use('/api', expenseRoutes);


const PORT = process.env.PORT || 4000;

connectDB(process.env.MONGO_URI).then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}).catch(err => {
  console.error('DB connection failed', err);
  process.exit(1);
});
