// assets/js/auth-guard.js
(function () {
  const STORAGE_KEY = 'cl140028_users_local';
  const SESSION_KEY = 'cl140028_session';

  function getUsers() {
    const local = localStorage.getItem(STORAGE_KEY);
    if (local) return JSON.parse(local);
    if (typeof AUTH_CONFIG !== 'undefined' && AUTH_CONFIG.users) return AUTH_CONFIG.users;
    return [
      { name: "總部管理員", pass: "CL140028admin", role: "admin" },
      { name: "花蓮據點師資", pass: "hualien2026", role: "instructor" }
    ];
  }

  function getSession() {
    const data = sessionStorage.getItem(SESSION_KEY);
    return data ? JSON.parse(data) : null;
  }

  // 1. 若未登入卻直接輸入網址進入 data-upload.html，自動導回首頁
  if (window.location.pathname.toLowerCase().includes('data-upload.html') && !getSession()) {
    alert('此專區僅限師資／指導員登入後使用，請先登入。');
    window.location.href = 'index.html';
    return;
  }

  // 2. 自動注入所需 CSS 樣式
  const style = document.createElement('style');
  style.textContent = `
    .auth-bar {
      background: #f1f5f9; border-bottom: 1px solid #cbd5e1;
      padding: 8px 20px; display: flex; justify-content: space-between;
      align-items: center; flex-wrap: wrap; gap: 10px; font-size: 0.9rem;
    }
    .auth-status { display: flex; align-items: center; gap: 8px; color: #334155; font-weight: 600; flex-wrap: wrap; }
    .auth-badge-guest { background: #e2e8f0; color: #475569; padding: 2px 10px; border-radius: 99px; font-size: 0.8rem; }
    .auth-badge-user { background: #dcfce7; color: #166534; padding: 2px 10px; border-radius: 99px; font-size: 0.8rem; }
    .auth-bar-actions { display: flex; gap: 8px; }
    /* 第一行衛生福利部...教學中心字體加大 1pt */
  .top-bar span {
    font-size: calc(1em + 1pt);
  }
    /* 師資／指導員登入按鈕字體加大 1pt */
    .auth-top-btn {
      padding: 5px 12px; border-radius: 6px; border: none; font-size: calc(0.85rem + 1pt);
      font-weight: 600; cursor: pointer; background: #0f766e; color: #fff;
    }
    .auth-top-btn.secondary { background: #475569; }
    .auth-top-btn.danger { background: #dc2626; }
    nav a.auth-locked-btn, .btn.auth-locked-btn {
      background: #94a3b8 !important; color: #f8fafc !important;
      opacity: 0.85; cursor: not-allowed;
    }
    footer a.auth-locked-btn { opacity: 0.7; }
    .auth-overlay {
      display: none; position: fixed; inset: 0; background: rgba(15,23,42,0.6);
      z-index: 9999; justify-content: center; align-items: center; padding: 16px;
    }
    .auth-overlay.show { display: flex; }
    .auth-modal {
      background: #fff; padding: 24px; border-radius: 12px; width: 100%;
      max-width: 400px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2);
    }
    .auth-modal h3 { margin: 0 0 8px; color: #0f172a; }
    .auth-modal p { margin: 0 0 16px; color: #475569; font-size: 0.9rem; line-height: 1.5; }
    .auth-modal input {
      width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1;
      border-radius: 8px; box-sizing: border-box; margin-bottom: 10px; font-size: 0.95rem;
    }
    .auth-error { color: #dc2626; font-size: 0.85rem; min-height: 20px; margin-bottom: 10px; }
    .auth-actions { display: flex; gap: 10px; justify-content: flex-end; }
    .auth-btn { padding: 8px 16px; border-radius: 8px; border: none; font-weight: 600; cursor: pointer; }
    .auth-btn-cancel { background: #e2e8f0; color: #334155; }
    .auth-btn-primary { background: #d97706; color: #fff; }
    .auth-user-list { max-height: 180px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 12px; }
    .auth-user-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-bottom: 1px solid #f1f5f9; font-size: 0.88rem; }
  `;
  document.head.appendChild(style);

  // 3. 自動在 .top-bar 下方插入身分狀態列
  const authBar = document.createElement('div');
  authBar.className = 'auth-bar';
  authBar.innerHTML = `
    <div class="auth-status" id="authStatusDisplay"></div>
    <div class="auth-bar-actions" id="authBarActions"></div>
  `;
  const topBar = document.querySelector('.top-bar');
  if (topBar && topBar.parentNode) {
    topBar.parentNode.insertBefore(authBar, topBar.nextSibling);
  } else {
    document.body.insertBefore(authBar, document.body.firstChild);
  }

  // 4. 自動插入登入、鎖定提示與管理員密碼維護彈窗
  const modalsWrapper = document.createElement('div');
  modalsWrapper.innerHTML = `
    <div id="authLockedModal" class="auth-overlay">
      <div class="auth-modal">
        <h3>🔒 功能已鎖定</h3>
        <p>您目前為「訪客模式」，可瀏覽網站所有公開資訊。如需進入「資料填報與評估」，請先以師資／指導員身分登入。</p>
        <div class="auth-actions">
          <button type="button" class="auth-btn auth-btn-cancel" id="btnCloseLocked">繼續以訪客瀏覽</button>
          <button type="button" class="auth-btn auth-btn-primary" id="btnGoLogin">前往師資登入</button>
        </div>
      </div>
    </div>

    <div id="authLoginModal" class="auth-overlay">
      <div class="auth-modal">
        <h3>🔑 師資／指導員登入</h3>
        <p>請輸入授權通行密碼以解鎖全站「資料填報與評估」功能。</p>
        <input type="password" id="authLoginPassInput" placeholder="請輸入通行密碼" autocomplete="off">
        <div id="authLoginError" class="auth-error"></div>
        <div class="auth-actions">
          <button type="button" class="auth-btn auth-btn-cancel" id="btnCancelLogin">取消</button>
          <button type="button" class="auth-btn auth-btn-primary" id="btnSubmitLogin">確認登入</button>
        </div>
      </div>
    </div>

    <div id="authAdminModal" class="auth-overlay">
      <div class="auth-modal">
        <h3>⚙️ 多人密碼維護</h3>
        <p>新增或刪除人員密碼後，請點擊「複製設定檔」更新 <code>assets/js/auth-config.js</code>。</p>
        <div id="authAdminUserList" class="auth-user-list"></div>
        <input type="text" id="authNewUserName" placeholder="人員／據點名稱（例如：宜蘭據點師資）">
        <input type="text" id="authNewUserPass" placeholder="設定通行密碼">
        <div class="auth-actions" style="margin-bottom:10px;">
          <button type="button" class="auth-btn auth-btn-primary" id="btnAddUser">＋ 新增密碼</button>
          <button type="button" class="auth-btn auth-btn-cancel" id="btnCopyConfig">📋 複製設定檔</button>
        </div>
        <div class="auth-actions">
          <button type="button" class="auth-btn auth-btn-cancel" id="btnCloseAdmin">關閉</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modalsWrapper);

  // 5. 自動找出頁面上所有指向 data-upload.html 的連結並綁定攔截事件
  const protectedLinks = document.querySelectorAll('a[href*="data-upload.html"]');
  protectedLinks.forEach(link => {
    link.dataset.origText = link.textContent.trim();
    link.addEventListener('click', function (e) {
      if (!getSession()) {
        e.preventDefault();
        document.getElementById('authLockedModal').classList.add('show');
      }
    });
  });

  // 6. 依據登入狀態更新全頁按鈕與狀態列
  function updateUI() {
    const session = getSession();
    const statusEl = document.getElementById('authStatusDisplay');
    const actionsEl = document.getElementById('authBarActions');

    if (session) {
      statusEl.innerHTML = `<span class="auth-badge-user">✅ 已登入：${session.name}（師資／指導員）</span><span>已解鎖「資料填報與評估」</span>`;
      actionsEl.innerHTML =
        (session.role === 'admin' ? `<button type="button" class="auth-top-btn secondary" id="btnOpenAdmin">⚙️ 密碼維護</button>` : '') +
        `<button type="button" class="auth-top-btn danger" id="btnLogout">🚪 登出</button>`;

      if (session.role === 'admin') {
        document.getElementById('btnOpenAdmin').onclick = openAdminModal;
      }
      document.getElementById('btnLogout').onclick = function () {
        sessionStorage.removeItem(SESSION_KEY);
        updateUI();
        if (window.location.pathname.toLowerCase().includes('data-upload.html')) {
          window.location.href = 'index.html';
        }
      };

      protectedLinks.forEach(link => {
        link.classList.remove('auth-locked-btn');
        link.textContent = link.dataset.origText;
      });
    } else {
      statusEl.innerHTML = ``;
      actionsEl.innerHTML = `<button type="button" class="auth-top-btn" id="btnOpenLogin">🔑 師資／指導員登入</button>`;
      document.getElementById('btnOpenLogin').onclick = openLoginModal;

      protectedLinks.forEach(link => {
        link.classList.add('auth-locked-btn');
        link.textContent = '🔒 ' + link.dataset.origText.replace(/^🔒\s*/, '');
      });
    }
  }

  function openLoginModal() {
    document.getElementById('authLoginPassInput').value = '';
    document.getElementById('authLoginError').textContent = '';
    document.getElementById('authLoginModal').classList.add('show');
    setTimeout(() => document.getElementById('authLoginPassInput').focus(), 100);
  }

  function handleLogin() {
    const pass = document.getElementById('authLoginPassInput').value.trim();
    const matched = getUsers().find(u => u.pass === pass);
    if (matched) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(matched));
      document.getElementById('authLoginModal').classList.remove('show');
      updateUI();
    } else {
      document.getElementById('authLoginError').textContent = '密碼錯誤，請重新輸入或聯繫專案聯絡人。';
    }
  }

  function openAdminModal() {
    renderUserList();
    document.getElementById('authAdminModal').classList.add('show');
  }

  function renderUserList() {
    const list = getUsers();
    const container = document.getElementById('authAdminUserList');
    container.innerHTML = list.map((u, i) => `
      <div class="auth-user-item">
        <span><strong>${u.name}</strong>（<code>${u.pass}</code>）</span>
        ${u.role === 'admin' ? '<small>管理員</small>' : `<button type="button" data-idx="${i}" class="btn-del-user" style="color:#dc2626;border:none;background:none;cursor:pointer;">刪除</button>`}
      </div>
    `).join('');
    container.querySelectorAll('.btn-del-user').forEach(btn => {
      btn.onclick = function () {
        const users = getUsers();
        users.splice(Number(this.dataset.idx), 1);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
        renderUserList();
      };
    });
  }

  // 綁定彈窗按鈕事件
  document.getElementById('btnCloseLocked').onclick = () => document.getElementById('authLockedModal').classList.remove('show');
  document.getElementById('btnGoLogin').onclick = () => {
    document.getElementById('authLockedModal').classList.remove('show');
    openLoginModal();
  };
  document.getElementById('btnCancelLogin').onclick = () => document.getElementById('authLoginModal').classList.remove('show');
  document.getElementById('btnSubmitLogin').onclick = handleLogin;
  document.getElementById('authLoginPassInput').addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
  document.getElementById('btnCloseAdmin').onclick = () => document.getElementById('authAdminModal').classList.remove('show');

  document.getElementById('btnAddUser').onclick = function () {
    const name = document.getElementById('authNewUserName').value.trim();
    const pass = document.getElementById('authNewUserPass').value.trim();
    if (!name || !pass) return alert('請輸入名稱與密碼');
    const users = getUsers();
    users.push({ name, pass, role: 'instructor' });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
    document.getElementById('authNewUserName').value = '';
    document.getElementById('authNewUserPass').value = '';
    renderUserList();
  };

  document.getElementById('btnCopyConfig').onclick = function () {
    const code = `const AUTH_CONFIG = {\n  users: ${JSON.stringify(getUsers(), null, 2)}\n};`;
    navigator.clipboard.writeText(code).then(() => alert('已複製設定檔內容！請貼上至 assets/js/auth-config.js'));
  };

  updateUI();
})();
