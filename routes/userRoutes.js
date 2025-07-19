const express = require('express');
const { ObjectId } = require('mongodb');
const { authenticateToken, handleError } = require('../utils/helpers');

const router = express.Router();

router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const user = await db.collection('users').findOne(
      { _id: new ObjectId(req.user.userId) },
      { projection: { password: 0 } } 
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    handleError(res, error, 'Failed to get user profile');
  }
});

router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { name, email } = req.body;

    if (!name && !email) {
      return res.status(400).json({ error: 'At least one field (name or email) is required' });
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    updateData.updatedAt = new Date();

    if (email) {
      const existingUser = await db.collection('users').findOne({ 
        email, 
        _id: { $ne: new ObjectId(req.user.userId) } 
      });
      if (existingUser) {
        return res.status(400).json({ error: 'Email already in use' });
      }
    }

    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(req.user.userId) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    handleError(res, error, 'Failed to update user profile');
  }
});

router.get('/orders', authenticateToken, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const orders = await db.collection('orders')
      .find({ userId: new ObjectId(req.user.userId) })
      .sort({ createdAt: -1 })
      .toArray();

    res.json(orders);
  } catch (error) {
    handleError(res, error, 'Failed to get user orders');
  }
});

router.delete('/account', authenticateToken, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = new ObjectId(req.user.userId);

    await db.collection('orders').deleteMany({ userId });
    
    const result = await db.collection('users').deleteOne({ _id: userId });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    handleError(res, error, 'Failed to delete user account');
  }
});

module.exports = router;
