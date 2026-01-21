const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticateToken } = require('../middleware/auth');
const { createPaymentSession, verifyPayment, handleExpiredPayments } = require('../services/paymentService');
const { uploadImagesToS3, processS3Upload } = require('../middleware/uploadS3');
const Payment = require('../models/Payment');
const Listing = require('../models/Listing');
const Auction = require('../models/Auction');
const User = require('../models/User');
const Bid = require('../models/Bid');
const { sendWinnerPaymentEmail, sendFeaturedListingPaymentEmail, sendVerifiedBatchInvoice, sendFeaturedListingInvoice, sendFeaturedListingPaymentFailureEmail } = require('../services/emailService');

// Ziina webhook endpoint (must be before body parser middleware)
router.post('/webhook', express.json(), async (req, res) => {
  if (!process.env.ZIINA_ACCESS_TOKEN) {
    return res.status(500).json({ error: 'Ziina is not configured' });
  }

  // Optional: Verify HMAC signature if webhook secret is set
  if (process.env.ZIINA_WEBHOOK_SECRET) {
    const crypto = require('crypto');
    const hmacSignature = req.headers['x-hmac-signature'];
    const payload = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', process.env.ZIINA_WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');
    
    if (hmacSignature !== expectedSignature) {
      console.error('Webhook signature verification failed');
      return res.status(400).json({ error: 'Invalid signature' });
  }
  }

  const event = req.body;

  // Handle Ziina webhook event: payment_intent.status.updated
  // This works for both test and production mode
  if (event.type === 'payment_intent.status.updated') {
    const paymentIntent = event.data;
    const paymentIntentId = paymentIntent.id;
    
    console.log(`📥 Webhook received: payment_intent.status.updated for ${paymentIntentId}, status: ${paymentIntent.status}`);
    
    try {
      // Verify payment status from Ziina API (fetches latest status)
      // This ensures we have the most up-to-date status even if webhook is delayed
      const payment = await verifyPayment(paymentIntentId);
      
      if (payment && payment.status === 'completed') {
        // Handle featured listing payment
        if (payment.paymentType === 'featured_listing') {
          let listing = null;
          
          // If listingData exists, create listing first (payment before listing creation)
          if (payment.listingData && !payment.listing) {
            const listingData = payment.listingData;
            
            // Create listing from stored data (images are already uploaded as URLs)
            listing = new Listing({
              user: payment.user,
              category: listingData.category_id,
              title: listingData.title,
              description: listingData.description || '',
              price: parseFloat(listingData.price),
              perPrice: listingData.per_price ? parseFloat(listingData.per_price) : null,
              storage: listingData.storage || null,
              condition: listingData.condition || null,
              city: listingData.city,
              listingType: listingData.listing_type || 'fixed_price',
              imageUrl: listingData.images && listingData.images.length > 0 ? listingData.images[0] : null,
              images: listingData.images || [],
              sellType: listingData.sellType || 'single',
              colour: listingData.colour || null,
              version: listingData.version || null,
              charge: listingData.charge || null,
              box: listingData.box || null,
              warranty: listingData.warranty === true || listingData.warranty === 'Yes' || listingData.warranty === 'yes' || listingData.warranty === 'true',
              quantity: listingData.quantity ? parseInt(listingData.quantity) : 1,
              isFeatured: true // Mark as featured immediately
            });
            
            // Set expiry date based on duration
            if (payment.featuredDuration) {
              const expiryDate = new Date(Date.now() + payment.featuredDuration * 24 * 60 * 60 * 1000);
              listing.featuredExpiryDate = expiryDate;
            }
            
            await listing.save();
            
            // Update payment with listing ID
            payment.listing = listing._id;
            payment.listingData = null; // Clear temporary data
            await payment.save();
            
            // If auction, create auction entry
            if (listingData.listing_type === 'auction') {
              const auction = new Auction({
                listing: listing._id,
                startPrice: parseFloat(listingData.start_price),
                currentPrice: parseFloat(listingData.start_price),
                endDate: listingData.end_date,
                status: 'live'
              });
              await auction.save();
            }
          } else if (payment.listing) {
            // Existing listing - just mark as featured
            listing = await Listing.findById(payment.listing);
            if (listing) {
              listing.isFeatured = true;
              // Set expiry date based on duration
              if (payment.featuredDuration) {
                const expiryDate = new Date(Date.now() + payment.featuredDuration * 24 * 60 * 60 * 1000);
                listing.featuredExpiryDate = expiryDate;
              }
              await listing.save();
            }
          }
            
            // Send invoice email
          if (listing) {
            const user = await User.findById(payment.user);
            if (user) {
              const expiryDate = listing.featuredExpiryDate || new Date();
              await sendFeaturedListingInvoice(
                user.email,
                user.name,
                listing.title,
                payment.amount,
                payment.featuredDuration,
                payment._id.toString(),
                payment.paidAt,
                expiryDate
              ).catch(err => console.error('Failed to send featured listing invoice:', err));
            }
          }
        }
        
        // Handle auction winner payment
        if (payment.paymentType === 'auction_winner' && payment.auction) {
          const auction = await Auction.findById(payment.auction);
          if (auction) {
            auction.paymentStatus = 'completed';
            auction.status = 'paid';
            auction.paymentCompletedAt = new Date();
            await auction.save();
            
            // Mark listing as sold
            const listing = await Listing.findById(auction.listing);
            if (listing) {
              listing.status = 'sold';
              await listing.save();
            }
          }
        }
        
        // Handle verified batch payment
        if (payment.paymentType === 'verified_batch') {
          const user = await User.findById(payment.user);
          if (user) {
            console.log(`✅ Processing verified batch payment for user: ${user.email}`);
            user.verifiedBatch = true;
            user.verifiedBatchPurchasedAt = new Date();
            await user.save();
            console.log(`✅ User ${user.email} verified batch status updated to: ${user.verifiedBatch}`);
            
            // Send invoice email
            await sendVerifiedBatchInvoice(
              user.email,
              user.name,
              payment.amount,
              payment._id.toString(),
              payment.paidAt
            ).catch(err => console.error('Failed to send verified batch invoice:', err));
          } else {
            console.error(`❌ User not found for verified batch payment: ${payment.user}`);
          }
        }
      }
      
      // Handle payment failure/cancellation
      if (paymentIntent.status === 'failed' || paymentIntent.status === 'cancelled') {
        try {
          const payment = await Payment.findOne({ 
            $or: [
              { ziinaPaymentIntentId: paymentIntentId },
              { stripeSessionId: paymentIntentId }
            ]
          });
          
          if (payment && payment.paymentType === 'featured_listing' && payment.listingData) {
            // Payment failed for featured listing that hasn't been created yet
            payment.status = paymentIntent.status === 'cancelled' ? 'expired' : 'failed';
            await payment.save();
            
            // Send failure email
            const user = await User.findById(payment.user);
            if (user && payment.listingData) {
              await sendFeaturedListingPaymentFailureEmail(
                user.email,
                user.name,
                payment.listingData.title || 'Your Listing',
                payment.amount,
                payment.featuredDuration
              ).catch(err => console.error('Failed to send payment failure email:', err));
            }
          }
        } catch (error) {
          console.error('Error handling payment failure:', error);
        }
      }
    } catch (error) {
      console.error('Error processing webhook:', error);
    }
  }

  res.json({ received: true });
});

