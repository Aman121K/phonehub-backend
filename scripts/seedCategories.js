const mongoose = require('mongoose');
const Category = require('../models/Category');
require('dotenv').config();

const categories = [
  { name: 'iPhone SE', slug: 'iphone-se' },
  { name: 'iPhone 6', slug: 'iphone-6' },
  { name: 'iPhone 6s', slug: 'iphone-6s' },
  { name: 'iPhone 6 Plus', slug: 'iphone-6-plus' },
  { name: 'iPhone 6s Plus', slug: 'iphone-6s-plus' },
  { name: 'iPhone 7', slug: 'iphone-7' },
  { name: 'iPhone 7 Plus', slug: 'iphone-7-plus' },
  { name: 'iPhone 8', slug: 'iphone-8' },
  { name: 'iPhone 8 Plus', slug: 'iphone-8-plus' },
  { name: 'iPhone X', slug: 'iphone-x' },
  { name: 'iPhone XR', slug: 'iphone-xr' },
  { name: 'iPhone XS', slug: 'iphone-xs' },
  { name: 'iPhone XS Max', slug: 'iphone-xs-max' },
  { name: 'iPhone 11', slug: 'iphone-11' },
  { name: 'iPhone 11 Pro', slug: 'iphone-11-pro' },
  { name: 'iPhone 11 Pro Max', slug: 'iphone-11-pro-max' },
  { name: 'iPhone 12', slug: 'iphone-12' },
  { name: 'iPhone 12 Mini', slug: 'iphone-12-mini' },
  { name: 'iPhone 12 Pro', slug: 'iphone-12-pro' },
  { name: 'iPhone 12 Pro Max', slug: 'iphone-12-pro-max' },
  { name: 'iPhone 13', slug: 'iphone-13' },
  { name: 'iPhone 13 Mini', slug: 'iphone-13-mini' },
  { name: 'iPhone 13 Pro', slug: 'iphone-13-pro' },
  { name: 'iPhone 13 Pro Max', slug: 'iphone-13-pro-max' },
  { name: 'iPhone 14', slug: 'iphone-14' },
  { name: 'iPhone 14 Plus', slug: 'iphone-14-plus' },
  { name: 'iPhone 14 Pro', slug: 'iphone-14-pro' },
  { name: 'iPhone 14 Pro Max', slug: 'iphone-14-pro-max' },
  { name: 'iPhone 15', slug: 'iphone-15' },
  { name: 'iPhone 15 Plus', slug: 'iphone-15-plus' },
  { name: 'iPhone 15 Pro', slug: 'iphone-15-pro' },
  { name: 'iPhone 15 Pro Max', slug: 'iphone-15-pro-max' },
  { name: 'iPhone 16', slug: 'iphone-16' },
  { name: 'iPhone 16 Plus', slug: 'iphone-16-plus' },
  { name: 'iPhone 16 Pro', slug: 'iphone-16-pro' },
  { name: 'iPhone 16 Pro Max', slug: 'iphone-16-pro-max' },
  { name: 'iPhone 16e', slug: 'iphone-16e' }
];

const seedCategories = async () => {
  try {
    // Get MongoDB URI from environment or use default
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27018/phonehub';
    
    console.log('🔄 Connecting to MongoDB...');
    console.log(`   URI: ${mongoURI.replace(/\/\/.*@/, '//***:***@')}`); // Hide credentials in log
    
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ Connected to MongoDB successfully!\n');

    // Clear existing categories
    console.log('🔄 Clearing existing categories...');
    const deleteResult = await Category.deleteMany({});
    console.log(`   Deleted ${deleteResult.deletedCount} existing categories\n`);

    // Insert new categories
    console.log('🔄 Inserting categories...');
    const insertedCategories = await Category.insertMany(categories);
    console.log(`✅ Successfully seeded ${insertedCategories.length} categories:\n`);
    
    // List all inserted categories in groups
    console.log('📱 iPhone Categories:');
    insertedCategories.forEach((cat, index) => {
      console.log(`   ${(index + 1).toString().padStart(2, ' ')}. ${cat.name.padEnd(25)} (${cat.slug})`);
    });

    console.log('\n✅ Categories are now available in the database!');
    console.log('✅ Users can now select these categories when posting ads.');
    console.log('✅ Frontend will display these categories in the dropdown.\n');
    
    await mongoose.connection.close();
    console.log('✅ Database connection closed.');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error seeding categories:', error.message);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Make sure MongoDB is running');
    console.error('   2. Check your MONGODB_URI in backend/.env file');
    console.error('   3. For MongoDB Atlas, use: mongodb+srv://username:password@cluster.mongodb.net/phonehub');
    console.error('   4. For local MongoDB, make sure it\'s running on port 27017\n');
    process.exit(1);
  }
};

seedCategories();

