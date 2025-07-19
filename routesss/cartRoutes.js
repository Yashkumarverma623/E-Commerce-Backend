const express = require('express');
const { ObjectId } = require('mongodb');
const { authenticateToken, handleError } = require('../utils/helpers');

const router = express.Router();

// Get user's cart
router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const user = await db.collection('users').findOne(
      { _id: new ObjectId(req.user.userId) },
      { projection: { cart: 1 } }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Populate cart items with product details
    const cartItems = [];
    if (user.cart && user.cart.length > 0) {
      for (const item of user.cart) {
        const product = await db.collection('products').findOne({ _id: new ObjectId(item.productId) });
        if (product) {
          cartItems.push({
            ...product,
            quantity: item.quantity,
            addedAt: item.addedAt
          });
        }
      }
    }

    res.json(cartItems);
  } catch (error) {
    handleError(res, error, 'Failed to get cart');
  }
});

// Add item to cart
router.post('/add', authenticateToken, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { productId, quantity = 1 } = req.body;

    if (!productId) {
      return res.status(400).json({ error: 'Product ID is required' });
    }

    if (!ObjectId.isValid(productId)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    // Check if product exists
    const product = await db.collection('products').findOne({ _id: new ObjectId(productId) });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Check if item already in cart
    const user = await db.collection('users').findOne({ _id: new ObjectId(req.user.userId) });
    const existingItemIndex = user.cart?.findIndex(item => item.productId === productId);

    if (existingItemIndex >= 0) {
      // Update quantity
      await db.collection('users').updateOne(
        { _id: new ObjectId(req.user.userId) },
        { $inc: { [`cart.${existingItemIndex}.quantity`]: parseInt(quantity) } }
      );
    } else {
      // Add new item
      await db.collection('users').updateOne(
        { _id: new ObjectId(req.user.userId) },
        { 
          $push: { 
            cart: { 
              productId, 
              quantity: parseInt(quantity),
              addedAt: new Date()
            } 
          } 
        }
      );
    }

    res.json({ message: 'Item added to cart successfully' });
  } catch (error) {
    handleError(res, error, 'Failed to add item to cart');
  }
});

// Update cart item quantity
router.put('/update/:productId', authenticateToken, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { productId } = req.params;
    const { quantity } = req.body;

    if (!ObjectId.isValid(productId)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    if (!quantity || quantity < 1) {
      return res.status(400).json({ error: 'Quantity must be at least 1' });
    }

    const result = await db.collection('users').updateOne(
      { 
        _id: new ObjectId(req.user.userId),
        'cart.productId': productId
      },
      { 
        $set: { 'cart.$.quantity': parseInt(quantity) }
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Item not found in cart' });
    }

    res.json({ message: 'Cart item updated successfully' });
  } catch (error) {
    handleError(res, error, 'Failed to update cart item');
  }
});

// Remove item from cart
router.delete('/remove/:productId', authenticateToken, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { productId } = req.params;

    if (!ObjectId.isValid(productId)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(req.user.userId) },
      { $pull: { cart: { productId } } }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ error: 'Item not found in cart' });
    }

    res.json({ message: 'Item removed from cart successfully' });
  } catch (error) {
    handleError(res, error, 'Failed to remove item from cart');
  }
});

// Clear entire cart
router.delete('/clear', authenticateToken, async (req, res) => {
  try {
    const db = req.app.locals.db;

    await db.collection('users').updateOne(
      { _id: new ObjectId(req.user.userId) },
      { $set: { cart: [] } }
    );

    res.json({ message: 'Cart cleared successfully' });
  } catch (error) {
    handleError(res, error, 'Failed to clear cart');
  }
});

module.exports = router;