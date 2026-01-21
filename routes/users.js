const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Message = require('../models/Message');
const { authenticateToken } = require('../middleware/auth');

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user._id,
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      city: user.city,
      userType: user.userType,
      sellerType: user.sellerType,
      businessName: user.businessName,
      verifiedBatch: user.verifiedBatch,
      verifiedBatchPurchasedAt: user.verifiedBatchPurchasedAt,
      createdAt: user.createdAt
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user messages
router.get('/messages', authenticateToken, async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [
        { receiver: req.user.userId },
        { sender: req.user.userId }
      ]
    })
      .populate('sender', 'name')
      .populate('receiver', 'name')
      .populate('listing', 'title')
      .sort({ createdAt: -1 });

    res.json(messages.map(msg => ({
      id: msg._id,
      _id: msg._id,
      sender_id: msg.sender ? msg.sender._id : null,
      sender: msg.sender ? {
        _id: msg.sender._id,
        name: msg.sender.name
      } : null,
      sender_name: msg.sender ? msg.sender.name : null,
      receiver_id: msg.receiver ? msg.receiver._id : null,
      receiver: msg.receiver ? {
        _id: msg.receiver._id,
        name: msg.receiver.name
      } : null,
      receiver_name: msg.receiver ? msg.receiver.name : null,
      listing_id: msg.listing ? msg.listing._id : null,
      listing_title: msg.listing ? msg.listing.title : null,
      message: msg.message,
      read_status: msg.readStatus,
      readStatus: msg.readStatus,
      created_at: msg.createdAt,
      createdAt: msg.createdAt
    })));
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Send message
router.post('/messages', authenticateToken, async (req, res) => {
  try {
    const { receiver_id, listing_id, message } = req.body;

    const newMessage = new Message({
      sender: req.user.userId,
      receiver: receiver_id,
      listing: listing_id || null,
      message
    });

    await newMessage.save();

    res.status(201).json({ message: 'Message sent successfully' });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
