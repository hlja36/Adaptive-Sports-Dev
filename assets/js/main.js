// 全站共用互動邏輯：手風琴折疊、分頁切換、公告與相簿篩選
function toggleAcc(btn) {
  const item = btn.parentElement;
  item.classList.toggle('open');
}

function openTab(evt, tabId) {
  const container = evt.target.closest('.card') || document;
  container.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  const bar = evt.target.parentElement;
  bar.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  evt.target.classList.add('active');
}

function filterNews(cat, btn) {
  btn.parentElement.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('#newsList .accordion-item').forEach(item => {
    item.style.display = (cat === 'all' || item.dataset.cat === cat) ? 'block' : 'none';
  });
}

function filterGallery(group, btn) {
  btn.parentElement.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('#galleryGrid .gallery-item').forEach(item => {
    item.style.display = (group === 'all' || item.dataset.group === group) ? 'block' : 'none';
  });
}
// 全站自動載入師資登入與「資料填報與評估」鎖定機制
(function () {
  const configScript = document.createElement('script');
  configScript.src = 'assets/js/auth-config.js';
  configScript.onload = function () {
    const guardScript = document.createElement('script');
    guardScript.src = 'assets/js/auth-guard.js';
    document.body.appendChild(guardScript);
  };
  document.body.appendChild(configScript);
})();
