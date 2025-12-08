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
    enum: ['live', 'ended', 'cancelled'],
    default: 'live'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

auctionSchema.index({ status: 1, endDate: 1 });

module.exports = mongoose.model('Auction', auctionSchema);

