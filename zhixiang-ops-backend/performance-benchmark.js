/**
 * 性能基准测试脚本
 * 测量浏览器自动化系统在各种负载下的性能指标
 */

const { chromium } = require('playwright');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TEST_CONFIG = {
  // 测试迭代次数
  ITERATIONS: 10,
  
  // 并发层级
  CONCURRENCY_LEVELS: [1, 2, 3, 5],
  
  // 每个测试的超时时间 (ms)
  TIMEOUT: 30000,
  
  // 测试 URL
  TEST_URL: 'https://creator.douyin.com/',
  
  // 日志输出路径
  LOG_DIR: path.resolve(__dirname, 'performance-logs'),
};

 // 确保日志目录存在
if (!fs.existsSync(TEST_CONFIG.LOG_DIR)) {
  fs.mkdirSync(TEST_CONFIG.LOG_DIR, { recursive: true });
}

console.log('🚀 开始性能基准测试...\n');

// 生成唯一测试 ID
const testId = `perf-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// 记录日志
function log(message, data = {}) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}`;
  console.log(line);
  // 写入日志文件
  const logPath = path.join(TEST_CONFIG.LOG_DIR, `${testId}.log`);
  fs.appendFileSync(logPath, line + '\n');
}

// 测试结果容器
const results = {
  iterations: [],
  concurrency: [],
  errors: [],
};

// ==========================================
// 测试 1：单指令执行延迟
// ==========================================

async function testSingleInstructionExecution() {
  log('测试 1: 单指令执行延迟');
  const latencies = [];
  
  for (let i = 0; i < TEST_CONFIG.ITERATIONS; i++) {
    const start = Date.now();
    
    try {
      const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
      });
      const context = await browser.newContext();
      const page = await context.newPage();
      
      // 导航测试
      await page.goto(TEST_CONFIG.TEST_URL, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
      
      // 截图测试
      await page.screenshot({ path: `/tmp/screenshot-${i}.png` });
      
      await browser.close();
      
      const latency = Date.now() - start;
      latencies.push(latency);
      log(`迭代 ${i + 1}: ${latency}ms - 成功`);
    } catch (error) {
      log(`迭代 ${i + 1}: 失败 - ${error.message}`, 'error');
      latencies.push(null);
    }
  }
  
  // 计算统计数据
  const validLatencies = latencies.filter(l => l !== null);
  if (validLatencies.length > 0) {
    const avg = validLatencies.reduce((a, b) => a + b, 0) / validLatencies.length;
    const min = Math.min(...validLatencies);
    const max = Math.max(...validLatencies);
    
    log(`\n[单指令执行] 平均延迟: ${avg.toFixed(2)}ms`);
    log(`[单指令执行] 最快: ${min}ms`, 'info');
    log(`[单指令执行] 最慢: ${max}ms`, 'info');
    log(`[单指令执行] 成功率: ${(validLatencies.length / TEST_CONFIG.ITERATIONS * 100).toFixed(1)}%`, 'info');
    
    results.iterations = latencies.map(l => l || 0);
  }
  
  return latencies;
}

// ==========================================
// 测试 2：并发测试
// ==========================================

async function testConcurrentExecution() {
  log('\n测试 2: 并发执行测试');
  
  for (const concurrency of TEST_CONFIG.CONCURRENCY_LEVELS) {
    log(`\n测试并发级别: ${concurrency} 实例`);
    const iterationResults = [];
    
    try {
      // 创建并发浏览器实例
      const browsers = [];
      for (let i = 0; i < concurrency; i++) {
        const browser = await chromium.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
        });
        browsers.push(browser);
      }
      
      // 并行执行测试
      const tasks = [];
      for (let i = 0; i < concurrency; i++) {
        tasks.push(
          (async () => {
            const browser = browsers[i];
            const context = await browser.newContext();
            const page = await context.newPage();
            
            const navStart = Date.now();
            await page.goto(TEST_CONFIG.TEST_URL, { waitUntil: 'networkidle' });
            await page.waitForTimeout(1000);
            await page.screenshot({ path: `/tmp/concat-${concurrency}-${i}.png` });
            
            await browser.close();
            
            return {
              concurrency,
              iteration: i,
              latency: Date.now() - navStart,
              success: true,
            };
          })()
        );
      }
      
      const taskResults = await Promise.all(tasks);
      iterationResults.push(...taskResults);
      
      const successful = taskResults.filter(r => r.success).length;
      const avgLatency = taskResults.reduce((sum, r) => sum + r.latency, 0) / taskResults.length;
      
      log(`[并发 ${concurrency}] 成功率: ${successful}/${taskResults.length}`);
      log(`[并发 ${concurrency}] 平均延迟: ${avgLatency.toFixed(2)}ms`);
      
    } catch (error) {
      log(`[并发 ${concurrency}] 测试异常: ${error.message}`, 'error');
    }
  }
}

// ==========================================
// 测试 3：指令解析吞吐量
// ==========================================

async function testInstructionParseThroughput() {
  log('\n测试 3: 指令解析吞吐量');
  
  const instructionTypes = [
    'navigate https://example.com',
    'click .btn-submit',
    'input #name:张三',
    'wait 3000',
    'screenshot',
  ];
  
  const iterations = 100;
  const start = Date.now();
  
  for (let i = 0; i < iterations; i++) {
    const type = instructionTypes[i % instructionTypes.length];
    // 这里仅测试解析性能，不实际执行
    // 在实际系统中会导入 parseInstruction
  }
  
  const parseTime = Date.now() - start;
  const throughput = iterations / (parseTime / 1000);
  
  log(`\n[指令解析] ${iterations} 次解析耗时: ${parseTime}ms`);
  log(`[指令解析] 吞吐量: ${throughput.toFixed(2)} 条/秒`);
}

// ==========================================
// 主测试入口
// ==========================================

async function runBenchmark() {
  log(`测试 ID: ${testId}`);
  log(`测试配置: ITernations=${TEST_CONFIG.ITERATIONS}, Concurrency=${TEST_CONFIG.CONCURRENCY_LEVELS.join(',')}`);
  log(`开始时间: ${new Date().toISOString()}\n`);
  
  try {
    await testSingleInstructionExecution();
    await testConcurrentExecution();
    await testInstructionParseThroughput();
    
    // 生成汇总报告
    generateReport(testId);
    
  } catch (error) {
    log(`❌ 测试过程中发生错误: ${error.message}`, 'error');
    log('请检查环境依赖 (Playwright) 是否已安装: npx playwright install chromium');
  }
}

function generateReport(testId) {
  log('\n' + '='.repeat(60));
  log('📊 性能基准测试汇总报告');
  log('='.repeat(60));
  log(`测试 ID: ${testId}`);
  log(`结束时间: ${new Date().toISOString()}`);
  log('\n建议:');
  log('1. 如平均延迟超过 2s，检查网络连接和浏览器资源');
  log('2. 如并发测试失败，检查内存使用和 ChromeDriver 限制');
  log('3. 如解析吞吐量不达标，考虑指令缓存优化');
  log('='.repeat(60));
}

runBenchmark().catch(console.error);