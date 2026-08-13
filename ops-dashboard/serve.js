/**
 * 智享全链统一门户本地服务器（零依赖）。
 * - `/`             → 统一门户（portal.html，登录 + 双域聚合）
 * - `/dashboard`    → 运营决策看板（index.html + plotly）
 * - `/api/*`        → 反向代理到运营系统后端（默认 127.0.0.1:3100）
 * - `/ms-api/*`     → 反向代理到管理系统 API（默认 https://api.onepan.cn/api，去掉 /ms-api 前缀）
 * - `/ops-app/*`    → 静态托管运营前端构建产物（zhixiang-ops-frontend/dist，SPA fallback）
 *
 * 用法：node serve.js   →  浏览器打开 http://localhost:8080
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const ROOT = __dirname;
const BACKEND = process.env.BACKEND_URL || 'http://127.0.0.1:3100';
const argv = process.argv.slice(2);
const msArg = argv.indexOf('--ms-api');
const MS_API = (
  msArg >= 0 ? argv[msArg + 1] : process.env.MS_API_TARGET || 'https://api.onepan.cn/api'
).replace(/\/+$/, '');
const OPS_APP =
  process.env.OPS_APP_DIR || path.join(__dirname, '..', 'zhixiang-ops-frontend', 'dist');
const PORT = process.env.PORT || 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
};

/** 通用反代（支持 http/https 目标） */
function proxyRequest(targetUrl, req, res) {
  const target = new URL(targetUrl);
  const client = target.protocol === 'https:' ? https : http;
  const headers = { ...req.headers };
  headers['content-type'] = req.headers['content-type'] || 'application/json';
  delete headers['host'];
  delete headers['transfer-encoding'];

  const proxy = client.request(
    target,
    { method: req.method, headers },
    (upstream) => {
      const responseHeaders = { ...upstream.headers, 'access-control-allow-origin': '*' };
      delete responseHeaders['transfer-encoding'];
      res.writeHead(upstream.statusCode, responseHeaders);
      upstream.pipe(res);
    },
  );
  proxy.on('error', (e) => {
    res.writeHead(502, { 'content-type': 'application/json; charset=utf-8' });
    res.end(
      JSON.stringify({
        code: 'BACKEND_UNREACHABLE',
        msg: String(e.message || e),
        data: null,
      }),
    );
  });
  req.pipe(proxy);
}

/** 静态文件服务（带路径穿越防护与 SPA fallback） */
function serveStatic(res, filePath, fallback) {
  if (!filePath.startsWith(ROOT) && !filePath.startsWith(path.resolve(OPS_APP))) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (fallback) {
        serveStatic(res, fallback, null);
        return;
      }
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Not found: ' + filePath);
      return;
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost');

  // —— 反代：运营系统后端 ——
  if (u.pathname.startsWith('/api/')) {
    proxyRequest(BACKEND + u.pathname + u.search, req, res);
    return;
  }

  // —— 反代：管理系统 API（去掉 /ms-api 前缀）——
  if (u.pathname.startsWith('/ms-api/')) {
    const msPath = u.pathname.slice('/ms-api'.length);
    proxyRequest(MS_API + msPath + u.search, req, res);
    return;
  }

  // —— 运营前端构建产物（SPA）——
  if (u.pathname === '/ops-app' || u.pathname.startsWith('/ops-app/')) {
    const rel = u.pathname.replace(/^\/ops-app/, '') || '/';
    const filePath = path.join(OPS_APP, rel);
    serveStatic(res, filePath, path.join(OPS_APP, 'index.html'));
    return;
  }

  // —— 门户与看板 ——
  if (u.pathname === '/' || u.pathname === '/portal') {
    serveStatic(res, path.join(ROOT, 'portal.html'), null);
    return;
  }
  if (u.pathname === '/dashboard') {
    serveStatic(res, path.join(ROOT, 'index.html'), null);
    return;
  }

  // —— 其余静态（portal.css / portal.js / vendor / favicon 等）——
  const rel = u.pathname === '/' ? '/index.html' : u.pathname;
  serveStatic(res, path.join(ROOT, rel), null);
});

server.listen(PORT, () => {
  console.log(`统一门户已启动: http://localhost:${PORT}`);
  console.log(`运营后端代理: ${BACKEND}`);
  console.log(`管理系统代理: ${MS_API}`);
  console.log(`运营前端目录: ${OPS_APP}`);
});
