const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// MongoDB connection
let db;
let client;

const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not defined');
    }
    
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    db = client.db('ecommerce');
    console.log('✅ MongoDB connected successfully');
    
    // Make db available to routes
    app.locals.db = db;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Test routes one by one
console.log('Loading auth routes...');
try {
  const authRoutes = require('./routes/authRoutes');
  app.use('/auth', authRoutes);
  console.log('✅ Auth routes loaded successfully');
} catch (error) {
  console.error('❌ Error loading auth routes:', error.message);
}

console.log('Loading product routes...');
try {
  const productRoutes = require('./routes/productRoutes');
  app.use('/products', productRoutes);
  console.log('✅ Product routes loaded successfully');
} catch (error) {
  console.error('❌ Error loading product routes:', error.message);
}

console.log('Loading cart routes...');
try {
  const cartRoutes = require('./routes/cartRoutes');
  app.use('/cart', cartRoutes);
  console.log('✅ Cart routes loaded successfully');
} catch (error) {
  console.error('❌ Error loading cart routes:', error.message);
}

console.log('Loading wishlist routes...');
try {
  const wishlistRoutes = require('./routes/wishlistRoutes');
  app.use('/wishlist', wishlistRoutes);
  console.log('✅ Wishlist routes loaded successfully');
} catch (error) {
  console.error('❌ Error loading wishlist routes:', error.message);
}

console.log('Loading order routes...');
try {
  const orderRoutes = require('./routes/orderRoutes');
  app.use('/orders', orderRoutes);
  console.log('✅ Order routes loaded successfully');
} catch (error) {
  console.error('❌ Error loading order routes:', error.message);
}

console.log('Loading user routes...');
try {
  const userRoutes = require('./routes/userRoutes');
  app.use('/user', userRoutes);
  console.log('✅ User routes loaded successfully');
} catch (error) {
  console.error('❌ Error loading user routes:', error.message);
}

// ✅ Fixed: Use proper catch-all route instead of '*'
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Something went wrong!' });
});

const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
};

startServer().catch(console.error);

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  if (client) {
    await client.close();
    console.log('✅ MongoDB connection closed');
  }
  process.exit(0);
});