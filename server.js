const express = require('express');
const path = require('path');
const cron = require('node-cron');
const crawler = require('./src/services/crawler');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 路由
app.use('/api/jobs', require('./src/routes/jobs'));

// 首页
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 手动触发爬虫（管理员接口）
app.post('/api/admin/crawl', async (req, res) => {
  try {
    const jobs = await crawler.crawl();
    res.json({ success: true, message: `成功抓取 ${jobs.length} 条职位`, data: jobs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 定时任务：每天凌晨2点自动抓取
// cron.schedule('0 2 * * *', async () => {
//   console.log('执行定时抓取任务...');
//   try {
//     await crawler.crawl();
//   } catch (error) {
//     console.error('定时抓取失败:', error);
//   }
// });

app.listen(PORT, () => {
  console.log(`🚀 就业资讯平台已启动`);
  console.log(`📍 访问地址: http://localhost:${PORT}`);
  console.log(`🦞 为高职AI与大数据专业学生提供可靠就业信息`);
});

module.exports = app;
