const express = require('express');
const { ObjectId } = require('mongodb');
const { authenticateToken, handleError } = require('../utils/helpers');

const router = express.Router();

router.post('/', authenticateToken, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { items, shippingAddress, paymentMethod } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Order items are required' });
    }

    if (!shippingAddress) {
      return res.status(400).json({ error: 'Shipping address is required' });
    }

    let total = 0;
    const orderItems = [];

    for (const item of items) {
      if (!ObjectId.isValid(item.productId)) {
        return res.status(400).json({ error: `Invalid product ID: ${item.productId}` });
      }

      const product = await db.collection('products').findOne({ _id: new ObjectId(item.productId) });
      if (!product) {
        return res.status(404).json({ error: `Product not found: ${item.productId}` });
      }

      const quantity = parseInt(item.quantity) || 1;
      const itemTotal = product.price * quantity;
      total += itemTotal;

      orderItems.push({
        productId: item.productId,
        name: product.name,
        price: product.price,
        quantity,
        total: itemTotal
      });
    }

    const order = {
      userId: new ObjectId(req.user.userId),
      items: orderItems,
      total,
      shippingAddress,
      paymentMethod: paymentMethod || 'cash_on_delivery',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('orders').insertOne(order);

    await db.collection('users').updateOne(
      { _id: new ObjectId(req.user.userId) },
      { $set: { cart: [] } }
    );

    res.status(201).json({
      message: 'Order created successfully',
      orderId: result.insertedId,
      order: { ...order, _id: result.insertedId }
    });
  } catch (error) {
    handleError(res, error, 'Failed to create order');
  }
});

router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { page = 1, limit = 10, status } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = { userId: new ObjectId(req.user.userId) };

    if (status) {
      query.status = status;
    }

    const orders = await db.collection('orders')
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

    const total = await db.collection('orders').countDocuments(query);

    res.json({
      orders,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    handleError(res, error, 'Failed to get orders');
  }
});

router.get('/:orderId', authenticateToken, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { orderId } = req.params;

    if (!ObjectId.isValid(orderId)) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }

    const order = await db.collection('orders').findOne({
      _id: new ObjectId(orderId),
      userId: new ObjectId(req.user.userId)
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    handleError(res, error, 'Failed to get order');
  }
});

router.put('/:orderId/cancel', authenticateToken, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { orderId } = req.params;

    if (!ObjectId.isValid(orderId)) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }

    const result = await db.collection('orders').updateOne(
      {
        _id: new ObjectId(orderId),
        userId: new ObjectId(req.user.userId),
        status: 'pending'
      },
      {
        $set: {
          status: 'cancelled',
          updatedAt: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Order not found or cannot be cancelled' });
    }

    res.json({ message: 'Order cancelled successfully' });
  } catch (error) {
    handleError(res, error, 'Failed to cancel order');
  }
});

module.exports = router;
