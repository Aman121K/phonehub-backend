const express = require('express');
const router = express.Router();
const { authorizeAdmin, authenticateToken } = require('../middleware/auth');
const Listing = require('../models/Listing');
const Category = require('../models/Category');
const User = require('../models/User');

// All admin routes require authentication + admin role
router.use(authenticateToken, authorizeAdmin);

// Get all listings with filters
router.get('/listings', async (req, res) => {
  try {
    const { sellType, listingType, status, category, city, limit = 50, offset = 0 } = req.query;
    const query = {};

    if (sellType) query.sellType = sellType;
    if (listingType) query.listingType = listingType;
    if (status) query.status = status;
    if (city) query.city = city;
    if (category) {
      const cat = await Category.findOne({ slug: category });
      if (cat) query.category = cat._id;
    }

    const listings = await Listing.find(query)
      .populate('user', 'name email city')
      .populate('category', 'name slug')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    res.json(listings);
  } catch (error) {
    console.error('Admin get listings error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create listing as admin (can be single or bulk, fixed_price or auction)
router.post('/listings', async (req, res) => {
  try {
    const {
      category_id,
      title,
      description,
      price,
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
      quantity,
      isFeatured,
      status
    } = req.body;

    const listing = new Listing({
      user: req.user.userId,
      category: category_id,
      title,
      description,
      price,
      storage,
      condition,
      city,
      listingType: listing_type || 'fixed_price',
      imageUrl: image_url || null,
      images: images || (image_url ? [image_url] : []),
      sellType: sellType || 'single',
      color: color || null,
      warranty: warranty === true || warranty === 'Yes' || warranty === 'yes',
      quantity: quantity || 1,
      isFeatured: isFeatured === true,
      status: status || 'active'
    });

    await listing.save();

    // If auction, create auction entry
    if (listing_type === 'auction') {
      const Auction = require('../models/Auction');
      const auction = new Auction({
        listing: listing._id,
        startPrice: start_price,
        currentPrice: start_price,
        endDate: end_date,
        status: 'live'
      });
      await auction.save();
    }

    res.status(201).json({ message: 'Listing created by admin', id: listing._id });
  } catch (error) {
    console.error('Admin create listing error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update listing status/feature flags (including block/unblock)
router.patch('/listings/:id', async (req, res) => {
  try {
    const { status, isFeatured } = req.body;
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    if (status) listing.status = status;
    if (typeof isFeatured === 'boolean') listing.isFeatured = isFeatured;
    await listing.save();
    res.json({ message: 'Listing updated', listing });
  } catch (error) {
    console.error('Admin update listing error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get users list
router.get('/users', async (_req, res) => {
  try {
    const users = await User.find().select('name email city userType sellerType businessName role status verifiedBatch verifiedBatchPurchasedAt createdAt');
    res.json(users);
  } catch (error) {
    console.error('Admin get users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Block/Unblock user
router.patch('/users/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'blocked'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    user.status = status;
    await user.save();
    res.json({ message: `User ${status === 'blocked' ? 'blocked' : 'unblocked'}`, user });
  } catch (error) {
    console.error('Admin update user status error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create category
router.post('/categories', async (req, res) => {
  try {
    const { name, slug } = req.body;
    if (!name || !slug) {
      return res.status(400).json({ error: 'Name and slug are required' });
    }
    const exists = await Category.findOne({ slug });
    if (exists) {
      return res.status(400).json({ error: 'Category already exists' });
    }
    const category = new Category({ name, slug });
    await category.save();
    res.status(201).json({ message: 'Category created', category });
  } catch (error) {
    console.error('Admin create category error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update category
router.patch('/categories/:id', async (req, res) => {
  try {
    const { name, slug } = req.body;
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    if (name) category.name = name;
    if (slug) {
      const exists = await Category.findOne({ slug, _id: { $ne: req.params.id } });
      if (exists) {
        return res.status(400).json({ error: 'Slug already exists' });
      }
      category.slug = slug;
    }
    await category.save();
    res.json({ message: 'Category updated', category });
  } catch (error) {
    console.error('Admin update category error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get reports
router.get('/reports', async (req, res) => {
  try {
    const { status } = req.query;
    const query = {};
    if (status) query.status = status;
    const Report = require('../models/Report');
    const reports = await Report.find(query)
      .populate('listing', 'title user')
      .populate('reporter', 'name email')
      .populate('reviewedBy', 'name')
      .sort({ createdAt: -1 });
    res.json(reports);
  } catch (error) {
    console.error('Admin get reports error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update report status
router.patch('/reports/:id', async (req, res) => {
  try {
    const { status, adminNotes } = req.body;
    const Report = require('../models/Report');
    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    if (status) {
      report.status = status;
      report.reviewedBy = req.user.userId;
      report.reviewedAt = new Date();
    }
    if (adminNotes) report.adminNotes = adminNotes;
    await report.save();
    res.json({ message: 'Report updated', report });
  } catch (error) {
    console.error('Admin update report error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Blog routes
const Blog = require('../models/Blog');

// Get all blogs
router.get('/blogs', async (req, res) => {
  try {
    const blogs = await Blog.find()
      .populate('author', 'name email')
      .sort({ createdAt: -1 });
    res.json(blogs);
  } catch (error) {
    console.error('Admin get blogs error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single blog
router.get('/blogs/:id', async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id)
      .populate('author', 'name email');
    if (!blog) {
      return res.status(404).json({ error: 'Blog not found' });
    }
    res.json(blog);
  } catch (error) {
    console.error('Admin get blog error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create blog
router.post('/blogs', async (req, res) => {
  try {
    const { title, slug, content, excerpt, description, featuredImage, status, tags } = req.body;
    
    // Validation
    if (!title || !slug || !content) {
      return res.status(400).json({ error: 'Title, slug, and content are required' });
    }

    // Check if slug already exists
    const exists = await Blog.findOne({ slug });
    if (exists) {
      return res.status(400).json({ error: 'Blog with this slug already exists' });
    }

    // Create blog
    const blog = new Blog({
      title: title.trim(),
      slug: slug.trim(),
      content: content.trim(),
      excerpt: excerpt ? excerpt.trim() : '',
      description: description ? description.trim() : '',
      featuredImage: featuredImage ? featuredImage.trim() : '',
      author: req.user.userId,
      status: status || 'draft',
      tags: Array.isArray(tags) ? tags : (tags || []),
      publishedAt: status === 'published' ? new Date() : null
    });

    await blog.save();
    
    // Populate author for response
    await blog.populate('author', 'name email');
    
    res.status(201).json({ message: 'Blog created successfully', blog });
  } catch (error) {
    console.error('Admin create blog error:', error);
    
    // Handle mongoose validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message).join(', ');
      return res.status(400).json({ error: `Validation error: ${errors}` });
    }
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Blog with this slug already exists' });
    }
    
    res.status(500).json({ error: error.message || 'Server error while creating blog' });
  }
});

// Update blog
router.patch('/blogs/:id', async (req, res) => {
  try {
    const { title, slug, content, excerpt, description, featuredImage, status, tags } = req.body;
    const blog = await Blog.findById(req.params.id);
    if (!blog) {
      return res.status(404).json({ error: 'Blog not found' });
    }
    if (title) blog.title = title;
    if (slug) {
      const exists = await Blog.findOne({ slug, _id: { $ne: req.params.id } });
      if (exists) {
        return res.status(400).json({ error: 'Slug already exists' });
      }
      blog.slug = slug;
    }
    if (content) blog.content = content;
    if (excerpt !== undefined) blog.excerpt = excerpt;
    if (description !== undefined) blog.description = description;
    if (featuredImage !== undefined) blog.featuredImage = featuredImage;
    if (status) {
      blog.status = status;
      if (status === 'published' && !blog.publishedAt) {
        blog.publishedAt = new Date();
      }
    }
    if (tags) blog.tags = tags;
    blog.updatedAt = new Date();
    await blog.save();
    res.json({ message: 'Blog updated', blog });
  } catch (error) {
    console.error('Admin update blog error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete blog
router.delete('/blogs/:id', async (req, res) => {
  try {
    const blog = await Blog.findByIdAndDelete(req.params.id);
    if (!blog) {
      return res.status(404).json({ error: 'Blog not found' });
    }
    res.json({ message: 'Blog deleted' });
  } catch (error) {
    console.error('Admin delete blog error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

