const express = require('express');
const router = express.Router();
const multer = require('multer');
const Listing = require('../models/Listing');
const Category = require('../models/Category');
const Auction = require('../models/Auction');
const { authenticateToken } = require('../middleware/auth');
const { uploadImagesToS3, processS3Upload } = require('../middleware/uploadS3');

// Get all listings
router.get('/', async (req, res) => {
  try {
    const { city, category, type, search, model, storage, limit = 20, offset = 0 } = req.query;
    
    const query = { status: 'active' }; // Only show active listings (excludes blocked, sold, expired)
    
    if (city) {
      query.city = city;
    }

    if (category) {
      const categoryDoc = await Category.findOne({ slug: category });
      if (categoryDoc) {
        query.category = categoryDoc._id;
      }
    }

    if (type) {
      // Handle different type values from frontend
      if (type === 'fixed_price' || type === 'auction') {
        query.listingType = type;
      } else if (type === 'single_sell') {
        query.sellType = 'single';
      } else if (type === 'bulk_sell') {
        query.sellType = 'bulk';
      }
    }

    // Handle search query
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Handle model filter (category name)
    if (model) {
      const categoryDoc = await Category.findOne({ name: { $regex: model, $options: 'i' } });
      if (categoryDoc) {
        query.category = categoryDoc._id;
      }
    }

    // Handle storage filter
    if (storage) {
      query.storage = storage;
    }

    const listings = await Listing.find(query)
      .populate('user', 'name city phone businessName sellerType')
      .populate('category', 'name slug')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    // Format response to match frontend expectations
    const formattedListings = listings.map(listing => ({
      _id: listing._id,
      id: listing._id,
      title: listing.title,
      price: listing.price,
      perPrice: listing.perPrice,
      condition: listing.condition,
      storage: listing.storage,
      city: listing.city,
      listingType: listing.listingType,
      sellType: listing.sellType,
      color: listing.color,
      warranty: listing.warranty,
      quantity: listing.quantity,
      imageUrl: listing.imageUrl,
      images: listing.images && listing.images.length > 0 ? listing.images : (listing.imageUrl ? [listing.imageUrl] : []),
      description: listing.description,
      user: listing.user ? {
        _id: listing.user._id,
        name: listing.user.sellerType === 'business' && listing.user.businessName ? listing.user.businessName : listing.user.name,
        city: listing.user.city,
        phone: listing.user.phone,
        businessName: listing.user.businessName,
        sellerType: listing.user.sellerType
      } : null,
      category: listing.category ? {
        _id: listing.category._id,
        name: listing.category.name,
        slug: listing.category.slug
      } : null,
      createdAt: listing.createdAt
    }));

    res.json(formattedListings);
  } catch (error) {
    console.error('Get listings error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get featured listings
router.get('/featured', async (req, res) => {
  try {
    const listings = await Listing.find({ 
      status: 'active', 
      listingType: 'fixed_price',
      isFeatured: true 
    })
      .populate('user', 'name city businessName sellerType')
      .populate('category', 'name slug')
      .sort({ createdAt: -1 })
      .limit(10);
    
    // Format featured listings
    const formattedListings = listings.map(listing => ({
      _id: listing._id,
      id: listing._id,
      title: listing.title,
      price: listing.price,
      perPrice: listing.perPrice,
      condition: listing.condition,
      storage: listing.storage,
      city: listing.city,
      listingType: listing.listingType,
      sellType: listing.sellType,
      color: listing.color,
      warranty: listing.warranty,
      quantity: listing.quantity,
      imageUrl: listing.imageUrl,
      images: listing.images && listing.images.length > 0 ? listing.images : (listing.imageUrl ? [listing.imageUrl] : []),
      description: listing.description,
      user: listing.user ? {
        _id: listing.user._id,
        name: listing.user.sellerType === 'business' && listing.user.businessName ? listing.user.businessName : listing.user.name,
        city: listing.user.city,
        businessName: listing.user.businessName,
        sellerType: listing.user.sellerType
      } : null,
      category: listing.category ? {
        _id: listing.category._id,
        name: listing.category.name,
        slug: listing.category.slug
      } : null,
      createdAt: listing.createdAt
    }));

    // If no featured listings, get regular active listings as fallback
    if (formattedListings.length === 0) {
      const regularListings = await Listing.find({ 
        status: 'active', 
        listingType: 'fixed_price' 
      })
        .populate('user', 'name city businessName sellerType')
        .populate('category', 'name slug')
        .sort({ createdAt: -1 })
        .limit(10);
      
      const fallbackListings = regularListings.map(listing => ({
        _id: listing._id,
        id: listing._id,
      title: listing.title,
      price: listing.price,
      perPrice: listing.perPrice,
      condition: listing.condition,
      storage: listing.storage,
      city: listing.city,
      listingType: listing.listingType,
        sellType: listing.sellType,
        color: listing.color,
        warranty: listing.warranty,
        quantity: listing.quantity,
        imageUrl: listing.imageUrl,
        images: listing.images && listing.images.length > 0 ? listing.images : (listing.imageUrl ? [listing.imageUrl] : []),
        description: listing.description,
        user: listing.user ? {
          _id: listing.user._id,
          name: listing.user.sellerType === 'business' && listing.user.businessName ? listing.user.businessName : listing.user.name,
          city: listing.user.city,
          businessName: listing.user.businessName,
          sellerType: listing.user.sellerType
        } : null,
        category: listing.category ? {
          _id: listing.category._id,
          name: listing.category.name,
          slug: listing.category.slug
        } : null,
        createdAt: listing.createdAt
      }));
      
      return res.json(fallbackListings);
    }

    res.json(formattedListings);
  } catch (error) {
    console.error('Get featured listings error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get latest listings
router.get('/latest', async (req, res) => {
  try {
    const listings = await Listing.find({ status: 'active' })
      .populate('user', 'name city businessName sellerType')
      .populate('category', 'name slug')
      .sort({ createdAt: -1 })
      .limit(20);

    // Format response to match frontend expectations
    const formattedListings = listings.map(listing => ({
      _id: listing._id,
      id: listing._id,
      title: listing.title,
      price: listing.price,
      perPrice: listing.perPrice,
      condition: listing.condition,
      storage: listing.storage,
      city: listing.city,
      listingType: listing.listingType,
      sellType: listing.sellType,
      color: listing.color,
      warranty: listing.warranty,
      quantity: listing.quantity,
      imageUrl: listing.imageUrl,
      images: listing.images && listing.images.length > 0 ? listing.images : (listing.imageUrl ? [listing.imageUrl] : []),
      description: listing.description,
      user: listing.user ? {
        _id: listing.user._id,
        name: listing.user.sellerType === 'business' && listing.user.businessName ? listing.user.businessName : listing.user.name,
        city: listing.user.city,
        businessName: listing.user.businessName,
        sellerType: listing.user.sellerType
      } : null,
      category: listing.category ? {
        _id: listing.category._id,
        name: listing.category.name,
        slug: listing.category.slug
      } : null,
      createdAt: listing.createdAt
    }));

    res.json(formattedListings);
  } catch (error) {
    console.error('Get latest listings error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single listing
router.get('/:id', async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id)
      .populate('user', 'name city phone businessName sellerType')
      .populate('category', 'name slug');

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    // Format response to match frontend expectations
    const formattedListing = {
      _id: listing._id,
      id: listing._id,
      title: listing.title,
      price: listing.price,
      perPrice: listing.perPrice,
      condition: listing.condition,
      storage: listing.storage,
      city: listing.city,
      listingType: listing.listingType,
      sellType: listing.sellType,
      color: listing.color,
      warranty: listing.warranty,
      quantity: listing.quantity,
      imageUrl: listing.imageUrl,
      images: listing.images && listing.images.length > 0 ? listing.images : (listing.imageUrl ? [listing.imageUrl] : []),
      description: listing.description,
      user: listing.user ? {
        _id: listing.user._id,
        id: listing.user._id,
        name: listing.user.sellerType === 'business' && listing.user.businessName ? listing.user.businessName : listing.user.name,
        city: listing.user.city,
        phone: listing.user.phone,
        businessName: listing.user.businessName,
        sellerType: listing.user.sellerType
      } : null,
      category: listing.category ? {
        _id: listing.category._id,
        name: listing.category.name,
        slug: listing.category.slug
      } : null,
      createdAt: listing.createdAt
    };

    res.json(formattedListing);
  } catch (error) {
    console.error('Get listing error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create listing (only sellers can post, buyers can only bid)
router.post('/', authenticateToken, async (req, res, next) => {
  // Check if user is a buyer - buyers can only bid, not post
  try {
    const User = require('../models/User');
    const user = await User.findById(req.user.userId);
    if (user && user.userType === 'buyer') {
      return res.status(403).json({ error: 'Buyers can only bid on listings. Please register as a seller to post listings.' });
    }
  } catch (error) {
    console.error('Error checking user type:', error);
    return res.status(500).json({ error: 'Error verifying user permissions' });
  }
  
  next();
}, (req, res, next) => {
  uploadImagesToS3(req, res, (err) => {
    if (err) {
      // Handle multer errors
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
    // Handle file uploads - S3 URLs are already in req.imageUrls
    let imageUrls = req.imageUrls || [];

    // Get form data (from FormData or JSON)
    const { 
      category_id, 
      title, 
      description, 
      price, 
      per_price,
      storage, 
      condition, 
      city, 
      listing_type, 
      image_url, 
      images, 
      start_price, 
      end_date,
      sellType,
      color,
      warranty,
      quantity
    } = req.body;

    // Validate images: must have at least 1, max 5
    if (imageUrls.length === 0 && !image_url && (!images || images.length === 0)) {
      return res.status(400).json({ error: 'At least one image is required' });
    }

    if (imageUrls.length > 5) {
      return res.status(400).json({ error: 'Maximum 5 images allowed' });
    }

    // Combine S3 uploaded images with any URL images (for backward compatibility)
    let finalImages = imageUrls;
    if (image_url && !imageUrls.includes(image_url)) {
      finalImages = [image_url, ...imageUrls];
    }
    if (images && Array.isArray(images)) {
      finalImages = [...finalImages, ...images.filter(img => !finalImages.includes(img))];
    }

    const listing = new Listing({
      user: req.user.userId,
      category: category_id,
      title,
      description,
      price: parseFloat(price),
      perPrice: per_price ? parseFloat(per_price) : null,
      storage,
      condition,
      city,
      listingType: listing_type || 'fixed_price',
      imageUrl: finalImages.length > 0 ? finalImages[0] : null,
      images: finalImages,
      sellType: sellType || 'single',
      color: color || null,
      warranty: warranty === true || warranty === 'Yes' || warranty === 'yes' || warranty === 'true',
      quantity: quantity ? parseInt(quantity) : 1
    });

    await listing.save();

    // If auction, create auction entry
    if (listing_type === 'auction') {
      const auction = new Auction({
        listing: listing._id,
        startPrice: parseFloat(start_price),
        currentPrice: parseFloat(start_price),
        endDate: end_date,
        status: 'live'
      });
      await auction.save();
    }

    res.status(201).json({ message: 'Listing created successfully', id: listing._id });
  } catch (error) {
    console.error('Create listing error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// Get user's listings
router.get('/user/my-listings', authenticateToken, async (req, res) => {
  try {
    const listings = await Listing.find({ user: req.user.userId })
      .populate('category', 'name slug')
      .populate('user', 'name city businessName sellerType')
      .sort({ createdAt: -1 });

    // Format response to match frontend expectations
    const formattedListings = listings.map(listing => ({
      _id: listing._id,
      id: listing._id,
      title: listing.title,
      price: listing.price,
      perPrice: listing.perPrice,
      condition: listing.condition,
      storage: listing.storage,
      city: listing.city,
      listingType: listing.listingType,
      sellType: listing.sellType,
      color: listing.color,
      warranty: listing.warranty,
      quantity: listing.quantity,
      imageUrl: listing.imageUrl,
      images: listing.images && listing.images.length > 0 ? listing.images : (listing.imageUrl ? [listing.imageUrl] : []),
      description: listing.description,
      user: listing.user ? {
        _id: listing.user._id,
        name: listing.user.sellerType === 'business' && listing.user.businessName ? listing.user.businessName : listing.user.name,
        city: listing.user.city,
        businessName: listing.user.businessName,
        sellerType: listing.user.sellerType
      } : null,
      category: listing.category ? {
        _id: listing.category._id,
        name: listing.category.name,
        slug: listing.category.slug
      } : null,
      createdAt: listing.createdAt
    }));

    res.json(formattedListings);
  } catch (error) {
    console.error('Get user listings error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
