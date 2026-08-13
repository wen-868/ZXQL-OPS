/**
 * 智享全链统一门户（统一管理后台方案 §3 / §4）。
 * - 登录：管理系统登录 → 运营 SSO 换票，一次登录进两个系统
 * - /ms：iframe 嵌入管理系统（跨域 postMessage 注入登录态）
 * - /ops：iframe 嵌入运营前端（同源直写 localStorage + postMessage）
 */
(function () {
  'use strict';

  const LS = {
    msToken: 'portal_ms_token',
    msCsrf: 'portal_ms_csrf',
    msUser: 'portal_ms_user',
    opsToken: 'portal_ops_token',
    opsUser: 'portal_ops_user',
    roleBind: 'portal_role_bind',
  };

  const $ = (sel) => document.querySelector(sel);

  function read(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function hasSession() {
    return !!(localStorage.getItem(LS.msToken) && localStorage.getItem(LS.opsToken));
  }

  function showLogin() {
    $('#login-view').classList.remove('hidden');
    $('#app-view').classList.add('hidden');
  }

  function showApp() {
    $('#login-view').classList.add('hidden');
    $('#app-view').classList.remove('hidden');
    const user = read(LS.opsUser) || read(LS.msUser) || {};
    $('#user-name').textContent = user.realName || user.username || '';
    switchTab(currentTab);
  }

  let currentTab = 'ms';

  function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab').forEach((b) => {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    const frame = $('#frame');
    if (tab === 'ms') {
      frame.src = 'https://admin.onepan.cn';
      frame.onload = () => {
        const token = localStorage.getItem(LS.msToken);
        const user = read(LS.msUser);
        const csrfToken = localStorage.getItem(LS.msCsrf) || '';
        try {
          frame.contentWindow.postMessage(
            { type: 'ops-portal-login', token, user, csrfToken },
            'https://admin.onepan.cn',
          );
        } catch (e) {
          // 管理系统未配合时静默（用户需在管理系统内手动登录）
        }
      };
    } else {
      frame.src = '/ops-app/';
      frame.onload = () => {
        const token = localStorage.getItem(LS.opsToken);
        const user = read(LS.opsUser);
        try {
          // 同源：先直写 localStorage，再发消息让前端 store 同步
          frame.contentWindow.localStorage.setItem('ops_token', token);
          frame.contentWindow.localStorage.setItem('ops_user', JSON.stringify(user || {}));
          frame.contentWindow.postMessage(
            { type: 'ops-portal-login', token, user },
            window.location.origin,
          );
        } catch (e) {
          // 忽略（跨域等场景走 postMessage 兜底）
        }
      };
    }
  }

  async function doLogin(username, password) {
    // 1. 管理系统登录（经本地门户代理，避免 CORS）
    const msResp = await fetch('/ms-api/admin/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const msJson = await msResp.json();
    if (msJson.code !== '0') {
      throw new Error(msJson.msg || '管理系统登录失败');
    }
    const ms = msJson.data;

    // 2. 运营系统 SSO 换票
    const ssoResp = await fetch('/api/ops/auth/sso', {
      method: 'POST',
      headers: {
        authorization: 'Bearer ' + ms.token,
        'content-type': 'application/json',
      },
      body: '{}',
    });
    const ssoJson = await ssoResp.json();
    if (ssoJson.code !== '0') {
      throw new Error(ssoJson.msg || '运营系统登录失败');
    }
    const ops = ssoJson.data;

    localStorage.setItem(LS.msToken, ms.token);
    localStorage.setItem(LS.msCsrf, ms.csrfToken || '');
    localStorage.setItem(LS.msUser, JSON.stringify(ms.user || {}));
    localStorage.setItem(LS.opsToken, ops.token);
    localStorage.setItem(LS.opsUser, JSON.stringify(ops.user || {}));
    localStorage.setItem(LS.roleBind, JSON.stringify(ops.roleBind || {}));

    // 默认落地：超级管理员 → 管理系统，其余 → 运营系统
    currentTab = ops.roleBind && ops.roleBind.opsRole === 'super_admin' ? 'ms' : 'ops';
    showApp();
  }

  function logout() {
    Object.values(LS).forEach((k) => localStorage.removeItem(k));
    $('#frame').src = 'about:blank';
    showLogin();
  }

  // —— 事件绑定 ——
  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#login-error');
    err.classList.add('hidden');
    const btn = e.target.querySelector('.login-btn');
    btn.disabled = true;
    try {
      await doLogin($('#username').value.trim(), $('#password').value);
    } catch (ex) {
      err.textContent = ex.message || '登录失败';
      err.classList.remove('hidden');
    } finally {
      btn.disabled = false;
    }
  });

  document.querySelectorAll('.tab').forEach((b) => {
    b.addEventListener('click', () => switchTab(b.dataset.tab));
  });
  $('#logout').addEventListener('click', logout);

  // —— 初始化 ——
  if (hasSession()) {
    showApp();
  } else {
    showLogin();
  }
})();
