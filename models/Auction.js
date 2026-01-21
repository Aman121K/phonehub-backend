const mongoose = require('mongoose');

const auctionSchema = new mongoose.Schema({
  listing: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Listing',
    required: true,
    unique: true
  },
  startPrice: {
    type: Number,
    required: true,
    min: 0
  },
  currentPrice: {
    type: Number,
    required: true,
    min: 0
  },
  endDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['live', 'ended', 'cancelled', 'paid', 'payment_failed'],
    default: 'live'
  },
  winner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  secondBidder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'expired', 'second_bidder_pending'],
    default: null
  },
  paymentDeadline: {
    type: Date,
    default: null
  },
  paymentCompletedAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

auctionSchema.index({ status: 1, endDate: 1 });

module.exports = mongoose.model('Auction', auctionSchema);

