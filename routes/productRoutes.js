const express = require('express');
const { ObjectId } = require('mongodb');
const { handleError } = require('../utils/helpers');
const { authenticateToken } = require('../auth/auth'); // Assuming you have auth middleware

const router = express.Router();

// Get all products with filtering and pagination
router.get('/', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { 
      page = 1, 
      limit = 10, 
      category, 
      minPrice, 
      maxPrice, 
      search,
      sortBy = 'name',
      sortOrder = 'asc'
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = {};

    // Build query filters
    if (category) query.category = category;
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }
    if (search) {
      query.$text = { $search: search };
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const products = await db.collection('products')
      .find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

    const total = await db.collection('products').countDocuments(query);

    res.json({
      products,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    handleError(res, error, 'Failed to get products');
  }
});

// Create new product (POST)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const {
      name,
      description,
      price,
      category,
      image,
      stock,
      brand,
      weight,
      dimensions
    } = req.body;

    // Validation
    if (!name || !description || !price || !category || stock === undefined) {
      return res.status(400).json({ 
        error: 'Name, description, price, category, and stock are required' 
      });
    }

    if (price <= 0) {
      return res.status(400).json({ 
        error: 'Price must be greater than 0' 
      });
    }

    if (stock < 0) {
      return res.status(400).json({ 
        error: 'Stock cannot be negative' 
      });
    }

    // Valid categories (should match frontend)
    const validCategories = [
      'electronics', 'clothing', 'books', 'home', 'sports', 
      'beauty', 'toys', 'automotive', 'jewelry', 'food'
    ];

    if (!validCategories.includes(category)) {
      return res.status(400).json({ 
        error: 'Invalid category' 
      });
    }

    // Create product object
    const product = {
      name: name.trim(),
      description: description.trim(),
      price: parseFloat(price),
      category,
      stock: parseInt(stock),
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: req.user.id // From auth middleware
    };

    // Add optional fields if provided
    if (image) product.image = image.trim();
    if (brand) product.brand = brand.trim();
    if (weight) product.weight = parseFloat(weight);
    
    // Handle dimensions
    if (dimensions) {
      const dims = {};
      if (dimensions.length) dims.length = parseFloat(dimensions.length);
      if (dimensions.width) dims.width = parseFloat(dimensions.width);
      if (dimensions.height) dims.height = parseFloat(dimensions.height);
      
      if (Object.keys(dims).length > 0) {
        product.dimensions = dims;
      }
    }

    // Insert product into database
    const result = await db.collection('products').insertOne(product);
    
    if (result.insertedId) {
      // Return the created product with its ID
      const createdProduct = { ...product, _id: result.insertedId };
      res.status(201).json(createdProduct);
    } else {
      res.status(500).json({ error: 'Failed to create product' });
    }

  } catch (error) {
    handleError(res, error, 'Failed to create product');
  }
});

// Get single product by ID
router.get('/:id', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const product = await db.collection('products').findOne({ _id: new ObjectId(id) });
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(product);
  } catch (error) {
    handleError(res, error, 'Failed to get product');
  }
});

// Update product (PUT)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const {
      name,
      description,
      price,
      category,
      image,
      stock,
      brand,
      weight,
      dimensions
    } = req.body;

    // Build update object
    const updateData = {
      updatedAt: new Date()
    };

    if (name) updateData.name = name.trim();
    if (description) updateData.description = description.trim();
    if (price) updateData.price = parseFloat(price);
    if (category) updateData.category = category;
    if (stock !== undefined) updateData.stock = parseInt(stock);
    if (image !== undefined) updateData.image = image.trim();
    if (brand !== undefined) updateData.brand = brand.trim();
    if (weight !== undefined) updateData.weight = parseFloat(weight);

    if (dimensions) {
      const dims = {};
      if (dimensions.length !== undefined) dims.length = parseFloat(dimensions.length);
      if (dimensions.width !== undefined) dims.width = parseFloat(dimensions.width);
      if (dimensions.height !== undefined) dims.height = parseFloat(dimensions.height);
      updateData.dimensions = dims;
    }

    const result = await db.collection('products').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ message: 'Product updated successfully' });
  } catch (error) {
    handleError(res, error, 'Failed to update product');
  }
});

// Delete product (DELETE)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const result = await db.collection('products').deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    handleError(res, error, 'Failed to delete product');
  }
});

// Get products by category
router.get('/category/:category', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { category } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const products = await db.collection('products')
      .find({ category })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

    const total = await db.collection('products').countDocuments({ category });

    res.json({
      products,
      category,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    handleError(res, error, 'Failed to get products by category');
  }
});

module.exports = router;