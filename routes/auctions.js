const express = require('express');
const router = express.Router();
const Auction = require('../models/Auction');
const Bid = require('../models/Bid');
const Listing = require('../models/Listing');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

// Get all auctions
router.get('/', async (req, res) => {
  try {
    const now = new Date();
    
    // Update expired auctions and determine winners
    const expiredAuctions = await Auction.find({
      status: 'live',
      endDate: { $lt: now }
    });

    for (const auction of expiredAuctions) {
      auction.status = 'ended';
      await auction.save();

      // If no winner determined yet, determine it
      if (!auction.winner) {
        const bids = await Bid.find({ auction: auction._id })
          .populate('user')
          .sort({ bidAmount: -1, createdAt: 1 });

        if (bids.length > 0) {
          const winnerBid = bids[0];
          const secondBidder = bids.length > 1 ? bids[1].user : null;

          auction.winner = winnerBid.user._id;
          auction.secondBidder = secondBidder ? secondBidder._id : null;
          auction.paymentStatus = 'pending';
          auction.paymentDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000);
          await auction.save();

          // Create payment session for winner
          try {
            const { createPaymentSession } = require('../services/paymentService');
            const { payment, paymentLink } = await createPaymentSession({
              userId: winnerBid.user._id.toString(),
              paymentType: 'auction_winner',
              amount: auction.currentPrice,
              auctionId: auction._id.toString(),
              paymentDeadline: auction.paymentDeadline,
              isSecondBidder: false
            });

            // Send email to winner
            const { sendWinnerPaymentEmail } = require('../services/emailService');
            const listing = await Listing.findById(auction.listing);
            await sendWinnerPaymentEmail(
              winnerBid.user.email,
              winnerBid.user.name,
              listing ? listing.title : 'Auction Item',
              auction.currentPrice,
              paymentLink,
              auction.paymentDeadline
            ).catch(err => console.error('Failed to send winner email:', err));
          } catch (error) {
            console.error(`Error creating payment for auction ${auction._id}:`, error);
          }
        }
      }
    }

    // Build filter query
    const filter = { status: 'live' };
    
    // Add price filtering if provided
    if (req.query.minPrice || req.query.maxPrice) {
      filter.currentPrice = {};
      if (req.query.minPrice) {
        filter.currentPrice.$gte = parseFloat(req.query.minPrice);
      }
      if (req.query.maxPrice) {
        filter.currentPrice.$lte = parseFloat(req.query.maxPrice);
      }
    }

    const auctions = await Auction.find(filter)
      .populate({
        path: 'listing',
        match: { status: 'active' },
        populate: [
          { path: 'category', select: 'name slug' },
          { path: 'user', select: 'name city' }
        ]
      })
      .sort({ endDate: 1 });

    const auctionsWithBids = await Promise.all(
      auctions.map(async (auction) => {
        if (!auction.listing) return null;
        
        const bidCount = await Bid.countDocuments({ auction: auction._id });
        
        return {
          id: auction._id,
          _id: auction._id,
          listing_id: auction.listing._id,
          title: auction.listing.title,
          description: auction.listing.description,
          image_url: auction.listing.imageUrl || (auction.listing.images && auction.listing.images.length > 0 ? auction.listing.images[0] : null),
          images: auction.listing.images && auction.listing.images.length > 0 ? auction.listing.images : (auction.listing.imageUrl ? [auction.listing.imageUrl] : []),
          city: auction.listing.city,
          category_name: auction.listing.category ? auction.listing.category.name : null,
          seller_name: auction.listing.user ? auction.listing.user.name : null,
          start_price: auction.startPrice,
          current_price: auction.currentPrice,
          end_date: auction.endDate,
          status: auction.status,
          bid_count: bidCount
        };
      })
    );

    res.json(auctionsWithBids.filter(a => a !== null));
  } catch (error) {
    console.error('Get auctions error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get auctions where user has placed bids (must be before /:id route)
router.get('/my-bids', authenticateToken, async (req, res) => {
  try {
    // Find all bids by this user
    const userBids = await Bid.find({ user: req.user.userId })
      .populate({
        path: 'auction',
        populate: {
          path: 'listing',
          populate: [
            { path: 'category', select: 'name slug' },
            { path: 'user', select: 'name city businessName sellerType' }
          ]
        }
      })
      .sort({ createdAt: -1 });

    // Get unique auctions and format them
    const auctionMap = new Map();
    
    userBids.forEach(bid => {
      if (bid.auction && bid.auction.listing) {
        const auctionId = bid.auction._id.toString();
        if (!auctionMap.has(auctionId)) {
          const auction = bid.auction;
          const listing = auction.listing;
          
          auctionMap.set(auctionId, {
            id: auction._id,
            _id: auction._id,
            listing_id: listing._id,
            title: listing.title,
            description: listing.description,
            image_url: listing.imageUrl || (listing.images && listing.images.length > 0 ? listing.images[0] : null),
            images: listing.images && listing.images.length > 0 ? listing.images : (listing.imageUrl ? [listing.imageUrl] : []),
            city: listing.city,
            category_name: listing.category ? listing.category.name : null,
            seller_name: listing.user && listing.user.sellerType === 'business' && listing.user.businessName 
              ? listing.user.businessName 
              : (listing.user ? listing.user.name : null),
            start_price: auction.startPrice,
            current_price: auction.currentPrice,
            end_date: auction.endDate,
            status: auction.status,
            my_highest_bid: bid.bidAmount,
            my_bid_date: bid.createdAt
          });
        } else {
          // Update with highest bid if this bid is higher
          const existing = auctionMap.get(auctionId);
          if (bid.bidAmount > existing.my_highest_bid) {
            existing.my_highest_bid = bid.bidAmount;
            existing.my_bid_date = bid.createdAt;
          }
        }
      }
    });

    const auctions = Array.from(auctionMap.values());
    res.json(auctions);
  } catch (error) {
    console.error('Get my bids error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single auction
router.get('/:id', async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id)
      .populate({
        path: 'listing',
        populate: [
          { path: 'category', select: 'name slug' },
          { path: 'user', select: 'name city phone businessName sellerType' }
        ]
      });

    if (!auction || !auction.listing) {
      return res.status(404).json({ error: 'Auction not found' });
    }

    // Update status if expired
    if (auction.status === 'live' && new Date(auction.endDate) < new Date()) {
      auction.status = 'ended';
      await auction.save();
    }

    const bids = await Bid.find({ auction: auction._id })
      .populate('user', 'name')
      .sort({ bidAmount: -1, createdAt: -1 });

    res.json({
      id: auction._id,
      _id: auction._id,
      listing_id: auction.listing._id,
      title: auction.listing.title,
      description: auction.listing.description,
      image_url: auction.listing.imageUrl || (auction.listing.images && auction.listing.images.length > 0 ? auction.listing.images[0] : null),
      images: auction.listing.images && auction.listing.images.length > 0 ? auction.listing.images : (auction.listing.imageUrl ? [auction.listing.imageUrl] : []),
      city: auction.listing.city,
      category_name: auction.listing.category ? auction.listing.category.name : null,
      category_slug: auction.listing.category ? auction.listing.category.slug : null,
      seller_name: auction.listing.user ? auction.listing.user.name : null,
      seller_city: auction.listing.user ? auction.listing.user.city : null,
      seller_phone: auction.listing.user ? auction.listing.user.phone : null,
      seller_business_name: auction.listing.user && auction.listing.user.sellerType === 'business' ? auction.listing.user.businessName : null,
      seller_type: auction.listing.user ? auction.listing.user.sellerType : null,
      start_price: auction.startPrice,
      current_price: auction.currentPrice,
      end_date: auction.endDate,
      status: auction.status,
      // Full phone details
      version: auction.listing.version || null,
      colour: auction.listing.colour || null,
      charge: auction.listing.charge || null,
      box: auction.listing.box || null,
      warranty: auction.listing.warranty || false,
      storage: auction.listing.storage || null,
      condition: auction.listing.condition || null,
      quantity: auction.listing.quantity || 1,
      price: auction.listing.price || null,
      perPrice: auction.listing.perPrice || null,
      sellType: auction.listing.sellType || 'single',
      listingType: auction.listing.listingType || 'auction',
      createdAt: auction.listing.createdAt || null,
      updatedAt: auction.listing.updatedAt || null,
      bids: bids.map(bid => ({
        id: bid._id,
        bidder_name: bid.user ? bid.user.name : 'Unknown',
        bid_amount: bid.bidAmount,
        created_at: bid.createdAt
      }))
    });
  } catch (error) {
    console.error('Get auction error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Place bid
router.post('/:id/bid', authenticateToken, async (req, res) => {
  try {
    // Check if user is a buyer
    const biddingUser = await User.findById(req.user.userId).select('userType name email');
    if (!biddingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (biddingUser.userType !== 'buyer') {
      return res.status(403).json({ error: 'You are not a buyer. Please make a buyer account to place bids.' });
    }

    // Accept both 'bid_amount' and 'amount' for backward compatibility
    const { bid_amount, amount } = req.body;
    const bidAmount = bid_amount || amount;
    
    if (!bidAmount) {
      return res.status(400).json({ error: 'Bid amount is required' });
    }

    const auctionId = req.params.id;

    const auction = await Auction.findById(auctionId)
      .populate({
        path: 'listing',
        populate: {
          path: 'user',
          select: 'name email'
        }
      });

    if (!auction || !auction.listing) {
      return res.status(404).json({ error: 'Auction not found' });
    }

    // Check if auction has ended
    if (new Date(auction.endDate) < new Date()) {
      auction.status = 'ended';
      await auction.save();
      return res.status(400).json({ error: 'Auction has ended' });
    }

    if (auction.status !== 'live') {
      return res.status(400).json({ error: 'Auction is not live' });
    }

    // Check if user is trying to bid on their own auction
    if (auction.listing.user._id.toString() === req.user.userId) {
      return res.status(400).json({ error: 'You cannot bid on your own auction' });
    }

    const bidAmountValue = parseFloat(bidAmount);
    if (isNaN(bidAmountValue) || bidAmountValue <= 0) {
      return res.status(400).json({ error: 'Invalid bid amount' });
    }

    if (bidAmountValue <= parseFloat(auction.currentPrice)) {
      return res.status(400).json({ error: 'Bid must be higher than current price' });
    }

    // Create bid
    const bid = new Bid({
      auction: auctionId,
      user: req.user.userId,
      bidAmount: bidAmountValue
    });
    await bid.save();

    // Update current price
    auction.currentPrice = bidAmountValue;
    await auction.save();

    // Send email notification to seller (async, don't wait for it)
    const { sendBidNotificationEmail } = require('../services/emailService');
    sendBidNotificationEmail(
      auction.listing.user.email,
      auction.listing.user.name,
      biddingUser.name,
      auction.listing.title,
      bidAmountValue,
      auctionId
    ).catch(err => {
      console.error('Failed to send bid notification email:', err);
      // Don't fail the request if email fails
    });

    res.json({ 
      message: 'Bid placed successfully',
      current_price: auction.currentPrice
    });
  } catch (error) {
    console.error('Place bid error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Determine auction winners (called when auction ends)
router.post('/determine-winners', async (req, res) => {
  try {
    // This endpoint should be protected in production (e.g., with API key or admin auth)
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.CRON_API_KEY && process.env.NODE_ENV === 'production' && req.user?.role !== 'admin') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const now = new Date();
    
    // Find ended auctions without winners
    const endedAuctions = await Auction.find({
      status: 'ended',
      endDate: { $lte: now },
      winner: null
    }).populate('listing');

    const results = {
      processed: 0,
      winnersDetermined: 0,
      noBids: 0,
      errors: []
    };

    for (const auction of endedAuctions) {
      try {
        // Get all bids for this auction, sorted by amount (descending) and time (ascending)
        const bids = await Bid.find({ auction: auction._id })
          .populate('user')
          .sort({ bidAmount: -1, createdAt: 1 });

        if (bids.length === 0) {
          results.noBids++;
          continue;
        }

        // Winner is the highest bidder
        const winnerBid = bids[0];
        const winner = winnerBid.user;

        // Second highest bidder (if exists)
        const secondBidder = bids.length > 1 ? bids[1].user : null;

        // Update auction
        auction.winner = winner._id;
        auction.secondBidder = secondBidder ? secondBidder._id : null;
        auction.paymentStatus = 'pending';
        auction.paymentDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours
        await auction.save();

        // Create payment session for winner
        const { createPaymentSession } = require('../services/paymentService');
        const { payment, paymentLink } = await createPaymentSession({
          userId: winner._id.toString(),
          paymentType: 'auction_winner',
          amount: auction.currentPrice,
          auctionId: auction._id.toString(),
          paymentDeadline: auction.paymentDeadline,
          isSecondBidder: false
        });

        // Send email to winner
        const { sendWinnerPaymentEmail } = require('../services/emailService');
        await sendWinnerPaymentEmail(
          winner.email,
          winner.name,
          auction.listing.title,
          auction.currentPrice,
          paymentLink,
          auction.paymentDeadline
        ).catch(err => console.error('Failed to send winner email:', err));

        results.winnersDetermined++;
        results.processed++;
      } catch (error) {
        console.error(`Error processing auction ${auction._id}:`, error);
        results.errors.push({ auctionId: auction._id, error: error.message });
      }
    }

    res.json({
      success: true,
      message: 'Winners determined',
      results
    });
  } catch (error) {
    console.error('Error determining winners:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
