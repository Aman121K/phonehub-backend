const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  paymentType: {
    type: String,
    enum: ['featured_listing', 'auction_winner', 'verified_batch'],
    required: true
  },
  // For featured listing payments
  listing: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Listing',
    default: null
  },
  // For auction winner payments
  auction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Auction',
    default: null
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'AED'
  },
  stripePaymentIntentId: {
    type: String,
    default: null
  },
  stripeSessionId: {
    type: String,
    default: null
  },
  ziinaPaymentIntentId: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded', 'expired'],
    default: 'pending'
  },
  paymentDeadline: {
    type: Date,
    required: true
  },
  paidAt: {
    type: Date,
    default: null
  },
  paymentLink: {
    type: String,
    default: null
  },
  // For auction: track if this is first winner or second bidder
  isSecondBidder: {
    type: Boolean,
    default: false
  },
  // For featured listing: duration in days
  featuredDuration: {
    type: Number,
    default: null
  },
  // Store listing data temporarily before payment (for featured listings)
  listingData: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

paymentSchema.index({ user: 1, status: 1 });
paymentSchema.index({ paymentType: 1, status: 1 });
paymentSchema.index({ paymentDeadline: 1 });
paymentSchema.index({ stripePaymentIntentId: 1 });
paymentSchema.index({ stripeSessionId: 1 });
paymentSchema.index({ ziinaPaymentIntentId: 1 });

module.exports = mongoose.model('Payment', paymentSchema);


