const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  phone: {
    type: String,
    trim: true
  },
  city: {
    type: String,
    trim: true
  },
  userType: {
    type: String,
    enum: ['buyer', 'seller'],
    default: 'buyer'
  },
  sellerType: {
    type: String,
    enum: ['individual', 'business'],
    default: null
  },
  businessName: {
    type: String,
    trim: true
  },
  tradeLicense: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
    index: true
  },
  resetPasswordToken: {
    type: String,
    index: true,
    sparse: true
  },
  resetPasswordExpires: {
    type: Date
  },
  status: {
    type: String,
    enum: ['active', 'blocked'],
    default: 'active',
    index: true
  }
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);

