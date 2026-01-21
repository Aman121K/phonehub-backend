const Payment = require('../models/Payment');

const ZIINA_API_URL = 'https://api-v2.ziina.com/api';
const ZIINA_ACCESS_TOKEN = process.env.ZIINA_ACCESS_TOKEN;
const ZIINA_TEST_MODE = process.env.ZIINA_TEST_MODE === 'true' || process.env.NODE_ENV !== 'production';

/**
 * Create a Ziina Payment Intent for payment
 * @param {Object} params - Payment parameters
 * @param {String} params.userId - User ID
 * @param {String} params.paymentType - 'featured_listing' or 'auction_winner'
 * @param {Number} params.amount - Amount in AED (will be converted to fils)
 * @param {String} params.listingId - Listing ID (for featured listing)
 * @param {String} params.auctionId - Auction ID (for auction winner)
 * @param {Date} params.paymentDeadline - Payment deadline
 * @param {Boolean} params.isSecondBidder - Whether this is second bidder payment
 * @param {Number} params.featuredDuration - Duration in days for featured listing
 * @returns {Object} Payment object and Ziina redirect URL
 */
const createPaymentSession = async (params) => {
  try {
    if (!ZIINA_ACCESS_TOKEN) {
      throw new Error('Ziina is not configured. Please set ZIINA_ACCESS_TOKEN in your environment variables.');
    }

    const { userId, paymentType, amount, listingId, auctionId, paymentDeadline, isSecondBidder = false, featuredDuration = null, listingData = null } = params;

    // Convert AED to fils (base units for Ziina)
    // 1 AED = 100 fils
    const amountInFils = Math.round(amount * 100);

    // Create payment record
    const payment = new Payment({
      user: userId,
      paymentType,
      listing: listingId || null,
      auction: auctionId || null,
      amount,
      currency: 'AED',
      status: 'pending',
      paymentDeadline,
      isSecondBidder,
      featuredDuration: featuredDuration || null,
      listingData: listingData || null
    });
    await payment.save();

    // Determine success, cancel, and failure URLs
    // Use production URL: https://phonehub.ae/ or from environment variable
    const baseUrl = process.env.FRONTEND_URL || 'https://phonehub.ae';
    let successUrl, cancelUrl, failureUrl, message = '';

    if (paymentType === 'featured_listing') {
      successUrl = `${baseUrl}/payment/success?payment_id=${payment._id}&pi={PAYMENT_INTENT_ID}`;
      cancelUrl = `${baseUrl}/payment/cancel?payment_id=${payment._id}&pi={PAYMENT_INTENT_ID}`;
      failureUrl = `${baseUrl}/payment/failure?payment_id=${payment._id}&pi={PAYMENT_INTENT_ID}`;
      message = `Featured Listing Payment (${featuredDuration} days)`;
    } else if (paymentType === 'auction_winner') {
      successUrl = `${baseUrl}/payment/success?payment_id=${payment._id}&pi={PAYMENT_INTENT_ID}`;
      cancelUrl = `${baseUrl}/payment/cancel?payment_id=${payment._id}&pi={PAYMENT_INTENT_ID}`;
      failureUrl = `${baseUrl}/payment/failure?payment_id=${payment._id}&pi={PAYMENT_INTENT_ID}`;
      message = `Auction Winner Payment${isSecondBidder ? ' (Second Bidder)' : ''}`;
    } else if (paymentType === 'verified_batch') {
      successUrl = `${baseUrl}/payment/success?payment_id=${payment._id}&pi={PAYMENT_INTENT_ID}`;
      cancelUrl = `${baseUrl}/payment/cancel?payment_id=${payment._id}&pi={PAYMENT_INTENT_ID}`;
      failureUrl = `${baseUrl}/payment/failure?payment_id=${payment._id}&pi={PAYMENT_INTENT_ID}`;
      message = 'Verified Batch Purchase';
    }

    // Create Ziina Payment Intent
    const paymentIntentData = {
      amount: amountInFils,
      currency_code: 'AED',
      message: message,
      success_url: successUrl,
      cancel_url: cancelUrl,
      failure_url: failureUrl,
    };

    // Add test mode if enabled
    if (ZIINA_TEST_MODE) {
      paymentIntentData.test = true;
      console.log('⚠️  Ziina Test Mode Enabled - Payment will be processed in test mode');
    }

    const ziinaResponse = await fetch(`${ZIINA_API_URL}/payment_intent`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ZIINA_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paymentIntentData),
    });

    if (!ziinaResponse.ok) {
      const errorText = await ziinaResponse.text();
      throw new Error(`Ziina create intent failed: ${errorText}`);
    }

    const ziinaData = await ziinaResponse.json();

    // Update payment with Ziina payment intent ID
    payment.ziinaPaymentIntentId = ziinaData.id;
    payment.stripeSessionId = ziinaData.id; // Keep for backward compatibility
    payment.paymentLink = ziinaData.redirect_url;
    await payment.save();

    return {
      payment,
      paymentIntent: ziinaData,
      paymentLink: ziinaData.redirect_url
    };
  } catch (error) {
    console.error('Error creating payment session:', error);
    throw error;
  }
};

