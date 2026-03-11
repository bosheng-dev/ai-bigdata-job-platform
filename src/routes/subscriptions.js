const express = require('express');
const router = express.Router();
const subscriptionService = require('../services/subscription');

/**
 * @route POST /api/subscriptions
 * @desc 创建订阅
 */
router.post('/', async (req, res) => {
  try {
    const { email, phone, categories, locations, jobTypes, notifyType } = req.body;
    
    const result = await subscriptionService.createSubscription({
      email,
      phone,
      categories,
      locations,
      jobTypes,
      notifyType
    });
    
    res.json({
      success: true,
      data: result,
      message: result.message
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route DELETE /api/subscriptions/:identifier
 * @desc 取消订阅
 */
router.delete('/:identifier', async (req, res) => {
  try {
    const result = await subscriptionService.cancelSubscription(req.params.identifier);
    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/subscriptions
 * @desc 获取订阅列表（管理后台）
 */
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const subscriptions = await subscriptionService.getSubscriptions(
      parseInt(page),
      parseInt(limit)
    );
    
    res.json({
      success: true,
      data: subscriptions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/subscriptions/stats
 * @desc 获取订阅统计
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await subscriptionService.getSubscriptionStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/subscriptions/send-daily
 * @desc 手动触发每日推荐（管理后台）
 */
router.post('/send-daily', async (req, res) => {
  try {
    const result = await subscriptionService.sendDailyRecommendations();
    res.json({
      success: true,
      data: result,
      message: `每日推荐已发送: ${result.sent} 位订阅者`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
