const express = require('express');
const router = express.Router();
const Category = require('../models/Category');
const Listing = require('../models/Listing');

// Get all categories with count
router.get('/', async (req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    
    const categoriesWithCount = await Promise.all(
      categories.map(async (category) => {
        const count = await Listing.countDocuments({ 
          category: category._id, 
          status: 'active' 
        });
        return {
          id: category._id,
          _id: category._id,
          name: category.name,
          slug: category.slug,
          ad_count: count
        };
      })
    );

    res.json(categoriesWithCount);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get popular locations
router.get('/locations', async (req, res) => {
  try {
    const locations = await Listing.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$city', listing_count: { $sum: 1 } } },
      { $sort: { listing_count: -1 } },
      { $limit: 10 },
      { $project: { city: '$_id', listing_count: 1, _id: 0 } }
    ]);

    res.json(locations);
  } catch (error) {
    console.error('Get locations error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
