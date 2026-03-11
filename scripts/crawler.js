#!/usr/bin/env node

const crawler = require('../src/services/crawler');

async function main() {
  console.log('🚀 开始抓取职位数据...');
  console.log('⏰', new Date().toLocaleString('zh-CN'));
  
  try {
    const jobs = await crawler.crawl();
    console.log('\n✅ 抓取完成！');
    console.log(`📊 新增职位: ${jobs.length} 条`);
    
    if (jobs.length > 0) {
      console.log('\n📋 职位列表:');
      jobs.forEach((job, i) => {
        console.log(`  ${i + 1}. ${job.title} @ ${job.company}`);
      });
    }
  } catch (error) {
    console.error('❌ 抓取失败:', error.message);
    process.exit(1);
  }
}

main();
