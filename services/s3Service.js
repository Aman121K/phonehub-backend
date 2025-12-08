const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'eu-north-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'phonehub-storage-ar';
const REGION = process.env.AWS_REGION || 'eu-north-1';

/**
 * Upload file to S3
 * @param {Buffer} fileBuffer - File buffer
 * @param {String} fileName - File name
 * @param {String} mimetype - File MIME type
 * @returns {Promise<String>} - S3 URL of uploaded file
 */
const uploadToS3 = async (fileBuffer, fileName, mimetype) => {
  try {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(fileName);
    const name = path.basename(fileName, ext);
    const uniqueFileName = `images/${name}-${uniqueSuffix}${ext}`;

    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: uniqueFileName,
      Body: fileBuffer,
      ContentType: mimetype,
      // Note: ACL might be disabled on your bucket. Use bucket policy for public access instead.
      // ACL: 'public-read', // Uncomment if ACL is enabled on your bucket
    });

    await s3Client.send(command);

    // Return public URL
    const publicUrl = `https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/${uniqueFileName}`;
    return publicUrl;
  } catch (error) {
    console.error('Error uploading to S3:', error);
    throw new Error(`Failed to upload file to S3: ${error.message}`);
  }
};

/**
 * Delete file from S3
 * @param {String} fileUrl - S3 URL of file to delete
 * @returns {Promise<void>}
 */
const deleteFromS3 = async (fileUrl) => {
  try {
    // Extract key from URL
    // URL format: https://bucket-name.s3.region.amazonaws.com/key
    const urlParts = fileUrl.split('.amazonaws.com/');
    if (urlParts.length < 2) {
      throw new Error('Invalid S3 URL');
    }
    const key = urlParts[1];

    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);
  } catch (error) {
    console.error('Error deleting from S3:', error);
    throw new Error(`Failed to delete file from S3: ${error.message}`);
  }
};

module.exports = {
  uploadToS3,
  deleteFromS3,
  BUCKET_NAME,
  REGION,
};

