const puppeteer = require('puppeteer');
const db = require('../models/database');

/**
 * Puppeteer爬虫
 * 用于处理动态渲染的招聘网站
 */
class PuppeteerCrawler {
  constructor() {
    this.browser = null;
    this.delay = 3000; // 页面间延迟
  }

  /**
   * 初始化浏览器
   */
  async init() {
    if (!this.browser) {
      console.log('🚀 启动 Puppeteer...');
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920,1080'
        ]
      });
    }
    return this.browser;
  }

  /**
   * 关闭浏览器
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      console.log('🛑 Puppeteer 已关闭');
    }
  }

  /**
   * 主爬取方法
   */
  async crawl() {
    console.log('🌐 开始 Puppeteer 爬取...');
    const allJobs = [];
    
    try {
      await this.init();
      
      // 爬取51job
      const jobs51 = await this.crawl51job();
      allJobs.push(...jobs51);
      
      // 爬取拉勾
      await this.sleep(this.delay);
      const jobsLagou = await this.crawlLagou();
      allJobs.push(...jobsLagou);
      
    } catch (error) {
      console.error('Puppeteer 爬取失败:', error.message);
    } finally {
      await this.close();
    }
    
    console.log(`📊 Puppeteer 总计: ${allJobs.length} 条`);
    return allJobs;
  }

  /**
   * 爬取51job
   */
  async crawl51job() {
    const jobs = [];
    const keywords = ['人工智能', '大数据', 'Python'];
    
    for (const keyword of keywords) {
      try {
        console.log(`🔍 51job 搜索: ${keyword}`);
        const page = await this.browser.newPage();
        
        // 设置UA
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        
        // 访问搜索页
        const url = `https://we.51job.com/pc/search?keyword=${encodeURIComponent(keyword)}&searchType=2`;
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        
        // 等待职位列表加载
        await page.waitForSelector('.joblist-item', { timeout: 10000 });
        
        // 提取数据
        const pageJobs = await page.evaluate(() => {
          const items = document.querySelectorAll('.joblist-item');
          return Array.from(items).slice(0, 10).map(item => {
            const title = item.querySelector('.joblist-item-title')?.textContent?.trim() || '';
            const company = item.querySelector('.joblist-item-company')?.textContent?.trim() || '';
            const location = item.querySelector('.joblist-item-area')?.textContent?.trim() || '';
            const salary = item.querySelector('.joblist-item-salary')?.textContent?.trim() || '';
            const url = item.querySelector('a')?.href || '';
            
            return { title, company, location, salary, url };
          }).filter(j => j.title && j.company);
        });
        
        pageJobs.forEach(job => {
          jobs.push({
            title: job.title,
            company: job.company,
            location: job.location,
            salary: job.salary,
            description: '',
            requirements: '',
            job_type: '全职',
            source: '前程无忧51job',
            source_url: job.url,
            publish_date: new Date().toISOString().split('T')[0]
          });
        });
        
        await page.close();
        console.log(`✅ 51job "${keyword}": ${pageJobs.length} 条`);
        
        await this.sleep(this.delay);
      } catch (error) {
        console.error(`❌ 51job "${keyword}" 失败:`, error.message);
      }
    }
    
    return jobs;
  }

  /**
   * 爬取拉勾网
   */
  async crawlLagou() {
    const jobs = [];
    const keywords = ['人工智能', '大数据'];
    
    for (const keyword of keywords) {
      try {
        console.log(`🔍 拉勾搜索: ${keyword}`);
        const page = await this.browser.newPage();
        
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        
        const url = `https://www.lagou.com/wn/zhaopin?kd=${encodeURIComponent(keyword)}`;
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        
        // 等待列表加载
        await page.waitForSelector('.job-list .job-item', { timeout: 10000 });
        
        const pageJobs = await page.evaluate(() => {
          const items = document.querySelectorAll('.job-list .job-item');
          return Array.from(items).slice(0, 10).map(item => {
            const title = item.querySelector('.job-name')?.textContent?.trim() || '';
            const company = item.querySelector('.company-name')?.textContent?.trim() || '';
            const location = item.querySelector('.job-area')?.textContent?.trim() || '';
            const salary = item.querySelector('.salary')?.textContent?.trim() || '';
            const url = item.querySelector('a')?.href || '';
            
            return { title, company, location, salary, url };
          }).filter(j => j.title && j.company);
        });
        
        pageJobs.forEach(job => {
          jobs.push({
            title: job.title,
            company: job.company,
            location: job.location,
            salary: job.salary,
            description: '',
            requirements: '',
            job_type: '全职',
            source: '拉勾网',
            source_url: job.url,
            publish_date: new Date().toISOString().split('T')[0]
          });
        });
        
        await page.close();
        console.log(`✅ 拉勾 "${keyword}": ${pageJobs.length} 条`);
        
        await this.sleep(this.delay);
      } catch (error) {
        console.error(`❌ 拉勾 "${keyword}" 失败:`, error.message);
      }
    }
    
    return jobs;
  }

  /**
   * 保存职位到数据库
   */
  async saveJobs(jobs) {
    const saved = [];
    const duplicates = [];
    
    for (const job of jobs) {
      try {
        // 检查重复
        const existing = await db.query(
          'SELECT id FROM jobs WHERE title = ? AND company = ? AND source = ?',
          [job.title, job.company, job.source]
        );
        
        if (existing.length > 0) {
          duplicates.push(job);
          continue;
        }
        
        // 自动分类
        const category = this.categorizeJob(job.title);
        
        const result = await db.run(
          `INSERT INTO jobs (title, company, location, salary, description, requirements, 
           job_type, category, source, source_url, publish_date, is_verified) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [job.title, job.company, job.location, job.salary, job.description, 
           job.requirements, job.job_type, category, job.source, job.source_url, 
           job.publish_date, 0]
        );
        
        saved.push({ ...job, id: result.id, category });
      } catch (error) {
        console.error('保存失败:', error.message);
      }
    }
    
    console.log(`💾 保存: ${saved.length} 条新数据, ${duplicates.length} 条重复`);
    return { saved, duplicates };
  }

  /**
   * 职位分类
   */
  categorizeJob(title) {
    const text = title.toLowerCase();
    
    if (text.includes('人工智能') || text.includes('ai') || text.includes('算法') || 
        text.includes('机器学习') || text.includes('深度学习')) {
      return 'ai_engineer';
    }
    if (text.includes('大数据') || text.includes('数据工程师') || text.includes('etl')) {
      return 'data_engineer';
    }
    if (text.includes('数据分析') || text.includes('数据分析师')) {
      return 'data_analyst';
    }
    if (text.includes('python')) {
      return 'python_dev';
    }
    return 'other';
  }

  /**
   * 延迟
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new PuppeteerCrawler();
