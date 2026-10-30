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

/**
 * 静态文件服务（带路径穿越防护与 SPA fallback）。
 * candidates：有序候选文件列表，按序尝试（门户目录 → 运营前端产物，兼容 /assets 绝对路径资源）。
 * allowedRoots：本组候选允许的根目录白名单（只读白名单，禁止发布根目录整体可读）。
 * fallback：全部缺失时回退的 SPA 入口（如运营前端 index.html）。
 */
function serveStatic(res, candidates, fallback, allowedRoots) {
  const tryNext = (i) => {
    if (i >= candidates.length) {
      if (fallback) {
        serveStatic(res, [fallback], null, allowedRoots);
        return;
      }
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    const filePath = path.resolve(candidates[i]);
    if (!allowedRoots.some((root) => filePath.startsWith(root))) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        tryNext(i + 1);
        return;
      }
      res.writeHead(200, {
        'content-type': MIME[path.extname(filePath)] || 'application/octet-stream',
      });
      res.end(data);
    });
  };
  tryNext(0);
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
    // OPS-SECURITY-BASELINE-01：防路径穿越——解码后规范化并强制留在 OPS_APP 根内
    const safeRel = path.normalize(decodeURIComponent(rel)).replace(/^([.]{2}(\/|\|$))+/, '');
    const filePath = path.join(OPS_APP, safeRel);
    const rootAbs = path.resolve(OPS_APP);
    if (filePath !== rootAbs && !filePath.startsWith(rootAbs + path.sep)) {
      res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }
    serveStatic(res, [filePath], path.join(OPS_APP, 'index.html'), [path.resolve(OPS_APP)]);
    return;
  }

  // —— favicon：无图标文件，返回 204 避免浏览器 404 报错 ——
  if (u.pathname === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }

  // —— 默认入口：直达运营系统（不做管理系统登录界面）——
  if (u.pathname === '/') {
    res.writeHead(302, { location: '/ops-app/' });
    res.end();
    return;
  }
  // —— 看板（运营决策看板）——
  if (u.pathname === '/dashboard') {
    serveStatic(res, [path.join(ROOT, 'index.html')], null, [path.resolve(ROOT)]);
    return;
  }

  // —— 其余静态：仅门户自身文件（portal.*、vendor/*）与运营前端资源 ——
  // 白名单收窄：不再把发布根目录整体暴露（backend/.env、tools/mariadb 数据、logs 不可下载）
  const rel = u.pathname === '/' ? '/index.html' : u.pathname;
  const hasExt = path.extname(rel).length > 0;
  const isPortalFile =
    rel === '/index.html' ||
    rel === '/portal.html' ||
    rel === '/portal.css' ||
    rel === '/portal.js' ||
    rel.startsWith('/vendor/');
  if (isPortalFile) {
    serveStatic(res, [path.join(ROOT, rel)], null, [path.resolve(ROOT)]);
    return;
  }
  // 无扩展名的路径按 SPA 路由处理：资源缺失时回退运营前端入口（避免刷新 404）
  serveStatic(
    res,
    [path.join(OPS_APP, rel)],
    hasExt ? null : path.join(OPS_APP, 'index.html'),
    [path.resolve(OPS_APP)],
  );
});

// 仅绑定本机回环地址：服务与数据只对本机开放，不暴露给局域网
server.listen(PORT, '127.0.0.1', () => {
  console.log(`统一门户已启动: http://localhost:${PORT}`);
  console.log(`运营后端代理: ${BACKEND}`);
  console.log(`管理系统代理: ${MS_API}`);
  console.log(`运营前端目录: ${OPS_APP}`);
});
