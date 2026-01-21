const express = require('express');
const router = express.Router();
const Blog = require('../models/Blog');

// Get all published blogs (public)
router.get('/', async (req, res) => {
  try {
    const blogs = await Blog.find({ status: 'published' })
      .populate('author', 'name')
      .sort({ publishedAt: -1 });
    
    // Format blogs to ensure description is available
    const formattedBlogs = blogs.map(blog => {
      const blogObj = blog.toObject();
      // Use description if available, otherwise use excerpt
      if (!blogObj.description && !blogObj.excerpt) {
        blogObj.description = 'No description available.';
      } else {
        blogObj.description = blogObj.description || blogObj.excerpt;
      }
      return blogObj;
    });
    
    res.json(formattedBlogs);
  } catch (error) {
    console.error('Get blogs error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single blog by slug (public)
router.get('/:slug', async (req, res) => {
  try {
    const blog = await Blog.findOne({ slug: req.params.slug, status: 'published' })
      .populate('author', 'name email');
    
    if (!blog) {
      return res.status(404).json({ error: 'Blog not found' });
    }

    // Increment views
    blog.views += 1;
    await blog.save();

    res.json(blog);
  } catch (error) {
    console.error('Get blog error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

