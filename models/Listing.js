const mongoose = require('mongoose');

const listingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  perPrice: {
    type: Number,
    min: 0
  },
  storage: {
    type: String,
    trim: true
  },
  condition: {
    type: String,
    trim: true
  },
  city: {
    type: String,
    required: true,
    trim: true
  },
  listingType: {
    type: String,
    enum: ['fixed_price', 'auction'],
    default: 'fixed_price'
  },
  status: {
    type: String,
    enum: ['active', 'sold', 'expired', 'blocked'],
    default: 'active'
  },
  imageUrl: {
    type: String,
    trim: true
  },
  images: {
    type: [String],
    default: []
  },
  sellType: {
    type: String,
    enum: ['single', 'bulk'],
    default: 'single'
  },
  colour: {
    type: String,
    trim: true
  },
  version: {
    type: String,
    trim: true
  },
  charge: {
    type: String,
    trim: true
  },
  box: {
    type: String,
    trim: true
  },
  warranty: {
    type: Boolean,
    default: false
  },
  quantity: {
    type: Number,
    default: 1,
    min: 1
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  featuredExpiryDate: {
    type: Date,
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

listingSchema.index({ city: 1, status: 1 });
listingSchema.index({ category: 1, status: 1 });
listingSchema.index({ listingType: 1, status: 1 });
listingSchema.index({ sellType: 1, status: 1 });
listingSchema.index({ title: 'text', description: 'text' });
listingSchema.index({ isFeatured: 1, status: 1 });

module.exports = mongoose.model('Listing', listingSchema);

