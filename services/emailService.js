const nodemailer = require('nodemailer');

// Create reusable transporter object using SMTP transport
const createTransporter = () => {
  // Use environment variables for email configuration
  // For development, you can use Gmail or other SMTP services
  // For production, use a proper email service like SendGrid, AWS SES, etc.

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: 'javascript.pgl@gmail.com',
      pass: 'msdf qhmj fhbv xlbm'
    },
  });

  return transporter;
};

// Send bid notification email to seller
const sendBidNotificationEmail = async (sellerEmail, sellerName, buyerName, itemTitle, bidAmount, auctionId) => {
  try {
    // If email is not configured, just log and return
    if (!process.env.SMTP_USER && !process.env.EMAIL_USER) {
      console.log('Email not configured. Would send bid notification to:', sellerEmail);
      console.log(`Buyer: ${buyerName} bid AED ${bidAmount} on "${itemTitle}"`);
      return { success: true, skipped: true };
    }

    const transporter = createTransporter();

    const mailOptions = {
      from: `"PhoneHub" <${process.env.SMTP_USER || process.env.EMAIL_USER}>`,
      to: sellerEmail,
      subject: `New Bid on Your Auction: ${itemTitle}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #2563eb 0%, #f97316 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .bid-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb; }
            .bid-amount { font-size: 24px; font-weight: bold; color: #f97316; margin: 10px 0; }
            .button { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
            .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎯 New Bid Received!</h1>
            </div>
            <div class="content">
              <p>Hello ${sellerName},</p>
              <p>Great news! You have received a new bid on your auction item.</p>
              
              <div class="bid-info">
                <p><strong>Item:</strong> ${itemTitle}</p>
                <p><strong>Buyer:</strong> ${buyerName}</p>
                <div class="bid-amount">Bid Amount: AED ${bidAmount.toLocaleString()}</div>
              </div>
              
              <p>Your auction is getting attention! The current highest bid is now <strong>AED ${bidAmount.toLocaleString()}</strong>.</p>
              
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/auction/${auctionId}" class="button">View Auction</a>
              
              <p style="margin-top: 30px;">Thank you for using PhoneHub!</p>
            </div>
            <div class="footer">
              <p>This is an automated notification from PhoneHub. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        New Bid on Your Auction
        
        Hello ${sellerName},
        
        Great news! You have received a new bid on your auction item.
        
        Item: ${itemTitle}
        Buyer: ${buyerName}
        Bid Amount: AED ${bidAmount.toLocaleString()}
        
        Your auction is getting attention! The current highest bid is now AED ${bidAmount.toLocaleString()}.
        
        View your auction: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/auction/${auctionId}
        
        Thank you for using PhoneHub!
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Bid notification email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending bid notification email:', error);
    // Don't fail the request if email fails
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendBidNotificationEmail,
};

