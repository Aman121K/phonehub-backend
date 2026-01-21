const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./config/database');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Connect to MongoDB
connectDB();

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/listings', require('./routes/listings'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/auctions', require('./routes/auctions'));
app.use('/api/users', require('./routes/users'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/blogs', require('./routes/blogs'));
app.use('/api/payments', require('./routes/payments'));

// Locations endpoint (alias for /api/categories/locations)
app.get('/api/locations', async (req, res) => {
  try {
    const Listing = require('./models/Listing');
    const locations = await Listing.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$city', listing_count: { $sum: 1 } } },
      { $sort: { listing_count: -1 } },
      { $limit: 20 },
      { $project: { city: '$_id', listing_count: 1, _id: 0 } }
    ]);
    res.json(locations);
  } catch (error) {
    console.error('Get locations error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'PhoneHub API is running' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

