const express = require('express');
const router = express.Router();
const Auction = require('../models/Auction');
const Bid = require('../models/Bid');
const Listing = require('../models/Listing');
const { authenticateToken } = require('../middleware/auth');

// Get all auctions
router.get('/', async (req, res) => {
  try {
    // Update expired auctions
    await Auction.updateMany(
      { 
        status: 'live',
        endDate: { $lt: new Date() }
      },
      { 
        $set: { status: 'ended' }
      }
    );

    const auctions = await Auction.find({ status: 'live' })
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
          { path: 'user', select: 'name city' }
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
      seller_name: auction.listing.user ? auction.listing.user.name : null,
      start_price: auction.startPrice,
      current_price: auction.currentPrice,
      end_date: auction.endDate,
      status: auction.status,
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
    const { bid_amount } = req.body;
    const auctionId = req.params.id;

    const auction = await Auction.findById(auctionId);
    if (!auction) {
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

    if (parseFloat(bid_amount) <= parseFloat(auction.currentPrice)) {
      return res.status(400).json({ error: 'Bid must be higher than current price' });
    }

    // Create bid
    const bid = new Bid({
      auction: auctionId,
      user: req.user.userId,
      bidAmount: bid_amount
    });
    await bid.save();

    // Update current price
    auction.currentPrice = bid_amount;
    await auction.save();

    res.json({ message: 'Bid placed successfully' });
  } catch (error) {
    console.error('Place bid error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
