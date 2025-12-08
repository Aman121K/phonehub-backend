const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const Report = require('../models/Report');
const Listing = require('../models/Listing');

// Report a listing (authenticated users only)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { listing_id, reason, description } = req.body;
    
    if (!listing_id || !reason) {
      return res.status(400).json({ error: 'Listing ID and reason are required' });
    }

    const listing = await Listing.findById(listing_id);
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    // Check if user already reported this listing
    const existingReport = await Report.findOne({
      listing: listing_id,
      reporter: req.user.userId,
      status: 'pending'
    });

    if (existingReport) {
      return res.status(400).json({ error: 'You have already reported this listing' });
    }

    const report = new Report({
      listing: listing_id,
      reporter: req.user.userId,
      reason,
      description: description || ''
    });

    await report.save();
    res.status(201).json({ message: 'Report submitted successfully', report });
  } catch (error) {
    console.error('Create report error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

