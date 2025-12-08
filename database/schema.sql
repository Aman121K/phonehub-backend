-- Create database
CREATE DATABASE IF NOT EXISTS phonehub;
USE phonehub;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  city VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Listings table
CREATE TABLE IF NOT EXISTS listings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  category_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  storage VARCHAR(50),
  condition VARCHAR(100),
  city VARCHAR(100) NOT NULL,
  listing_type ENUM('fixed_price', 'auction') DEFAULT 'fixed_price',
  status ENUM('active', 'sold', 'expired') DEFAULT 'active',
  image_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
  INDEX idx_city (city),
  INDEX idx_category (category_id),
  INDEX idx_status (status)
);

-- Auctions table
CREATE TABLE IF NOT EXISTS auctions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  listing_id INT NOT NULL,
  start_price DECIMAL(10, 2) NOT NULL,
  current_price DECIMAL(10, 2) NOT NULL,
  end_date DATETIME NOT NULL,
  status ENUM('live', 'ended', 'cancelled') DEFAULT 'live',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
);

-- Bids table
CREATE TABLE IF NOT EXISTS bids (
  id INT AUTO_INCREMENT PRIMARY KEY,
  auction_id INT NOT NULL,
  user_id INT NOT NULL,
  bid_amount DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (auction_id) REFERENCES auctions(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_auction (auction_id)
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sender_id INT NOT NULL,
  receiver_id INT NOT NULL,
  listing_id INT,
  message TEXT NOT NULL,
  read_status BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE SET NULL
);

-- Insert default categories
INSERT INTO categories (name, slug) VALUES
('iPhone SE', 'iphone-se'),
('iPhone 6', 'iphone-6'),
('iPhone 6s', 'iphone-6s'),
('iPhone 6 Plus', 'iphone-6-plus'),
('iPhone 6s Plus', 'iphone-6s-plus'),
('iPhone 7', 'iphone-7'),
('iPhone 7 Plus', 'iphone-7-plus'),
('iPhone 8', 'iphone-8'),
('iPhone 8 Plus', 'iphone-8-plus'),
('iPhone X', 'iphone-x'),
('iPhone XR', 'iphone-xr'),
('iPhone XS', 'iphone-xs'),
('iPhone XS Max', 'iphone-xs-max'),
('iPhone 11', 'iphone-11'),
('iPhone 11 Pro', 'iphone-11-pro'),
('iPhone 11 Pro Max', 'iphone-11-pro-max'),
('iPhone 12', 'iphone-12'),
('iPhone 12 Mini', 'iphone-12-mini'),
('iPhone 12 Pro', 'iphone-12-pro'),
('iPhone 12 Pro Max', 'iphone-12-pro-max'),
('iPhone 13', 'iphone-13'),
('iPhone 13 Mini', 'iphone-13-mini'),
('iPhone 13 Pro', 'iphone-13-pro'),
('iPhone 13 Pro Max', 'iphone-13-pro-max'),
('iPhone 14', 'iphone-14'),
('iPhone 14 Plus', 'iphone-14-plus'),
('iPhone 14 Pro', 'iphone-14-pro'),
('iPhone 14 Pro Max', 'iphone-14-pro-max'),
('iPhone 15', 'iphone-15'),
('iPhone 15 Plus', 'iphone-15-plus'),
('iPhone 15 Pro', 'iphone-15-pro'),
('iPhone 15 Pro Max', 'iphone-15-pro-max'),
('iPhone 16', 'iphone-16'),
('iPhone 16 Plus', 'iphone-16-plus'),
('iPhone 16 Pro', 'iphone-16-pro'),
('iPhone 16 Pro Max', 'iphone-16-pro-max'),
('iPhone 16e', 'iphone-16e')
ON DUPLICATE KEY UPDATE name=name;

