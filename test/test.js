const assert = require('assert');
const crawler = require('../src/services/crawler');

console.log('🧪 运行测试...\n');

// 测试日期验证
console.log('测试1: 日期有效性检查');
assert.strictEqual(crawler.isValidDate('2024-03-01', 30), false, '超过30天的日期应无效');
assert.strictEqual(crawler.isValidDate(new Date().toISOString().split('T')[0], 30), true, '今天的日期应有效');
console.log('✅ 通过\n');

// 测试分类功能
console.log('测试2: 职位分类');
assert.strictEqual(crawler.categorizeJob('AI算法工程师'), 'ai_engineer');
assert.strictEqual(crawler.categorizeJob('大数据开发'), 'data_engineer');
assert.strictEqual(crawler.categorizeJob('数据分析师'), 'data_analyst');
assert.strictEqual(crawler.categorizeJob('Python开发工程师'), 'python_dev');
console.log('✅ 通过\n');

console.log('🎉 所有测试通过！');
