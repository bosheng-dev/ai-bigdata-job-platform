const axios = require('axios');
const cheerio = require('cheerio');
const db = require('../models/database');

class JobCrawler {
  constructor() {
    this.sources = [
      {
        name: '51job',
        baseUrl: 'https://search.51job.com',
        searchPath: '/list/000000,000000,0000,00,9,99,{keyword},2,1.html'
      },
      {
        name: 'zhilian',
        baseUrl: 'https://sou.zhaopin.com',
        searchPath: '/?jl=538&kw={keyword}&p=1'
      }
    ];
  }

  // 计算发布日期是否在有效期内（默认30天）
  isValidDate(dateStr, maxDays = 30) {
    if (!dateStr) return false;
    const publishDate = new Date(dateStr);
    const now = new Date();
    const diffDays = (now - publishDate) / (1000 * 60 * 60 * 24);
    return diffDays <= maxDays;
  }

  // 分类岗位
  categorizeJob(title, description = '') {
    const text = (title + ' ' + description).toLowerCase();
    
    const categories = {
      'ai_engineer': ['人工智能', 'ai工程师', '算法工程师', '机器学习', '深度学习', 'nlp', 'cv', '计算机视觉'],
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

  // 模拟数据（真实环境需要实际爬虫逻辑）
  async fetchMockJobs() {
    const mockJobs = [
      {
        title: 'AI算法工程师',
        company: '华为技术有限公司',
        location: '深圳',
        salary: '15-25K',
        description: '负责人工智能算法研发，包括机器学习、深度学习模型设计与优化',
        requirements: '本科及以上学历，计算机相关专业，熟悉Python、TensorFlow/PyTorch',
        job_type: '全职',
        source: '模拟数据源-华为招聘',
        source_url: 'https://career.huawei.com',
        publish_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      },
      {
        title: '大数据开发工程师',
        company: '腾讯科技',
        location: '广州',
        salary: '12-20K',
        description: '负责大数据平台开发，数据ETL流程设计与优化',
        requirements: '熟悉Hadoop生态、Spark、Kafka，有大数据项目经验',
        job_type: '全职',
        source: '模拟数据源-腾讯招聘',
        source_url: 'https://careers.tencent.com',
        publish_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      },
      {
        title: 'Python数据分析师',
        company: '字节跳动',
        location: '北京',
        salary: '10-18K',
        description: '负责业务数据分析，构建数据报表与可视化',
        requirements: '熟练使用Python数据分析工具链，SQL功底扎实',
        job_type: '全职',
        source: '模拟数据源-字节招聘',
        source_url: 'https://jobs.bytedance.com',
        publish_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      },
      {
        title: '机器学习工程师',
        company: '阿里巴巴',
        location: '杭州',
        salary: '18-30K',
        description: '参与推荐系统、搜索算法的研发与优化',
        requirements: '计算机相关专业，熟悉常见机器学习算法',
        job_type: '全职',
        source: '模拟数据源-阿里招聘',
        source_url: 'https://talent.alibaba.com',
        publish_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      },
      {
        title: '数据仓库工程师',
        company: '美团',
        location: '北京',
        salary: '14-22K',
        description: '负责数据仓库架构设计与开发',
        requirements: '熟悉数据仓库理论，有Hive、Spark开发经验',
        job_type: '全职',
        source: '模拟数据源-美团招聘',
        source_url: 'https://zhaopin.meituan.com',
        publish_date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      }
    ];

    return mockJobs.filter(job => this.isValidDate(job.publish_date));
  }

  async saveJobs(jobs) {
    const saved = [];
    for (const job of jobs) {
      const category = this.categorizeJob(job.title, job.description);
      
      // 检查是否已存在（根据标题+公司+来源）
      const existing = await db.query(
        'SELECT id FROM jobs WHERE title = ? AND company = ? AND source = ?',
        [job.title, job.company, job.source]
      );

      if (existing.length === 0) {
        const result = await db.run(
          `INSERT INTO jobs (title, company, location, salary, description, requirements, 
           job_type, category, source, source_url, publish_date, is_verified) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [job.title, job.company, job.location, job.salary, job.description, 
           job.requirements, job.job_type, category, job.source, job.source_url, 
           job.publish_date, 1]
        );
        saved.push({ ...job, id: result.id, category });
      }
    }
    return saved;
  }

  async crawl() {
    console.log('开始抓取职位数据...');
    const jobs = await this.fetchMockJobs();
    const saved = await this.saveJobs(jobs);
    console.log(`抓取完成，新增 ${saved.length} 条职位`);
    return saved;
  }
}

module.exports = new JobCrawler();
