const mongoose = require('mongoose');
const User = require('../models/User');
const connectDB = require('../config/database');
require('dotenv').config();

const createAdminUser = async () => {
  try {
    // Connect to database
    await connectDB();
    console.log('Connected to MongoDB');

    // Admin user details
    const adminData = {
      name: 'vikas tiwatri',
      email: 'vikas.tiwatri@admin.com',
      password: 'Admin@123', // Password will be hashed by the pre-save hook
      phone: '+971501234567',
      city: 'Dubai',
      role: 'admin',
      userType: 'seller',
      sellerType: 'individual'
    };

    // Check if admin user already exists
    const existingAdmin = await User.findOne({ 
      $or: [
        { email: adminData.email },
        { role: 'admin', name: adminData.name }
      ]
    });

    if (existingAdmin) {
      console.log('Admin user already exists!');
      console.log('Email:', existingAdmin.email);
      console.log('Name:', existingAdmin.name);
      console.log('Role:', existingAdmin.role);
      
      // Update existing user to admin if not already
      if (existingAdmin.role !== 'admin') {
        existingAdmin.role = 'admin';
        await existingAdmin.save();
        console.log('Updated existing user to admin role');
      }
      
      console.log('\n✅ You can login with:');
      console.log('Email:', existingAdmin.email);
      console.log('Password: (your existing password)');
      process.exit(0);
    }

    // Create new admin user
    const adminUser = new User(adminData);
    await adminUser.save();

    console.log('\n✅ Admin user created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Admin Login Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Name:', adminUser.name);
    console.log('Email:', adminUser.email);
    console.log('Password: Admin@123');
    console.log('Role:', adminUser.role);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n⚠️  Please change the password after first login!');
    console.log('\n✅ You can now login to the admin panel at: /admin');

    process.exit(0);
  } catch (error) {
    console.error('Error creating admin user:', error);
    if (error.code === 11000) {
      console.error('User with this email already exists!');
    }
    process.exit(1);
  }
};

// Run the script
createAdminUser();

