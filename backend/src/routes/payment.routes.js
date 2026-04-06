const express = require('express');
const router = express.Router();
const { createOrder, confirmStripePayment, stripeWebhook, getPaymentHistory, processRefund } = require('../controllers/payment.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

router.post('/webhook', express.raw({ type: 'application/json' }), stripeWebhook);
router.post('/create-order', protect, createOrder);
router.post('/stripe/confirm', protect, confirmStripePayment);
router.get('/history', protect, getPaymentHistory);
router.post('/refund/:paymentId', protect, authorize('admin'), processRefund);

module.exports = router;
