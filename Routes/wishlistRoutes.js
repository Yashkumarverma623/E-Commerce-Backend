const express = require('express');
const { ObjectId } = require('mongodb');
const { authenticateToken, handleError } = require('../utils/helpers');

const router = express.Router();

// Get user's wishlist
router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const user = await db.collection('users').findOne(
      { _id: new ObjectId(req.user.userId) },
      { projection: { wishlist: 1 } }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Populate wishlist with product details
    const wishlistItems = [];
    if (user.wishlist && user.wishlist.length > 0) {
      for (const productId of user.wishlist) {
        const product = await db.collection('products').findOne({ _id: new ObjectId(productId) });
        if (product) {
          wishlistItems.push(product);
        }
      }
    }

    res.json(wishlistItems);
  } catch (error) {
    handleError(res, error, 'Failed to get wishlist');
  }
});

// Add item to wishlist
router.post('/add/:productId', authenticateToken, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { productId } = req.params;

    if (!ObjectId.isValid(productId)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    // Check if product exists
    const product = await db.collection('products').findOne({ _id: new ObjectId(productId) });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Check if already in wishlist
    const user = await db.collection('users').findOne({ _id: new ObjectId(req.user.userId) });
    if (user.wishlist?.includes(productId)) {
      return res.status(400).json({ error: 'Product already in wishlist' });
    }

    await db.collection('users').updateOne(
      { _id: new ObjectId(req.user.userId) },
      { $push: { wishlist: productId } }
    );

    res.json({ message: 'Item added to wishlist successfully' });
  } catch (error) {
    handleError(res, error, 'Failed to add item to wishlist');
  }
});

// Remove item from wishlist
router.delete('/remove/:productId', authenticateToken, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { productId } = req.params;

    if (!ObjectId.isValid(productId)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(req.user.userId) },
      { $pull: { wishlist: productId } }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ error: 'Item not found in wishlist' });
    }

    res.json({ message: 'Item removed from wishlist successfully' });
  } catch (error) {
    handleError(res, error, 'Failed to remove item from wishlist');
  }
});

// Clear entire wishlist
router.delete('/clear', authenticateToken, async (req, res) => {
  try {
    const db = req.app.locals.db;

    await db.collection('users').updateOne(
      { _id: new ObjectId(req.user.userId) },
      { $set: { wishlist: [] } }
    );

    res.json({ message: 'Wishlist cleared successfully' });
  } catch (error) {
    handleError(res, error, 'Failed to clear wishlist');
  }
});

module.exports = router;