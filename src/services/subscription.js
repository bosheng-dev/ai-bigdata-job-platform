/**
 * 订阅服务
 * 支持邮件订阅和微信通知
 */

const db = require('../models/database');

class SubscriptionService {
  constructor() {
    // 邮件配置（使用环境变量）
    this.emailConfig = {
      host: process.env.SMTP_HOST || 'smtp.qq.com',
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    };
    
    // 微信配置
    this.wechatConfig = {
      appId: process.env.WECHAT_APPID,
      appSecret: process.env.WECHAT_APPSECRET,
      templateId: process.env.WECHAT_TEMPLATE_ID
    };
  }

  /**
   * 创建订阅
   */
  async createSubscription(data) {
    const { email, phone, categories, locations, jobTypes, notifyType = 'email' } = data;
    
    // 验证至少有一种联系方式
    if (!email && !phone) {
      throw new Error('请提供邮箱或手机号');
    }
    
    // 检查是否已订阅
    const existing = await db.query(
      'SELECT id FROM subscriptions WHERE (email = ? OR phone = ?) AND status = ?',
      [email || '', phone || '', 'active']
    );
    
    if (existing.length > 0) {
      // 更新订阅偏好
      await db.run(
        `UPDATE subscriptions SET 
         categories = ?, locations = ?, job_types = ?, notify_type = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          JSON.stringify(categories || []),
          JSON.stringify(locations || []),
          JSON.stringify(jobTypes || []),
          notifyType,
          existing[0].id
        ]
      );
      return { id: existing[0].id, message: '订阅偏好已更新' };
    }
    
    // 创建新订阅
    const result = await db.run(
      `INSERT INTO subscriptions (email, phone, categories, locations, job_types, notify_type, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        email || null,
        phone || null,
        JSON.stringify(categories || []),
        JSON.stringify(locations || []),
        JSON.stringify(jobTypes || []),
        notifyType,
        'active'
      ]
    );
    
    return { id: result.id, message: '订阅成功' };
  }

  /**
   * 取消订阅
   */
  async cancelSubscription(identifier) {
    const result = await db.run(
      'UPDATE subscriptions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE email = ? OR phone = ?',
      ['cancelled', identifier, identifier]
    );
    
    if (result.changes === 0) {
      throw new Error('未找到订阅记录');
    }
    
    return { message: '订阅已取消' };
  }

  /**
   * 获取订阅列表
   */
  async getSubscriptions(page = 1, limit = 20) {
    const subscriptions = await db.query(
      'SELECT * FROM subscriptions WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      ['active', limit, (page - 1) * limit]
    );
    
    // 解析JSON字段
    return subscriptions.map(sub => ({
      ...sub,
      categories: JSON.parse(sub.categories || '[]'),
      locations: JSON.parse(sub.locations || '[]'),
      job_types: JSON.parse(sub.job_types || '[]')
    }));
  }

  /**
   * 发送职位推荐邮件
   */
  async sendJobRecommendationEmail(subscription, jobs) {
    if (!subscription.email) return;
    
    const emailContent = this.generateEmailTemplate(subscription, jobs);
    
    // 记录发送日志
    await db.run(
      'INSERT INTO notification_logs (subscription_id, type, content, status, sent_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
      [subscription.id, 'email', JSON.stringify({ jobCount: jobs.length }), 'pending']
    );
    
    // TODO: 集成邮件发送服务（如 nodemailer）
    console.log(`📧 邮件推荐已生成: ${subscription.email}, 职位数: ${jobs.length}`);
    
    return { message: '邮件推荐已生成' };
  }

  /**
   * 发送微信通知
   */
  async sendWechatNotification(subscription, jobs) {
    if (!subscription.phone) return;
    
    // TODO: 集成微信模板消息API
    console.log(`📱 微信通知已生成: ${subscription.phone}, 职位数: ${jobs.length}`);
    
    return { message: '微信通知已生成' };
  }

  /**
   * 匹配职位与订阅
   */
  async matchJobsToSubscription(subscription, newJobs) {
    const categories = JSON.parse(subscription.categories || '[]');
    const locations = JSON.parse(subscription.locations || '[]');
    const jobTypes = JSON.parse(subscription.job_types || '[]');
    
    return newJobs.filter(job => {
      // 分类匹配
      const categoryMatch = categories.length === 0 || categories.includes(job.category);
      
      // 地点匹配
      const locationMatch = locations.length === 0 || locations.some(loc => 
        job.location.includes(loc)
      );
      
      // 工作类型匹配
      const typeMatch = jobTypes.length === 0 || jobTypes.includes(job.job_type);
      
      return categoryMatch && locationMatch && typeMatch;
    });
  }

  /**
   * 执行每日推荐任务
   */
  async sendDailyRecommendations() {
    console.log('🚀 开始执行每日职位推荐...');
    
    // 获取过去24小时的新职位
    const newJobs = await db.query(
      `SELECT * FROM jobs 
       WHERE status = 'active' 
       AND is_verified = 1
       AND datetime(crawl_date) >= datetime('now', '-1 day')
       ORDER BY crawl_date DESC`
    );
    
    if (newJobs.length === 0) {
      console.log('📭 今日无新职位，跳过推荐');
      return { sent: 0, message: '今日无新职位' };
    }
    
    console.log(`📊 今日新职位: ${newJobs.length} 条`);
    
    // 获取所有活跃订阅
    const subscriptions = await this.getSubscriptions(1, 1000);
    let sentCount = 0;
    
    for (const subscription of subscriptions) {
      try {
        // 匹配符合条件的职位
        const matchedJobs = await this.matchJobsToSubscription(subscription, newJobs);
        
        if (matchedJobs.length === 0) continue;
        
        // 根据通知类型发送
        if (subscription.notify_type === 'email' && subscription.email) {
          await this.sendJobRecommendationEmail(subscription, matchedJobs);
          sentCount++;
        } else if (subscription.notify_type === 'wechat' && subscription.phone) {
          await this.sendWechatNotification(subscription, matchedJobs);
          sentCount++;
        }
        
      } catch (error) {
        console.error(`❌ 发送推荐失败: ${subscription.id}`, error.message);
      }
    }
    
    console.log(`✅ 每日推荐完成: 发送给 ${sentCount} 位订阅者`);
    return { sent: sentCount, newJobs: newJobs.length };
  }

  /**
   * 生成邮件模板
   */
  generateEmailTemplate(subscription, jobs) {
    const categoryNames = {
      'ai_engineer': 'AI工程师',
      'data_engineer': '数据工程师',
      'data_analyst': '数据分析师',
      'python_dev': 'Python开发'
    };
    
    const jobsList = jobs.map(job => `
      <div style="margin: 15px 0; padding: 15px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h3 style="margin: 0 0 10px 0; color: #667eea;">${job.title}</h3>
        <p style="margin: 5px 0; color: #666;">
          <strong>公司:</strong> ${job.company} | 
          <strong>地点:</strong> ${job.location} | 
          <strong>薪资:</strong> ${job.salary}
        </p>
        <p style="margin: 5px 0; color: #999; font-size: 12px;">
          分类: ${categoryNames[job.category] || job.category} | 
          类型: ${job.job_type}
        </p>
        <p style="margin: 10px 0; color: #333;">${job.description?.substring(0, 100)}...</p>
        ${job.source_url ? `<a href="${job.source_url}" style="color: #667eea;">查看详情</a>` : ''}
      </div>
    `).join('');
    
    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #333; border-bottom: 2px solid #667eea; padding-bottom: 10px;">
          🎓 高职AI就业平台 - 每日职位推荐
        </h1>
        <p style="color: #666;">您好！根据您的订阅偏好，我们为您精选了以下职位：</p>
        ${jobsList}
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #999; font-size: 12px;">
          <p>此邮件由高职AI与大数据就业平台自动发送</p>
          <p>如不想继续接收，请<a href="#">点击取消订阅</a></p>
        </div>
      </div>
    `;
  }

  /**
   * 获取订阅统计
   */
  async getSubscriptionStats() {
    const total = await db.query(
      "SELECT COUNT(*) as count FROM subscriptions WHERE status = 'active'"
    );
    
    const byType = await db.query(
      "SELECT notify_type, COUNT(*) as count FROM subscriptions WHERE status = 'active' GROUP BY notify_type"
    );
    
    const recent = await db.query(
      "SELECT COUNT(*) as count FROM subscriptions WHERE status = 'active' AND datetime(created_at) >= datetime('now', '-7 days')"
    );
    
    return {
      total: total[0].count,
      byType: byType.reduce((acc, item) => ({ ...acc, [item.notify_type]: item.count }), {}),
      recent7Days: recent[0].count
    };
  }
}

module.exports = new SubscriptionService();