/**
 * Verify payment completion from Ziina API
 * @param {String} paymentIntentId - Ziina payment intent ID
 * @returns {Object} Updated payment object
 */
const verifyPayment = async (paymentIntentId) => {
  try {
    if (!ZIINA_ACCESS_TOKEN) {
      throw new Error('Ziina is not configured. Please set ZIINA_ACCESS_TOKEN in your environment variables.');
    }

    // Fetch payment intent status from Ziina
    const ziinaResponse = await fetch(`${ZIINA_API_URL}/payment_intent/${paymentIntentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ZIINA_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (!ziinaResponse.ok) {
      const errorText = await ziinaResponse.text();
      throw new Error(`Ziina fetch payment intent failed: ${errorText}`);
    }

    const ziinaData = await ziinaResponse.json();
    
    // Ziina status: 'pending', 'completed', 'failed', 'cancelled'
    if (ziinaData.status === 'completed') {
      const payment = await Payment.findOne({ 
        $or: [
          { ziinaPaymentIntentId: paymentIntentId },
          { stripeSessionId: paymentIntentId } // Backward compatibility
        ]
      });
      
      if (!payment) {
        throw new Error('Payment record not found');
      }

      if (payment.status === 'completed') {
        return payment; // Already processed
      }

      payment.status = 'completed';
      payment.paidAt = new Date(ziinaData.completed_at || new Date());
      payment.stripePaymentIntentId = paymentIntentId; // Store for backward compatibility
      await payment.save();

      return payment;
    }

    return null;
  } catch (error) {
    console.error('Error verifying payment:', error);
    throw error;
  }
};

/**
 * Check and handle expired payments
 * @returns {Object} Summary of expired payments handled
 */
const handleExpiredPayments = async () => {
  try {
    const now = new Date();
    
    // Find expired pending payments
    const expiredPayments = await Payment.find({
      status: 'pending',
      paymentDeadline: { $lt: now }
    }).populate('user').populate('auction');

    const results = {
      blocked: 0,
      secondBidderNotified: 0,
      errors: []
    };

    for (const payment of expiredPayments) {
      try {
        if (payment.paymentType === 'auction_winner') {
          // Block the user for lifetime
          const User = require('../models/User');
          const user = await User.findById(payment.user._id);
          if (user) {
            user.status = 'blocked';
            await user.save();
            results.blocked++;
          }

          // Update payment status
          payment.status = 'expired';
          await payment.save();

          // If this was first winner, notify second bidder
          if (!payment.isSecondBidder && payment.auction) {
            const Auction = require('../models/Auction');
            const Listing = require('../models/Listing');
            const auction = await Auction.findById(payment.auction._id || payment.auction)
              .populate('listing');
            
            if (auction && auction.secondBidder) {
              // Create payment for second bidder
              const secondBidderId = auction.secondBidder._id || auction.secondBidder;
              const secondBidderPayment = await createPaymentSession({
                userId: secondBidderId.toString(),
                paymentType: 'auction_winner',
                amount: auction.currentPrice,
                auctionId: auction._id.toString(),
                paymentDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours
                isSecondBidder: true
              });

              // Update auction
              auction.paymentStatus = 'second_bidder_pending';
              auction.winner = secondBidderId;
              await auction.save();

              // Send email to second bidder
              const { sendSecondBidderPaymentEmail } = require('./emailService');
              const secondBidder = await User.findById(secondBidderId);
              if (secondBidder) {
                const listing = await Listing.findById(auction.listing?._id || auction.listing);
                await sendSecondBidderPaymentEmail(
                  secondBidder.email,
                  secondBidder.name,
                  listing ? listing.title : 'Auction Item',
                  auction.currentPrice,
                  secondBidderPayment.paymentLink
                );
              }

              results.secondBidderNotified++;
            }
          }
        } else if (payment.paymentType === 'featured_listing') {
          // Just mark as expired for featured listings
          payment.status = 'expired';
          await payment.save();
        }
      } catch (error) {
        console.error(`Error handling expired payment ${payment._id}:`, error);
        results.errors.push({ paymentId: payment._id, error: error.message });
      }
    }

    return results;
  } catch (error) {
    console.error('Error handling expired payments:', error);
    throw error;
  }
};

module.exports = {
  createPaymentSession,
  verifyPayment,
  handleExpiredPayments
};

