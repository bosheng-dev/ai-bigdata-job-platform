const cron = require('node-cron');
const crawler = require('./crawler');
const realCrawler = require('./crawler-real');
const puppeteerCrawler = require('./crawler-puppeteer');
const db = require('../models/database');

/**
 * 数据更新调度器
 * 负责定时抓取、数据清理、状态维护
 */
class Scheduler {
  constructor() {
    this.tasks = [];
    this.isRunning = false;
  }

  /**
   * 启动所有定时任务
   */
  start() {
    if (this.isRunning) {
      console.log('调度器已在运行');
      return;
    }

    console.log('🕐 启动数据更新调度器...');

    // 任务1: 每天凌晨2点抓取新数据
    const crawlTask = cron.schedule('0 2 * * *', async () => {
      console.log('⏰ 执行定时抓取任务:', new Date().toLocaleString('zh-CN'));
      await this.runCrawlJob();
    }, {
      scheduled: true,
      timezone: 'Asia/Shanghai'
    });
    this.tasks.push(crawlTask);

    // 任务2: 每天凌晨3点清理过期数据（30天前的职位标记为过期）
    const cleanupTask = cron.schedule('0 3 * * *', async () => {
      console.log('🧹 执行数据清理任务:', new Date().toLocaleString('zh-CN'));
      await this.runCleanupJob();
    }, {
      scheduled: true,
      timezone: 'Asia/Shanghai'
    });
    this.tasks.push(cleanupTask);

    // 任务3: 每小时更新统计信息
    const statsTask = cron.schedule('0 * * * *', async () => {
      await this.updateStats();
    }, {
      scheduled: true,
      timezone: 'Asia/Shanghai'
    });
    this.tasks.push(statsTask);

    // 任务4: 每天上午9点发送职位推荐
    const subscriptionService = require('./subscription');
    const notifyTask = cron.schedule('0 9 * * *', async () => {
      console.log('📧 执行每日职位推荐:', new Date().toLocaleString('zh-CN'));
      try {
        await subscriptionService.sendDailyRecommendations();
      } catch (error) {
        console.error('❌ 每日推荐失败:', error.message);
      }
    }, {
      scheduled: true,
      timezone: 'Asia/Shanghai'
    });
    this.tasks.push(notifyTask);

    this.isRunning = true;
    console.log('✅ 调度器已启动，任务列表:');
    console.log('   - 每日 02:00 自动抓取职位数据');
    console.log('   - 每日 03:00 清理过期职位');
    console.log('   - 每日 09:00 发送职位推荐');
    console.log('   - 每小时更新统计数据');
  }

  /**
   * 停止所有定时任务
   */
  stop() {
    this.tasks.forEach(task => task.stop());
    this.tasks = [];
    this.isRunning = false;
    console.log('🛑 调度器已停止');
  }

  /**
   * 执行抓取任务（三层降级：Puppeteer → HTTP爬虫 → 模拟数据）
   */
  async runCrawlJob() {
    const startTime = Date.now();
    
    // 第一层：Puppeteer爬虫（处理动态页面）
    try {
      console.log('🌐 尝试 Puppeteer 爬取...');
      const jobs = await puppeteerCrawler.crawl();
      
      if (jobs.length > 0) {
        const { saved, duplicates } = await puppeteerCrawler.saveJobs(jobs);
        const duration = Date.now() - startTime;
        
        await this.logCrawlResult({
          status: 'success',
          source: 'puppeteer',
          crawled: jobs.length,
          saved: saved.length,
          duplicates: duplicates.length,
          duration: duration,
          timestamp: new Date().toISOString()
        });

        console.log(`✅ Puppeteer 完成: ${jobs.length} 条，保存 ${saved.length} 条`);
        return saved;
      }
      console.log('⚠️ Puppeteer 未获取数据，尝试 HTTP 爬虫...');
    } catch (error) {
      console.error('❌ Puppeteer 失败:', error.message);
    }
    
    // 第二层：HTTP爬虫
    try {
      console.log('🌐 尝试 HTTP 爬虫...');
      const jobs = await realCrawler.crawl();
      
      if (jobs.length > 0) {
        const { saved, duplicates } = await realCrawler.saveJobs(jobs);
        const duration = Date.now() - startTime;
        
        await this.logCrawlResult({
          status: 'success',
          source: 'http',
          crawled: jobs.length,
          saved: saved.length,
          duplicates: duplicates.length,
          duration: duration,
          timestamp: new Date().toISOString()
        });

        console.log(`✅ HTTP 爬虫完成: ${jobs.length} 条，保存 ${saved.length} 条`);
        return saved;
      }
      console.log('⚠️ HTTP 爬虫未获取数据，回退到模拟数据...');
    } catch (error) {
      console.error('❌ HTTP 爬虫失败:', error.message);
    }
    
    // 第三层：模拟数据
    try {
      const jobs = await crawler.crawl();
      const duration = Date.now() - startTime;
      
      await this.logCrawlResult({
        status: 'fallback',
        source: 'mock',
        newJobs: jobs.length,
        duration: duration,
        timestamp: new Date().toISOString()
      });

      console.log(`⚠️ 回退到模拟数据: ${jobs.length} 条`);
      return jobs;
    } catch (error) {
      await this.logCrawlResult({
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      });
      console.error('❌ 所有爬虫失败:', error.message);
      throw error;
    }
  }

  /**
   * 执行清理任务
     */
  async runCleanupJob() {
    try {
      // 标记30天前的职位为过期
      const result = await db.run(
        `UPDATE jobs 
         SET status = 'expired' 
         WHERE publish_date < date('now', '-30 days') 
         AND status = 'active'`
      );

      // 删除60天前的过期职位（硬删除）
      const deleteResult = await db.run(
        `DELETE FROM jobs 
         WHERE publish_date < date('now', '-60 days')`
      );

      console.log(`🧹 清理完成: ${result.changes} 条标记过期, ${deleteResult.changes} 条永久删除`);
      
      return {
        expired: result.changes,
        deleted: deleteResult.changes
      };
    } catch (error) {
      console.error('❌ 清理失败:', error.message);
      throw error;
    }
  }

  /**
   * 更新统计信息
   */
  async updateStats() {
    try {
      const stats = await db.query(`
        SELECT 
          COUNT(*) as total_jobs,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_jobs,
          COUNT(DISTINCT category) as categories,
          COUNT(DISTINCT source) as sources
        FROM jobs
      `);
      
      // 可以存储到缓存或单独的统计表
      console.log('📊 统计更新:', stats[0]);
      return stats[0];
    } catch (error) {
      console.error('❌ 统计更新失败:', error.message);
    }
  }

  /**
   * 记录抓取日志
   */
  async logCrawlResult(log) {
    // 简单实现：写入控制台，可扩展为写入数据库或文件
    console.log('📝 抓取日志:', JSON.stringify(log));
  }

  /**
   * 获取调度器状态
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      taskCount: this.tasks.length,
      tasks: [
        { name: 'crawl', schedule: '0 2 * * *', description: '每日抓取' },
        { name: 'cleanup', schedule: '0 3 * * *', description: '每日清理' },
        { name: 'notify', schedule: '0 9 * * *', description: '每日推荐' },
        { name: 'stats', schedule: '0 * * * *', description: '每小时统计' }
      ]
    };
  }
}

module.exports = new Scheduler();
