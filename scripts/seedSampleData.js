const mongoose = require('mongoose');
const User = require('../models/User');
const Category = require('../models/Category');
const Listing = require('../models/Listing');
const Auction = require('../models/Auction');
require('dotenv').config();

const sampleUsers = [
  {
    name: 'Ahmed Al Maktoum',
    email: 'ahmed@example.com',
    password: 'password123',
    phone: '+971501234567',
    city: 'Dubai',
    userType: 'seller'
  },
  {
    name: 'Sarah Johnson',
    email: 'sarah@example.com',
    password: 'password123',
    phone: '+971502345678',
    city: 'Abu Dhabi',
    userType: 'seller'
  },
  {
    name: 'Mohammed Hassan',
    email: 'mohammed@example.com',
    password: 'password123',
    phone: '+971503456789',
    city: 'Sharjah',
    userType: 'seller'
  }
];

const sampleListings = [
  {
    title: 'iPhone 15 Pro Max 256GB - Brand New',
    description: 'Brand new iPhone 15 Pro Max in Natural Titanium. Still sealed in box. Full warranty. Perfect condition.',
    price: 4500,
    storage: '256GB',
    condition: 'Brand New',
    city: 'Dubai',
    listingType: 'fixed_price',
    imageUrl: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=500'
  },
  {
    title: 'iPhone 14 Pro 128GB - Excellent Condition',
    description: 'iPhone 14 Pro in Deep Purple. Used for 3 months only. Like new condition. All accessories included.',
    price: 3200,
    storage: '128GB',
    condition: 'Excellent',
    city: 'Abu Dhabi',
    listingType: 'fixed_price',
    imageUrl: 'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=500'
  },
  {
    title: 'iPhone 13 Pro Max 512GB - Good Condition',
    description: 'iPhone 13 Pro Max in Graphite. Well maintained. Battery health 92%. Comes with original box and charger.',
    price: 2800,
    storage: '512GB',
    condition: 'Good',
    city: 'Sharjah',
    listingType: 'fixed_price',
    imageUrl: 'https://images.unsplash.com/photo-1632669021382-3e0d1c1b0b4c?w=500'
  },
  {
    title: 'iPhone 12 64GB - Fair Condition',
    description: 'iPhone 12 in Blue. Some minor scratches on screen. Fully functional. Great for daily use.',
    price: 1800,
    storage: '64GB',
    condition: 'Fair',
    city: 'Dubai',
    listingType: 'fixed_price',
    imageUrl: 'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=500'
  },
  {
    title: 'iPhone 15 Pro 1TB - Premium',
    description: 'iPhone 15 Pro in Blue Titanium. Maximum storage. Perfect for professionals. All accessories.',
    price: 5200,
    storage: '1TB',
    condition: 'Brand New',
    city: 'Abu Dhabi',
    listingType: 'fixed_price',
    imageUrl: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=500'
  },
  {
    title: 'iPhone 14 256GB - Very Good',
    description: 'iPhone 14 in Midnight. Used for 6 months. Excellent battery life. No issues.',
    price: 2500,
    storage: '256GB',
    condition: 'Very Good',
    city: 'Dubai',
    listingType: 'fixed_price',
    imageUrl: 'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=500'
  }
];

const seedSampleData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/phonehub');
    console.log('Connected to MongoDB');

    // Get categories
    const categories = await Category.find();
    if (categories.length === 0) {
      console.log('Please seed categories first!');
      process.exit(1);
    }

    // Create sample users
    console.log('Creating sample users...');
    const createdUsers = [];
    for (const userData of sampleUsers) {
      const existingUser = await User.findOne({ email: userData.email });
      if (!existingUser) {
        const user = new User(userData);
        await user.save();
        createdUsers.push(user);
        console.log(`Created user: ${user.name}`);
      } else {
        createdUsers.push(existingUser);
      }
    }

    // Create sample listings
    console.log('Creating sample listings...');
    const iphone15Category = categories.find(c => c.slug === 'iphone-15-pro-max') || categories[0];
    const iphone14Category = categories.find(c => c.slug === 'iphone-14-pro') || categories[0];
    const iphone13Category = categories.find(c => c.slug === 'iphone-13-pro-max') || categories[0];
    const iphone12Category = categories.find(c => c.slug === 'iphone-12') || categories[0];

    const categoryMap = [
      iphone15Category,
      iphone14Category,
      iphone13Category,
      iphone12Category,
      iphone15Category,
      iphone14Category
    ];

    for (let i = 0; i < sampleListings.length; i++) {
      const listingData = sampleListings[i];
      const listing = new Listing({
        ...listingData,
        user: createdUsers[i % createdUsers.length]._id,
        category: categoryMap[i]._id,
        images: [
          listingData.imageUrl,
          'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=500',
          'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=500'
        ]
      });
      await listing.save();
      console.log(`Created listing: ${listing.title}`);
    }

    // Create sample auctions
    console.log('Creating sample auctions...');
    const auctionListings = await Listing.find({ listingType: 'fixed_price' }).limit(2);
    for (const listing of auctionListings) {
      const existingAuction = await Auction.findOne({ listing: listing._id });
      if (!existingAuction) {
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 7); // 7 days from now
        
        const auction = new Auction({
          listing: listing._id,
          startPrice: listing.price * 0.8,
          currentPrice: listing.price * 0.8,
          endDate: endDate
        });
        await auction.save();
        
        // Update listing to auction type
        listing.listingType = 'auction';
        await listing.save();
        
        console.log(`Created auction for: ${listing.title}`);
      }
    }

    console.log('Sample data seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding sample data:', error);
    process.exit(1);
  }
};

seedSampleData();

