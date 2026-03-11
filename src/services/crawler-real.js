const axios = require('axios');
const cheerio = require('cheerio');
const db = require('../models/database');

/**
 * 真实招聘网站爬虫
 * 支持多源爬取，自动降级处理
 */
class RealJobCrawler {
  constructor() {
    // 请求配置
    this.axiosConfig = {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
      }
    };
    
    // 爬取间隔（毫秒）
    this.delay = 2000;
  }

  /**
   * 主爬取方法
   */
  async crawl() {
    console.log('🚀 开始爬取真实招聘数据...');
    const allJobs = [];
    
    // 尝试多个数据源
    const sources = [
      { name: '51job', method: this.crawl51job.bind(this) },
      { name: 'lagou', method: this.crawlLagou.bind(this) },
      { name: 'shixiseng', method: this.crawlShixiseng.bind(this) }
    ];
    
    for (const source of sources) {
      try {
        console.log(`\n📡 尝试爬取 ${source.name}...`);
        const jobs = await source.method();
        console.log(`✅ ${source.name}: 获取 ${jobs.length} 条职位`);
        allJobs.push(...jobs);
        
        // 间隔等待
        if (source !== sources[sources.length - 1]) {
          await this.sleep(this.delay);
        }
      } catch (error) {
        console.error(`❌ ${source.name} 爬取失败:`, error.message);
      }
    }
    
    console.log(`\n📊 总计获取: ${allJobs.length} 条职位`);
    return allJobs;
  }

  /**
   * 前程无忧51job爬虫
   */
  async crawl51job() {
    const keywords = ['人工智能', '大数据', 'Python', '数据分析师'];
    const jobs = [];
    
    for (const keyword of keywords) {
      try {
        const url = `https://search.51job.com/list/000000,000000,0000,00,9,99,${encodeURIComponent(keyword)},2,1.html`;
        const response = await axios.get(url, this.axiosConfig);
        const $ = cheerio.load(response.data);
        
        // 51job列表项选择器
        $('.j_joblist .e').each((i, elem) => {
          const $el = $(elem);
          const title = $el.find('.jname').text().trim();
          const company = $el.find('.cname').text().trim();
          const location = $el.find('.location').text().trim();
          const salary = $el.find('.salary').text().trim();
          const url = $el.find('.jname a').attr('href');
          
          if (title && company) {
            jobs.push({
              title,
              company,
              location,
              salary,
              description: '', // 需要访问详情页
              requirements: '',
              job_type: '全职',
              source: '前程无忧51job',
              source_url: url || '',
              publish_date: new Date().toISOString().split('T')[0]
            });
          }
        });
        
        await this.sleep(this.delay);
      } catch (error) {
        console.error(`51job关键词"${keyword}"爬取失败:`, error.message);
      }
    }
    
    return jobs;
  }

  /**
   * 拉勾网爬虫
   */
  async crawlLagou() {
    const keywords = ['人工智能', '大数据', 'Python'];
    const jobs = [];
    
    for (const keyword of keywords) {
      try {
        // 拉勾网需要特殊处理，先尝试API
        const url = `https://www.lagou.com/wn/zhaopin?kd=${encodeURIComponent(keyword)}&city=全国`;
        const response = await axios.get(url, {
          ...this.axiosConfig,
          headers: {
            ...this.axiosConfig.headers,
            'Referer': 'https://www.lagou.com/'
          }
        });
        
        const $ = cheerio.load(response.data);
        
        // 拉勾列表选择器
        $('.job-list .job-item').each((i, elem) => {
          const $el = $(elem);
          const title = $el.find('.job-name').text().trim();
          const company = $el.find('.company-name').text().trim();
          const location = $el.find('.job-area').text().trim();
          const salary = $el.find('.salary').text().trim();
          
          if (title && company) {
            jobs.push({
              title,
              company,
              location,
              salary,
              description: '',
              requirements: '',
              job_type: '全职',
              source: '拉勾网',
              source_url: '',
              publish_date: new Date().toISOString().split('T')[0]
            });
          }
        });
        
        await this.sleep(this.delay);
      } catch (error) {
        console.error(`拉勾网关键词"${keyword}"爬取失败:`, error.message);
      }
    }
    
    return jobs;
  }

  /**
   * 实习僧爬虫（面向学生，反爬较弱）
   */
  async crawlShixiseng() {
    const jobs = [];
    
    try {
      // 实习僧搜索AI/大数据相关实习
      const keywords = ['人工智能', '大数据', '数据分析', 'Python'];
      
      for (const keyword of keywords) {
        const url = `https://www.shixiseng.com/interns?page=1&keyword=${encodeURIComponent(keyword)}&type=intern`;
        const response = await axios.get(url, this.axiosConfig);
        const $ = cheerio.load(response.data);
        
        $('.intern-item').each((i, elem) => {
          const $el = $(elem);
          const title = $el.find('.job-name').text().trim();
          const company = $el.find('.company-name').text().trim();
          const location = $el.find('.job-area').text().trim();
          const salary = $el.find('.job-salary').text().trim() || '面议';
          const url = $el.find('.job-name a').attr('href');
          
          if (title && company) {
            jobs.push({
              title,
              company,
              location,
              salary,
              description: '',
              requirements: '',
              job_type: '实习',
              source: '实习僧',
              source_url: url ? `https://www.shixiseng.com${url}` : '',
              publish_date: new Date().toISOString().split('T')[0]
            });
          }
        });
        
        await this.sleep(this.delay);
      }
    } catch (error) {
      console.error('实习僧爬取失败:', error.message);
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
        // 检查重复（标题+公司+来源）
        const existing = await db.query(
          'SELECT id FROM jobs WHERE title = ? AND company = ? AND source = ?',
          [job.title, job.company, job.source]
        );
        
        if (existing.length > 0) {
          duplicates.push(job);
          continue;
        }
        
        // 自动分类
        const category = this.categorizeJob(job.title, job.description);
        
        const result = await db.run(
          `INSERT INTO jobs (title, company, location, salary, description, requirements, 
           job_type, category, source, source_url, publish_date, is_verified) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [job.title, job.company, job.location, job.salary, job.description, 
           job.requirements, job.job_type, category, job.source, job.source_url, 
           job.publish_date, 0] // 爬虫数据默认未验证
        );
        
        saved.push({ ...job, id: result.id, category });
      } catch (error) {
        console.error('保存职位失败:', error.message);
      }
    }
    
    console.log(`💾 保存结果: ${saved.length} 条新数据, ${duplicates.length} 条重复`);
    return { saved, duplicates };
  }

  /**
   * 职位分类
   */
  categorizeJob(title, description = '') {
    const text = (title + ' ' + description).toLowerCase();
    
    const categories = {
      'ai_engineer': ['人工智能', 'ai', '算法', '机器学习', '深度学习', 'nlp', 'cv', '计算机视觉', '大模型'],
      'data_engineer': ['大数据', '数据工程师', 'etl', '数据仓库', 'hadoop', 'spark', 'flink'],
      'data_analyst': ['数据分析', '数据分析师', 'bi', '商业分析', '数据挖掘'],
      'python_dev': ['python', 'python开发', '爬虫', '后端开发'],
      'other': []
    };

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(kw => text.includes(kw.toLowerCase()))) {
        return category;
      }
    }
    return 'other';
  }

  /**
   * 延迟函数
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new RealJobCrawler();