// Create payment session for featured listing BEFORE creating listing
router.post('/featured-listing-before-create', authenticateToken, (req, res, next) => {
  uploadImagesToS3(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File size too large. Maximum 5MB per image.' });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({ error: 'Too many files. Maximum 5 images allowed.' });
        }
        return res.status(400).json({ error: err.message });
      }
      if (err) {
        return res.status(400).json({ error: err.message });
      }
    }
    next();
  });
}, processS3Upload, async (req, res) => {
  try {
    // Get listing data from body (JSON string or object)
    let listingData;
    if (typeof req.body.listingData === 'string') {
      listingData = JSON.parse(req.body.listingData);
    } else {
      listingData = req.body.listingData;
    }

    const { duration } = req.body;

    if (!listingData || !duration) {
      return res.status(400).json({ error: 'Listing data and duration are required' });
    }

    // Validate images: must have at least 1, max 5
    const imageUrls = req.imageUrls || [];
    if (imageUrls.length === 0) {
      return res.status(400).json({ error: 'At least one image is required' });
    }

    if (imageUrls.length > 5) {
      return res.status(400).json({ error: 'Maximum 5 images allowed' });
    }

    // Add image URLs to listing data
    listingData.images = imageUrls;

    // Validate duration
    const validDurations = [7, 10, 15, 30];
    if (!validDurations.includes(parseInt(duration))) {
      return res.status(400).json({ error: 'Invalid duration. Valid options: 7, 10, 15, or 30 days' });
    }

    // Calculate pricing based on duration
    const pricing = {
      7: 50,   // AED 50 for 7 days
      10: 70,  // AED 70 for 10 days
      15: 100, // AED 100 for 15 days
      30: 180  // AED 180 for 30 days (1 month)
    };
    const amount = pricing[parseInt(duration)];

    // Check if user is seller
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (user.userType !== 'seller') {
      return res.status(403).json({ error: 'Only sellers can create featured listings' });
    }

    // Set payment deadline (7 days from now)
    const paymentDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Create payment session with listing data stored temporarily
    const { payment, paymentLink } = await createPaymentSession({
      userId: req.user.userId,
      paymentType: 'featured_listing',
      amount: amount,
      listingId: null, // No listing yet
      paymentDeadline,
      featuredDuration: parseInt(duration),
      listingData: listingData // Store listing data temporarily
    });

    // Update payment with listing data (already set in createPaymentSession, but ensure it's saved)
    payment.listingData = listingData;
    await payment.save();

    res.json({
      success: true,
      paymentId: payment._id,
      paymentLink,
      message: 'Payment session created successfully. Complete payment to create your featured listing.'
    });
  } catch (error) {
    console.error('Error creating featured listing payment:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// Create payment session for featured listing
router.post('/featured-listing', authenticateToken, async (req, res) => {
  try {
    const { listingId, duration } = req.body;

    if (!listingId || !duration) {
      return res.status(400).json({ error: 'Listing ID and duration are required' });
    }

    // Validate duration
    const validDurations = [7, 10, 15, 30];
    if (!validDurations.includes(parseInt(duration))) {
      return res.status(400).json({ error: 'Invalid duration. Valid options: 7, 10, 15, or 30 days' });
    }

    // Calculate pricing based on duration
    const pricing = {
      7: 50,   // AED 50 for 7 days
      10: 70,  // AED 70 for 10 days
      15: 100, // AED 100 for 15 days
      30: 180  // AED 180 for 30 days (1 month)
    };
    const amount = pricing[parseInt(duration)];

    // Verify listing belongs to user
    const listing = await Listing.findById(listingId);
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (listing.user.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'You can only feature your own listings' });
    }

    // Check if user is seller
    const user = await User.findById(req.user.userId);
    if (user.userType !== 'seller') {
      return res.status(403).json({ error: 'Only sellers can feature listings' });
    }

    // Set payment deadline (7 days from now)
    const paymentDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const { payment, paymentLink } = await createPaymentSession({
      userId: req.user.userId,
      paymentType: 'featured_listing',
      amount: amount,
      listingId: listingId,
      paymentDeadline,
      featuredDuration: parseInt(duration)
    });

    // Send email notification
    await sendFeaturedListingPaymentEmail(
      user.email,
      user.name,
      listing.title,
      paymentLink
    ).catch(err => console.error('Failed to send featured listing email:', err));

    res.json({
      success: true,
      paymentId: payment._id,
      paymentLink,
      message: 'Payment session created successfully'
    });
  } catch (error) {
    console.error('Error creating featured listing payment:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create payment session for verified batch purchase
router.post('/verified-batch', authenticateToken, async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount) {
      return res.status(400).json({ error: 'Amount is required' });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user already has verified batch
    if (user.verifiedBatch) {
      return res.status(400).json({ error: 'You already have a verified batch' });
    }

    // Set payment deadline (e.g., 7 days from now)
    const paymentDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const { payment, paymentLink } = await createPaymentSession({
      userId: req.user.userId,
      paymentType: 'verified_batch',
      amount: parseFloat(amount),
      paymentDeadline
    });

    res.json({
      success: true,
      paymentId: payment._id,
      paymentLink,
      message: 'Payment session created successfully'
    });
  } catch (error) {
    console.error('Error creating verified batch payment:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// Create payment session for auction winner
router.post('/auction-winner', authenticateToken, async (req, res) => {
  try {
    const { auctionId } = req.body;

    if (!auctionId) {
      return res.status(400).json({ error: 'Auction ID is required' });
    }

    const auction = await Auction.findById(auctionId)
      .populate('listing')
      .populate('winner');

    if (!auction) {
      return res.status(404).json({ error: 'Auction not found' });
    }

    // Verify user is the winner
    if (auction.winner.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'You are not the winner of this auction' });
    }

    // Check if payment already exists
    const existingPayment = await Payment.findOne({
      auction: auctionId,
      user: req.user.userId,
      status: { $in: ['pending', 'processing', 'completed'] }
    });

    if (existingPayment && existingPayment.status === 'completed') {
      return res.status(400).json({ error: 'Payment already completed' });
    }

    if (existingPayment && existingPayment.status === 'pending') {
      return res.json({
        success: true,
        paymentId: existingPayment._id,
        paymentLink: existingPayment.paymentLink,
        message: 'Payment session already exists'
      });
    }

    // Set payment deadline (48 hours from now)
    const paymentDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const { payment, paymentLink } = await createPaymentSession({
      userId: req.user.userId,
      paymentType: 'auction_winner',
      amount: auction.currentPrice,
      auctionId: auctionId,
      paymentDeadline,
      isSecondBidder: auction.paymentStatus === 'second_bidder_pending'
    });

    res.json({
      success: true,
      paymentId: payment._id,
      paymentLink,
      message: 'Payment session created successfully'
    });
  } catch (error) {
    console.error('Error creating auction winner payment:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Test endpoint to verify routes are working
router.get('/test', (req, res) => {
  res.json({ message: 'Payments route is working', timestamp: new Date() });
});

// Get payment status (must be after specific routes)
router.get('/:paymentId', authenticateToken, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.paymentId)
      .populate('listing')
      .populate('auction')
      .populate('user');

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Verify user owns this payment
    if (payment.user._id.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json(payment);
  } catch (error) {
    console.error('Error fetching payment:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Verify payment manually (for frontend callback)
// Also supports verifying by payment intent ID directly
router.post('/verify/:paymentId', authenticateToken, async (req, res) => {
  try {
    const { paymentIntentId } = req.body; // Optional: payment intent ID from URL params
    
    let payment = await Payment.findById(req.params.paymentId);

    // If payment not found by ID, try to find by payment intent ID
    if (!payment && paymentIntentId) {
      payment = await Payment.findOne({
        $or: [
          { ziinaPaymentIntentId: paymentIntentId },
          { stripeSessionId: paymentIntentId }
        ]
      });
    }

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (payment.user.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Use Ziina payment intent ID or fallback to stripeSessionId for backward compatibility
    const intentId = paymentIntentId || payment.ziinaPaymentIntentId || payment.stripeSessionId;
    if (intentId) {
      // Fetch latest status from Ziina API (works in both test and production)
      const verifiedPayment = await verifyPayment(intentId);
      
      if (verifiedPayment && verifiedPayment.status === 'completed') {
        // Handle featured listing
        if (verifiedPayment.paymentType === 'featured_listing') {
          let listing = null;
          
          // If listingData exists, create listing first (payment before listing creation)
          if (verifiedPayment.listingData && !verifiedPayment.listing) {
            const listingData = verifiedPayment.listingData;
            
            // Create listing from stored data
            listing = new Listing({
              user: verifiedPayment.user,
              category: listingData.category_id,
              title: listingData.title,
              description: listingData.description || '',
              price: parseFloat(listingData.price),
              perPrice: listingData.per_price ? parseFloat(listingData.per_price) : null,
              storage: listingData.storage || null,
              condition: listingData.condition || null,
              city: listingData.city,
              listingType: listingData.listing_type || 'fixed_price',
              imageUrl: listingData.images && listingData.images.length > 0 ? listingData.images[0] : null,
              images: listingData.images || [],
              sellType: listingData.sellType || 'single',
              colour: listingData.colour || null,
              version: listingData.version || null,
              charge: listingData.charge || null,
              box: listingData.box || null,
              warranty: listingData.warranty === true || listingData.warranty === 'Yes' || listingData.warranty === 'yes' || listingData.warranty === 'true',
              quantity: listingData.quantity ? parseInt(listingData.quantity) : 1,
              isFeatured: true // Mark as featured immediately
            });
            
            // Set expiry date based on duration
            if (verifiedPayment.featuredDuration) {
              const expiryDate = new Date(Date.now() + verifiedPayment.featuredDuration * 24 * 60 * 60 * 1000);
              listing.featuredExpiryDate = expiryDate;
            }
            
            await listing.save();
            
            // Update payment with listing ID
            verifiedPayment.listing = listing._id;
            verifiedPayment.listingData = null; // Clear temporary data
            await verifiedPayment.save();
            
            // If auction, create auction entry
            if (listingData.listing_type === 'auction') {
              const auction = new Auction({
                listing: listing._id,
                startPrice: parseFloat(listingData.start_price),
                currentPrice: parseFloat(listingData.start_price),
                endDate: listingData.end_date,
                status: 'live'
              });
              await auction.save();
            }
          } else if (verifiedPayment.listing) {
            // Existing listing - just mark as featured
            listing = await Listing.findById(verifiedPayment.listing);
            if (listing) {
              listing.isFeatured = true;
              // Set expiry date based on duration
              if (verifiedPayment.featuredDuration) {
                const expiryDate = new Date(Date.now() + verifiedPayment.featuredDuration * 24 * 60 * 60 * 1000);
                listing.featuredExpiryDate = expiryDate;
              }
              await listing.save();
            }
          }
            
            // Send invoice email
          if (listing) {
            const user = await User.findById(verifiedPayment.user);
            if (user) {
              const expiryDate = listing.featuredExpiryDate || new Date();
              await sendFeaturedListingInvoice(
                user.email,
                user.name,
                listing.title,
                verifiedPayment.amount,
                verifiedPayment.featuredDuration,
                verifiedPayment._id.toString(),
                verifiedPayment.paidAt,
                expiryDate
              ).catch(err => console.error('Failed to send featured listing invoice:', err));
            }
          }
        }
        
        // Handle auction winner payment
        if (verifiedPayment.paymentType === 'auction_winner' && verifiedPayment.auction) {
          const auction = await Auction.findById(verifiedPayment.auction);
          if (auction) {
            auction.paymentStatus = 'completed';
            auction.status = 'paid';
            auction.paymentCompletedAt = new Date();
            await auction.save();
            
            const listing = await Listing.findById(auction.listing);
            if (listing) {
              listing.status = 'sold';
              await listing.save();
            }
          }
        }
        
        // Handle verified batch payment
        if (verifiedPayment.paymentType === 'verified_batch') {
          const user = await User.findById(verifiedPayment.user);
          if (user) {
            console.log(`✅ Processing verified batch payment for user: ${user.email}`);
            user.verifiedBatch = true;
            user.verifiedBatchPurchasedAt = new Date();
            await user.save();
            console.log(`✅ User ${user.email} verified batch status updated to: ${user.verifiedBatch}`);
            
            // Send invoice email
            await sendVerifiedBatchInvoice(
              user.email,
              user.name,
              verifiedPayment.amount,
              verifiedPayment._id.toString(),
              verifiedPayment.paidAt
            ).catch(err => console.error('Failed to send verified batch invoice:', err));
          } else {
            console.error(`❌ User not found for verified batch payment: ${verifiedPayment.user}`);
          }
        }
      }

      return res.json(verifiedPayment);
    }

    res.json(payment);
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Endpoint to check and handle expired payments (can be called by cron job)
router.post('/check-expired', async (req, res) => {
  try {
    // This endpoint should be protected in production (e.g., with API key)
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.CRON_API_KEY && process.env.NODE_ENV === 'production') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const results = await handleExpiredPayments();
    res.json({
      success: true,
      message: 'Expired payments processed',
      results
    });
  } catch (error) {
    console.error('Error checking expired payments:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;


