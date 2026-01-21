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
      user: process.env.SMTP_USER || process.env.EMAIL_USER || 'support@phonehub.ae',
      pass: process.env.SMTP_PASS || process.env.EMAIL_PASS || ''
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
      from: `"PhoneHub" <support@phonehub.ae>`,
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

// Send auction winner payment email
const sendWinnerPaymentEmail = async (winnerEmail, winnerName, itemTitle, bidAmount, paymentLink, paymentDeadline) => {
  try {
    if (!process.env.SMTP_USER && !process.env.EMAIL_USER) {
      console.log('Email not configured. Would send winner payment email to:', winnerEmail);
      return { success: true, skipped: true };
    }

    const transporter = createTransporter();
    const deadlineDate = new Date(paymentDeadline).toLocaleString('en-US', { 
      timeZone: 'Asia/Dubai',
      dateStyle: 'full',
      timeStyle: 'short'
    });

    const mailOptions = {
      from: `"PhoneHub" <support@phonehub.ae>`,
      to: winnerEmail,
      subject: `🎉 You Won! Complete Your Payment - ${itemTitle}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #10b981 0%, #2563eb 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .winner-info { background: white; padding: 25px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981; }
            .amount { font-size: 28px; font-weight: bold; color: #10b981; margin: 15px 0; }
            .deadline { background: #fef3c7; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #f59e0b; }
            .button { display: inline-block; padding: 15px 30px; background: #10b981; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; font-weight: bold; }
            .warning { background: #fee2e2; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #ef4444; }
            .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Congratulations! You Won the Auction!</h1>
            </div>
            <div class="content">
              <p>Hello ${winnerName},</p>
              <p>Congratulations! You are the winning bidder for this auction item.</p>
              
              <div class="winner-info">
                <p><strong>Item:</strong> ${itemTitle}</p>
                <p><strong>Your Winning Bid:</strong></p>
                <div class="amount">AED ${bidAmount.toLocaleString()}</div>
              </div>
              
              <div class="deadline">
                <p><strong>⏰ Payment Deadline:</strong> ${deadlineDate}</p>
                <p>Please complete your payment before this deadline to secure your purchase.</p>
              </div>
              
              <div class="warning">
                <p><strong>⚠️ Important:</strong> If you fail to complete payment within the deadline, your account will be permanently blocked, and the second highest bidder will be given the opportunity to purchase.</p>
              </div>
              
              <div style="text-align: center;">
                <a href="${paymentLink}" class="button">Complete Payment Now</a>
              </div>
              
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
        Congratulations! You Won the Auction!
        
        Hello ${winnerName},
        
        Congratulations! You are the winning bidder for this auction item.
        
        Item: ${itemTitle}
        Your Winning Bid: AED ${bidAmount.toLocaleString()}
        
        Payment Deadline: ${deadlineDate}
        Please complete your payment before this deadline to secure your purchase.
        
        Important: If you fail to complete payment within the deadline, your account will be permanently blocked, and the second highest bidder will be given the opportunity to purchase.
        
        Complete Payment: ${paymentLink}
        
        Thank you for using PhoneHub!
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Winner payment email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending winner payment email:', error);
    return { success: false, error: error.message };
  }
};

// Send second bidder payment email
const sendSecondBidderPaymentEmail = async (bidderEmail, bidderName, itemTitle, bidAmount, paymentLink) => {
  try {
    if (!process.env.SMTP_USER && !process.env.EMAIL_USER) {
      console.log('Email not configured. Would send second bidder payment email to:', bidderEmail);
      return { success: true, skipped: true };
    }

    const transporter = createTransporter();

    const mailOptions = {
      from: `"PhoneHub" <support@phonehub.ae>`,
      to: bidderEmail,
      subject: `🎯 Opportunity: Complete Payment for ${itemTitle}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f59e0b 0%, #2563eb 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .info { background: white; padding: 25px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b; }
            .amount { font-size: 28px; font-weight: bold; color: #f59e0b; margin: 15px 0; }
            .button { display: inline-block; padding: 15px 30px; background: #f59e0b; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; font-weight: bold; }
            .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎯 New Opportunity Available!</h1>
            </div>
            <div class="content">
              <p>Hello ${bidderName},</p>
              <p>Good news! The previous winner was unable to complete payment, and you now have the opportunity to purchase this item.</p>
              
              <div class="info">
                <p><strong>Item:</strong> ${itemTitle}</p>
                <p><strong>Your Bid Amount:</strong></p>
                <div class="amount">AED ${bidAmount.toLocaleString()}</div>
              </div>
              
              <p>You have 48 hours to complete your payment. Don't miss this opportunity!</p>
              
              <div style="text-align: center;">
                <a href="${paymentLink}" class="button">Complete Payment Now</a>
              </div>
              
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
        New Opportunity Available!
        
        Hello ${bidderName},
        
        Good news! The previous winner was unable to complete payment, and you now have the opportunity to purchase this item.
        
        Item: ${itemTitle}
        Your Bid Amount: AED ${bidAmount.toLocaleString()}
        
        You have 48 hours to complete your payment. Don't miss this opportunity!
        
        Complete Payment: ${paymentLink}
        
        Thank you for using PhoneHub!
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Second bidder payment email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending second bidder payment email:', error);
    return { success: false, error: error.message };
  }
};

// Send payment reminder email
const sendPaymentReminderEmail = async (userEmail, userName, itemTitle, bidAmount, paymentLink, hoursRemaining) => {
  try {
    if (!process.env.SMTP_USER && !process.env.EMAIL_USER) {
      console.log('Email not configured. Would send payment reminder to:', userEmail);
      return { success: true, skipped: true };
    }

    const transporter = createTransporter();

    const mailOptions = {
      from: `"PhoneHub" <support@phonehub.ae>`,
      to: userEmail,
      subject: `⏰ Payment Reminder: ${hoursRemaining} Hours Remaining`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .reminder { background: #fee2e2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444; text-align: center; }
            .time { font-size: 32px; font-weight: bold; color: #ef4444; margin: 10px 0; }
            .button { display: inline-block; padding: 15px 30px; background: #ef4444; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; font-weight: bold; }
            .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⏰ Payment Reminder</h1>
            </div>
            <div class="content">
              <p>Hello ${userName},</p>
              <p>This is a reminder that you have a pending payment for your auction win.</p>
              
              <div class="reminder">
                <p><strong>Time Remaining:</strong></p>
                <div class="time">${hoursRemaining} Hours</div>
              </div>
              
              <p><strong>Item:</strong> ${itemTitle}</p>
              <p><strong>Amount:</strong> AED ${bidAmount.toLocaleString()}</p>
              
              <p><strong>⚠️ Important:</strong> Please complete your payment before the deadline to avoid account blocking.</p>
              
              <div style="text-align: center;">
                <a href="${paymentLink}" class="button">Complete Payment Now</a>
              </div>
              
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
        Payment Reminder
        
        Hello ${userName},
        
        This is a reminder that you have a pending payment for your auction win.
        
        Time Remaining: ${hoursRemaining} Hours
        
        Item: ${itemTitle}
        Amount: AED ${bidAmount.toLocaleString()}
        
        Important: Please complete your payment before the deadline to avoid account blocking.
        
        Complete Payment: ${paymentLink}
        
        Thank you for using PhoneHub!
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Payment reminder email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending payment reminder email:', error);
    return { success: false, error: error.message };
  }
};

// Send featured listing payment confirmation
const sendFeaturedListingPaymentEmail = async (sellerEmail, sellerName, listingTitle, paymentLink) => {
  try {
    if (!process.env.SMTP_USER && !process.env.EMAIL_USER) {
      console.log('Email not configured. Would send featured listing payment email to:', sellerEmail);
      return { success: true, skipped: true };
    }

    const transporter = createTransporter();

    const mailOptions = {
      from: `"PhoneHub" <support@phonehub.ae>`,
      to: sellerEmail,
      subject: `✨ Feature Your Listing: ${listingTitle}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #8b5cf6 0%, #2563eb 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .info { background: white; padding: 25px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #8b5cf6; }
            .button { display: inline-block; padding: 15px 30px; background: #8b5cf6; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; font-weight: bold; }
            .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✨ Feature Your Listing!</h1>
            </div>
            <div class="content">
              <p>Hello ${sellerName},</p>
              <p>Make your listing stand out! Pay to feature your listing at the top of search results and get more visibility.</p>
              
              <div class="info">
                <p><strong>Listing:</strong> ${listingTitle}</p>
                <p><strong>Benefits of Featured Listing:</strong></p>
                <ul>
                  <li>✅ Appears at the top of search results</li>
                  <li>✅ Higher visibility and more views</li>
                  <li>✅ Increased chances of quick sale</li>
                  <li>✅ Premium placement on category pages</li>
                </ul>
              </div>
              
              <div style="text-align: center;">
                <a href="${paymentLink}" class="button">Pay to Feature Listing</a>
              </div>
              
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
        Feature Your Listing!
        
        Hello ${sellerName},
        
        Make your listing stand out! Pay to feature your listing at the top of search results and get more visibility.
        
        Listing: ${listingTitle}
        
        Benefits of Featured Listing:
        - Appears at the top of search results
        - Higher visibility and more views
        - Increased chances of quick sale
        - Premium placement on category pages
        
        Pay to Feature: ${paymentLink}
        
        Thank you for using PhoneHub!
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Featured listing payment email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending featured listing payment email:', error);
    return { success: false, error: error.message };
  }
};

// Send payment invoice for verified batch
const sendVerifiedBatchInvoice = async (userEmail, userName, amount, paymentId, paidAt) => {
  try {
    if (!process.env.SMTP_USER && !process.env.EMAIL_USER) {
      console.log('Email not configured. Would send verified batch invoice to:', userEmail);
      return { success: true, skipped: true };
    }

    const transporter = createTransporter();
    const invoiceDate = new Date(paidAt).toLocaleString('en-US', { 
      timeZone: 'Asia/Dubai',
      dateStyle: 'full',
      timeStyle: 'short'
    });

    const mailOptions = {
      from: '"PhoneHub" <support@phonehub.ae>',
      to: userEmail,
      subject: `📧 Payment Invoice - Verified Batch Purchase`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .invoice-box { background: white; padding: 25px; border-radius: 8px; margin: 20px 0; border: 2px solid #e5e7eb; }
            .invoice-header { border-bottom: 2px solid #e5e7eb; padding-bottom: 15px; margin-bottom: 20px; }
            .invoice-item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f3f4f6; }
            .invoice-total { display: flex; justify-content: space-between; padding: 15px 0; margin-top: 15px; border-top: 2px solid #e5e7eb; font-size: 18px; font-weight: bold; }
            .amount { color: #27ae60; }
            .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 12px; }
            .benefits { background: #f0f9ff; padding: 15px; border-radius: 6px; margin: 20px 0; }
            .benefits ul { margin: 10px 0; padding-left: 20px; }
            .benefits li { margin: 5px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📧 Payment Invoice</h1>
              <p>Thank you for your purchase!</p>
            </div>
            <div class="content">
              <p>Hello ${userName},</p>
              <p>Thank you for purchasing a Verified Batch. Please find your payment invoice below.</p>
              
              <div class="invoice-box">
                <div class="invoice-header">
                  <h2 style="margin: 0; color: #2c3e50;">Invoice Details</h2>
                  <p style="margin: 5px 0; color: #6b7280; font-size: 14px;">Invoice #: ${paymentId}</p>
                  <p style="margin: 5px 0; color: #6b7280; font-size: 14px;">Date: ${invoiceDate}</p>
                </div>
                
                <div class="invoice-item">
                  <span><strong>Item:</strong></span>
                  <span>Verified Batch</span>
                </div>
                <div class="invoice-item">
                  <span><strong>Description:</strong></span>
                  <span>Verified badge for all your listings</span>
                </div>
                <div class="invoice-item">
                  <span><strong>Quantity:</strong></span>
                  <span>1</span>
                </div>
                <div class="invoice-item">
                  <span><strong>Unit Price:</strong></span>
                  <span>AED ${amount.toFixed(2)}</span>
                </div>
                
                <div class="invoice-total">
                  <span>Total Amount:</span>
                  <span class="amount">AED ${amount.toFixed(2)}</span>
                </div>
              </div>

              <div class="benefits">
                <h3 style="margin-top: 0;">✅ What You Get:</h3>
                <ul>
                  <li>Verified badge on all your listings</li>
                  <li>Increased trust from buyers</li>
                  <li>Enhanced credibility for your profile</li>
                  <li>Lifetime verification status</li>
                </ul>
              </div>
              
              <p style="margin-top: 30px;">Your verified batch is now active! All your listings will display the verified badge.</p>
              
              <p>If you have any questions, please contact us at support@phonehub.ae</p>
            </div>
            <div class="footer">
              <p>This is an automated invoice from PhoneHub. Please keep this for your records.</p>
              <p>© ${new Date().getFullYear()} PhoneHub. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Payment Invoice - Verified Batch Purchase
        
        Hello ${userName},
        
        Thank you for purchasing a Verified Batch. Please find your payment invoice below.
        
        Invoice Details
        Invoice #: ${paymentId}
        Date: ${invoiceDate}
        
        Item: Verified Batch
        Description: Verified badge for all your listings
        Quantity: 1
        Unit Price: AED ${amount.toFixed(2)}
        Total Amount: AED ${amount.toFixed(2)}
        
        What You Get:
        - Verified badge on all your listings
        - Increased trust from buyers
        - Enhanced credibility for your profile
        - Lifetime verification status
        
        Your verified batch is now active! All your listings will display the verified badge.
        
        If you have any questions, please contact us at support@phonehub.ae
        
        © ${new Date().getFullYear()} PhoneHub. All rights reserved.
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Verified batch invoice sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending verified batch invoice:', error);
    return { success: false, error: error.message };
  }
};

// Send payment invoice for featured listing
const sendFeaturedListingInvoice = async (userEmail, userName, listingTitle, amount, duration, paymentId, paidAt, expiryDate) => {
  try {
    if (!process.env.SMTP_USER && !process.env.EMAIL_USER) {
      console.log('Email not configured. Would send featured listing invoice to:', userEmail);
      return { success: true, skipped: true };
    }

    const transporter = createTransporter();
    const invoiceDate = new Date(paidAt).toLocaleString('en-US', { 
      timeZone: 'Asia/Dubai',
      dateStyle: 'full',
      timeStyle: 'short'
    });
    const expiryDateFormatted = new Date(expiryDate).toLocaleString('en-US', { 
      timeZone: 'Asia/Dubai',
      dateStyle: 'full',
      timeStyle: 'short'
    });

    const mailOptions = {
      from: '"PhoneHub" <support@phonehub.ae>',
      to: userEmail,
      subject: `📧 Payment Invoice - Featured Listing`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .invoice-box { background: white; padding: 25px; border-radius: 8px; margin: 20px 0; border: 2px solid #e5e7eb; }
            .invoice-header { border-bottom: 2px solid #e5e7eb; padding-bottom: 15px; margin-bottom: 20px; }
            .invoice-item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f3f4f6; }
            .invoice-total { display: flex; justify-content: space-between; padding: 15px 0; margin-top: 15px; border-top: 2px solid #e5e7eb; font-size: 18px; font-weight: bold; }
            .amount { color: #27ae60; }
            .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 12px; }
            .benefits { background: #f0f9ff; padding: 15px; border-radius: 6px; margin: 20px 0; }
            .benefits ul { margin: 10px 0; padding-left: 20px; }
            .benefits li { margin: 5px 0; }
            .duration-info { background: #fef3c7; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #f59e0b; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📧 Payment Invoice</h1>
              <p>Thank you for featuring your listing!</p>
            </div>
            <div class="content">
              <p>Hello ${userName},</p>
              <p>Thank you for featuring your listing. Please find your payment invoice below.</p>
              
              <div class="invoice-box">
                <div class="invoice-header">
                  <h2 style="margin: 0; color: #2c3e50;">Invoice Details</h2>
                  <p style="margin: 5px 0; color: #6b7280; font-size: 14px;">Invoice #: ${paymentId}</p>
                  <p style="margin: 5px 0; color: #6b7280; font-size: 14px;">Date: ${invoiceDate}</p>
                </div>
                
                <div class="invoice-item">
                  <span><strong>Item:</strong></span>
                  <span>Featured Listing</span>
                </div>
                <div class="invoice-item">
                  <span><strong>Listing Title:</strong></span>
                  <span>${listingTitle}</span>
                </div>
                <div class="invoice-item">
                  <span><strong>Duration:</strong></span>
                  <span>${duration} days</span>
                </div>
                <div class="invoice-item">
                  <span><strong>Quantity:</strong></span>
                  <span>1</span>
                </div>
                <div class="invoice-item">
                  <span><strong>Unit Price:</strong></span>
                  <span>AED ${amount.toFixed(2)}</span>
                </div>
                
                <div class="invoice-total">
                  <span>Total Amount:</span>
                  <span class="amount">AED ${amount.toFixed(2)}</span>
                </div>
              </div>

              <div class="duration-info">
                <p style="margin: 0;"><strong>⏰ Featured Period:</strong></p>
                <p style="margin: 5px 0;">Your listing will be featured until: <strong>${expiryDateFormatted}</strong></p>
              </div>

              <div class="benefits">
                <h3 style="margin-top: 0;">✅ What You Get:</h3>
                <ul>
                  <li>Your listing appears at the top of homepage</li>
                  <li>Priority placement in search results</li>
                  <li>Higher visibility and more views</li>
                  <li>Increased chances of quick sale</li>
                </ul>
              </div>
              
              <p style="margin-top: 30px;">Your listing is now featured and will appear at the top of the homepage for ${duration} days.</p>
              
              <p>If you have any questions, please contact us at support@phonehub.ae</p>
            </div>
            <div class="footer">
              <p>This is an automated invoice from PhoneHub. Please keep this for your records.</p>
              <p>© ${new Date().getFullYear()} PhoneHub. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Payment Invoice - Featured Listing
        
        Hello ${userName},
        
        Thank you for featuring your listing. Please find your payment invoice below.
        
        Invoice Details
        Invoice #: ${paymentId}
        Date: ${invoiceDate}
        
        Item: Featured Listing
        Listing Title: ${listingTitle}
        Duration: ${duration} days
        Quantity: 1
        Unit Price: AED ${amount.toFixed(2)}
        Total Amount: AED ${amount.toFixed(2)}
        
        Featured Period:
        Your listing will be featured until: ${expiryDateFormatted}
        
        What You Get:
        - Your listing appears at the top of homepage
        - Priority placement in search results
        - Higher visibility and more views
        - Increased chances of quick sale
        
        Your listing is now featured and will appear at the top of the homepage for ${duration} days.
        
        If you have any questions, please contact us at support@phonehub.ae
        
        © ${new Date().getFullYear()} PhoneHub. All rights reserved.
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Featured listing invoice sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending featured listing invoice:', error);
    return { success: false, error: error.message };
  }
};

// Send payment failure email for featured listing
const sendFeaturedListingPaymentFailureEmail = async (userEmail, userName, listingTitle, amount, duration) => {
  try {
    if (!process.env.SMTP_USER && !process.env.EMAIL_USER) {
      console.log('Email not configured. Would send featured listing payment failure email to:', userEmail);
      return { success: true, skipped: true };
    }

    const transporter = createTransporter();

    const mailOptions = {
      from: '"PhoneHub" <support@phonehub.ae>',
      to: userEmail,
      subject: `❌ Payment Failed - Featured Listing`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .failure-info { background: white; padding: 25px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444; }
            .amount { font-size: 24px; font-weight: bold; color: #ef4444; margin: 15px 0; }
            .button { display: inline-block; padding: 15px 30px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; font-weight: bold; }
            .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 12px; }
            .help-box { background: #fef3c7; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #f59e0b; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>❌ Payment Failed</h1>
            </div>
            <div class="content">
              <p>Hello ${userName},</p>
              <p>We're sorry, but your payment for featuring your listing has failed.</p>
              
              <div class="failure-info">
                <p><strong>Listing:</strong> ${listingTitle}</p>
                <p><strong>Duration:</strong> ${duration} days</p>
                <p><strong>Amount:</strong></p>
                <div class="amount">AED ${amount.toFixed(2)}</div>
              </div>
              
              <div class="help-box">
                <p><strong>What happened?</strong></p>
                <p>Your payment could not be processed. This could be due to:</p>
                <ul>
                  <li>Insufficient funds in your account</li>
                  <li>Card declined by your bank</li>
                  <li>Payment was cancelled</li>
                  <li>Technical issues during payment processing</li>
                </ul>
              </div>
              
              <p><strong>What's next?</strong></p>
              <p>Your listing has not been created yet. You can try again by going to the Post Ad page and completing the payment process.</p>
              
              <p>If you continue to experience issues, please contact our support team at support@phonehub.ae</p>
              
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
        Payment Failed - Featured Listing
        
        Hello ${userName},
        
        We're sorry, but your payment for featuring your listing has failed.
        
        Listing: ${listingTitle}
        Duration: ${duration} days
        Amount: AED ${amount.toFixed(2)}
        
        What happened?
        Your payment could not be processed. This could be due to:
        - Insufficient funds in your account
        - Card declined by your bank
        - Payment was cancelled
        - Technical issues during payment processing
        
        What's next?
        Your listing has not been created yet. You can try again by going to the Post Ad page and completing the payment process.
        
        If you continue to experience issues, please contact our support team at support@phonehub.ae
        
        Thank you for using PhoneHub!
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Featured listing payment failure email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending featured listing payment failure email:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendBidNotificationEmail,
  sendWinnerPaymentEmail,
  sendSecondBidderPaymentEmail,
  sendPaymentReminderEmail,
  sendFeaturedListingPaymentEmail,
  sendVerifiedBatchInvoice,
  sendFeaturedListingInvoice,
  sendFeaturedListingPaymentFailureEmail,
};

