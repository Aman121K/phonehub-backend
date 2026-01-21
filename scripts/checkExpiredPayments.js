/**
 * Script to check and handle expired payments
 * This should be run periodically (e.g., every hour) via cron job
 * 
 * Usage:
 * node scripts/checkExpiredPayments.js
 * 
 * Or set up a cron job:
 * 0 * * * * cd /path/to/backend && node scripts/checkExpiredPayments.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/database');
const { handleExpiredPayments } = require('../services/paymentService');
const { sendPaymentReminderEmail } = require('../services/emailService');
const Payment = require('../models/Payment');
const User = require('../models/User');

const runExpiredPaymentsCheck = async () => {
  try {
    console.log('Starting expired payments check...');
    
    // Connect to database
    await connectDB();
    console.log('Connected to database');

    // Handle expired payments (blocks users, notifies second bidders)
    const results = await handleExpiredPayments();
    console.log('Expired payments handled:', results);

    // Send payment reminders for payments expiring soon (24 hours and 12 hours)
    const now = new Date();
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in12Hours = new Date(now.getTime() + 12 * 60 * 60 * 1000);

    // Find payments expiring in 24 hours
    const paymentsExpiring24h = await Payment.find({
      status: 'pending',
      paymentDeadline: {
        $gte: now,
        $lte: in24Hours
      },
      paymentType: 'auction_winner'
    }).populate('user').populate('auction');

    for (const payment of paymentsExpiring24h) {
      try {
        const hoursRemaining = Math.round((payment.paymentDeadline - now) / (1000 * 60 * 60));
        
        // Only send reminder if it's been at least 12 hours since last reminder
        // (This is a simple check - you might want to track last reminder time in the payment model)
        if (hoursRemaining <= 24 && hoursRemaining > 12) {
          const listing = await require('../models/Listing').findById(payment.auction?.listing);
          await sendPaymentReminderEmail(
            payment.user.email,
            payment.user.name,
            listing ? listing.title : 'Auction Item',
            payment.amount,
            payment.paymentLink,
            hoursRemaining
          ).catch(err => console.error(`Failed to send reminder for payment ${payment._id}:`, err));
        }
      } catch (error) {
        console.error(`Error sending reminder for payment ${payment._id}:`, error);
      }
    }

    // Find payments expiring in 12 hours
    const paymentsExpiring12h = await Payment.find({
      status: 'pending',
      paymentDeadline: {
        $gte: now,
        $lte: in12Hours
      },
      paymentType: 'auction_winner'
    }).populate('user').populate('auction');

    for (const payment of paymentsExpiring12h) {
      try {
        const hoursRemaining = Math.round((payment.paymentDeadline - now) / (1000 * 60 * 60));
        
        if (hoursRemaining <= 12 && hoursRemaining > 0) {
          const listing = await require('../models/Listing').findById(payment.auction?.listing);
          await sendPaymentReminderEmail(
            payment.user.email,
            payment.user.name,
            listing ? listing.title : 'Auction Item',
            payment.amount,
            payment.paymentLink,
            hoursRemaining
          ).catch(err => console.error(`Failed to send reminder for payment ${payment._id}:`, err));
        }
      } catch (error) {
        console.error(`Error sending reminder for payment ${payment._id}:`, error);
      }
    }

    console.log('Expired payments check completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error in expired payments check:', error);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  runExpiredPaymentsCheck();
}

module.exports = runExpiredPaymentsCheck;


