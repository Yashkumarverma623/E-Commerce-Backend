const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

// Import route modules with absolute paths
const authRoutes = require(path.join(__dirname, 'routes', 'authRoutes'));
const productRoutes = require(path.join(__dirname, 'routes', 'productRoutes'));
const cartRoutes = require(path.join(__dirname, 'routes', 'cartRoutes'));
const wishlistRoutes = require(path.join(__dirname, 'routes', 'wishlistRoutes'));
const orderRoutes = require(path.join(__dirname, 'routes', 'orderRoutes'));
const userRoutes = require(path.join(__dirname, 'routes', 'userRoutes'));

const corsOptions = {
  origin: [
    'https://e-commerce-frontend-zeta-lake.vercel.app',
    'https://e-commerce-backend-3bfg.onrender.com',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:4173', 
  ],
  credentials: true, 
  optionsSuccessStatus: 200, 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin'
  ]
};
const app = express();
const PORT = process.env.PORT || 3000;

// Debug: Log the current directory and check if routes exist
console.log('Current directory:', __dirname);
console.log('Routes directory:', path.join(__dirname, 'routes'));

// Check if routes directory exists
const fs = require('fs');
try {
  const routesDir = path.join(__dirname, 'routes');
  const routeFiles = fs.readdirSync(routesDir);
  console.log('✅ Routes directory found. Files:', routeFiles);
} catch (error) {
  console.error('❌ Routes directory not found:', error.message);
}

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
    
    // Create indexes for better performance
    await createIndexes();
    
    // Make db available to routes
    app.locals.db = db;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

const createIndexes = async () => {
  try {
    // Products indexes
    await db.collection('products').createIndex({ name: 'text', description: 'text', category: 'text' });
    await db.collection('products').createIndex({ category: 1 });
    await db.collection('products').createIndex({ price: 1 });
    await db.collection('products').createIndex({ rating: -1 });
    
    // Users indexes
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    
    // Orders indexes
    await db.collection('orders').createIndex({ userId: 1 });
    await db.collection('orders').createIndex({ createdAt: -1 });
    
    console.log('✅ Database indexes created successfully');
  } catch (error) {
    console.error('❌ Error creating indexes:', error);
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

app.use('/auth', authRoutes);
app.use('/products', productRoutes);
app.use('/cart', cartRoutes);
app.use('/wishlist', wishlistRoutes);
app.use('/orders', orderRoutes);
app.use('/user', userRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Something went wrong!' });
});

const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log('✅ All routes loaded successfully');
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
