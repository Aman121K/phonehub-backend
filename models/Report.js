const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  listing: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Listing',
    required: true
  },
  reporter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reason: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
    default: 'pending'
  },
  adminNotes: {
    type: String,
    trim: true
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

reportSchema.index({ listing: 1, status: 1 });
reportSchema.index({ reporter: 1 });
reportSchema.index({ status: 1 });

module.exports = mongoose.model('Report', reportSchema);

