/**
 * 邮件服务
 * 基于 nodemailer 的邮件发送功能
 */

const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.isConfigured = false;
    
    // 检查邮件配置
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      this.initTransporter();
    } else {
      console.log('⚠️ 邮件服务未配置，请设置 SMTP_HOST, SMTP_USER, SMTP_PASS 环境变量');
    }
  }

  /**
   * 初始化邮件传输器
   */
  initTransporter() {
    try {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        },
        // QQ邮箱等需要特殊配置
        tls: {
          rejectUnauthorized: false
        }
      });
      
      this.isConfigured = true;
      console.log('✅ 邮件服务已配置');
    } catch (error) {
      console.error('❌ 邮件服务配置失败:', error.message);
    }
  }

  /**
   * 验证邮件配置
   */
  async verify() {
    if (!this.isConfigured) {
      return { success: false, error: '邮件服务未配置' };
    }
    
    try {
      await this.transporter.verify();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 发送邮件
   */
  async send(to, subject, html, text = null) {
    if (!this.isConfigured) {
      console.log('⚠️ 邮件服务未配置，跳过发送');
      return { success: false, error: '邮件服务未配置' };
    }
    
    try {
      const info = await this.transporter.sendMail({
        from: `"高职AI就业平台" <${process.env.SMTP_USER}>`,
        to,
        subject,
        text: text || html.replace(/<[^>]*>/g, ''),
        html
      });
      
      console.log(`✅ 邮件已发送: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ 邮件发送失败:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 发送职位推荐邮件
   */
  async sendJobRecommendation(to, jobs, preferences = {}) {
    const subject = `🎓 今日职位推荐 - ${jobs.length} 个新职位等您查看`;
    const html = this.generateJobEmailTemplate(jobs, preferences);
    
    return this.send(to, subject, html);
  }

  /**
   * 发送订阅确认邮件
   */
  async sendSubscriptionConfirmation(to, preferences = {}) {
    const subject = '✅ 订阅成功 - 高职AI就业平台';
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #667eea; border-bottom: 2px solid #667eea; padding-bottom: 10px;">
          🎉 订阅成功！
        </h1>
        <p style="color: #333; font-size: 16px; line-height: 1.6;">
          您好！感谢您订阅高职AI与大数据就业平台。
        </p>
        <p style="color: #666; font-size: 14px; line-height: 1.6;">
          我们将于每天上午9点为您推送最新职位信息。
        </p>
        ${preferences.categories ? `
        <p style="color: #666; font-size: 14px;">
          <strong>关注分类：</strong>${preferences.categories.join(', ')}<br>
          ${preferences.locations ? `<strong>期望城市：</strong>${preferences.locations.join(', ')}<br>` : ''}
          ${preferences.jobTypes ? `<strong>工作类型：</strong>${preferences.jobTypes.join(', ')}` : ''}
        </p>
        ` : ''}
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #999; font-size: 12px;">
          <p>如需取消订阅，请回复本邮件或访问平台设置</p>
          <p>高职AI与大数据就业平台</p>
        </div>
      </div>
    `;
    
    return this.send(to, subject, html);
  }

  /**
   * 生成职位推荐邮件模板
   */
  generateJobEmailTemplate(jobs, preferences = {}) {
    const categoryNames = {
      'ai_engineer': 'AI工程师',
      'data_engineer': '数据工程师',
      'data_analyst': '数据分析师',
      'python_dev': 'Python开发'
    };
    
    const jobsList = jobs.map(job => `
      <div style="margin: 15px 0; padding: 15px; border: 1px solid #e0e0e0; border-radius: 8px; background: #fafafa;">
        <h3 style="margin: 0 0 10px 0; color: #667eea;">${job.title}</h3>
        <p style="margin: 5px 0; color: #666;">
          <strong>公司：</strong>${job.company} | 
          <strong>地点：</strong>${job.location} | 
          <strong>薪资：</strong>${job.salary || '面议'}
        </p>
        <p style="margin: 5px 0; color: #999; font-size: 12px;">
          分类：${categoryNames[job.category] || job.category} | 
          类型：${job.job_type}
        </p>
        <p style="margin: 10px 0; color: #333; font-size: 14px;">
          ${job.description ? job.description.substring(0, 100) + '...' : '暂无描述'}
        </p>
        ${job.source_url ? `<a href="${job.source_url}" style="color: #667eea; text-decoration: none;">查看详情 →</a>` : ''}
      </div>
    `).join('');
    
    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #333; border-bottom: 2px solid #667eea; padding-bottom: 10px;">
          🎓 高职AI就业平台 - 每日职位推荐
        </h1>
        <p style="color: #666;">您好！根据您的订阅偏好，我们为您精选了 ${jobs.length} 个新职位：</p>
        ${jobsList}
        <div style="margin-top: 30px; padding: 20px; background: #f5f7fa; border-radius: 8px; text-align: center;">
          <a href="#" style="display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 6px;">查看更多职位</a>
        </div>
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #999; font-size: 12px; text-align: center;">
          <p>此邮件由高职AI与大数据就业平台自动发送</p>
          <p>如不想继续接收，请 <a href="#" style="color: #667eea;">点击取消订阅</a></p>
        </div>
      </div>
    `;
  }
}

module.exports = new EmailService();
