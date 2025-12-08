const multer = require('multer');
const path = require('path');
const { uploadToS3 } = require('../services/s3Service');

// Configure multer to use memory storage (we'll upload directly to S3)
const storage = multer.memoryStorage();

// File filter - only images
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  },
  fileFilter: fileFilter
});

// Middleware for multiple images (1-5 images)
const uploadImagesToS3 = upload.array('images', 5);

// Middleware to upload files to S3 after multer processes them
const processS3Upload = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return next();
    }

    // Upload each file to S3
    const uploadPromises = req.files.map(async (file) => {
      const s3Url = await uploadToS3(file.buffer, file.originalname, file.mimetype);
      return {
        originalName: file.originalname,
        url: s3Url,
        size: file.size,
        mimetype: file.mimetype
      };
    });

    const uploadedFiles = await Promise.all(uploadPromises);
    
    // Attach S3 URLs to request object
    req.uploadedFiles = uploadedFiles;
    req.imageUrls = uploadedFiles.map(file => file.url);

    next();
  } catch (error) {
    console.error('S3 upload error:', error);
    return res.status(500).json({ 
      error: 'Failed to upload images to S3', 
      details: error.message 
    });
  }
};

module.exports = {
  uploadImagesToS3,
  processS3Upload
};

