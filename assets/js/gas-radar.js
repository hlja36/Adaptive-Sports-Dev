// CL-14-0028 體能評估五級分常模演算法（依《健康達人21》表9 及 體育署《銀髮族體適能健身寶典》表14）
// 請將下方網址替換為您部署 Google Apps Script 後取得的 Web App URL
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxagxu75HFgU8OmoqKPO7e7SDQMaI9yUy7EeHRjD5F_QlTN8mOvj8TI7d0EOgcPHIId/exec";

// 儲存前後測狀態（raw: 原始測量值 [握力, 單足立, 5M步行, 30秒坐立, 30秒內收肌], scores: 1~5級分）
const assessmentState = {
  pre: { raw: null, scores: [0, 0, 0, 0, 0] },
  post: { raw: null, scores: [0, 0, 0, 0, 0] }
};

// 表 14：65歲以上30秒椅子坐立分齡分性別五級分切點 [1分上限, 2分上限, 3分上限, 4分上限] (超過4分上限即為5分)
const CHAIR_STAND_NORMS = {
  M: {
    "65-69": [13, 15, 19, 24],
    "70-74": [12, 14, 18, 23],
    "75-79": [11, 14, 17, 21],
    "80-84": [10, 12, 15, 19],
    "85-89": [8, 11, 13, 18],
    "90+":   [6, 10, 13, 16]
  },
  F: {
    "65-69": [13, 15, 18, 23],
    "70-74": [12, 14, 17, 21],
    "75-79": [11, 13, 16, 20],
    "80-84": [10, 12, 14, 19],
    "85-89": [8, 10, 13, 17],
    "90+":   [5, 9, 13, 16]
  }
};

// 計算單一測量組的 1~5 級分
function computeFiveLevels(raw, gender, ageGroup) {
  const [grip, oneLeg, walk5m, chairStand, adductor] = raw;

  // 1. 最大握力 (kg)
  let sGrip = 1;
  if (gender === 'M') {
    sGrip = grip >= 37 ? 5 : grip >= 33 ? 4 : grip >= 29 ? 3 : grip >= 25 ? 2 : 1;
  } else {
    sGrip = grip >= 24 ? 5 : grip >= 21 ? 4 : grip >= 18 ? 3 : grip >= 15 ? 2 : 1;
  }

  // 2. 開眼單足立 (秒)
  let sOneLeg = 1;
  if (gender === 'M') {
    sOneLeg = oneLeg >= 60 ? 5 : oneLeg >= 30 ? 4 : oneLeg >= 13 ? 3 : oneLeg >= 5 ? 2 : 1;
  } else {
    sOneLeg = oneLeg >= 60 ? 5 : oneLeg >= 23 ? 4 : oneLeg >= 10 ? 3 : oneLeg >= 4 ? 2 : 1;
  }

  // 3. 一般步行5公尺 (秒，反向指標：秒數越短分數越高)
  let sWalk = 1;
  if (gender === 'M') {
    sWalk = walk5m < 3.6 ? 5 : walk5m < 4.0 ? 4 : walk5m < 4.4 ? 3 : walk5m < 5.0 ? 2 : 1;
  } else {
    sWalk = walk5m < 3.8 ? 5 : walk5m < 4.2 ? 4 : walk5m < 4.8 ? 3 : walk5m < 5.6 ? 2 : 1;
  }

  // 4. 30秒椅子坐立 (次)
  const thresholds = (CHAIR_STAND_NORMS[gender] && CHAIR_STAND_NORMS[gender][ageGroup]) || [11, 13, 16, 20];
  let sChair = chairStand <= thresholds[0] ? 1 :
               chairStand <= thresholds[1] ? 2 :
               chairStand <= thresholds[2] ? 3 :
               chairStand <= thresholds[3] ? 4 : 5;

  // 5. 30秒坐姿內收肌力 (次)
  let sAdductor = 1;
  if (gender === 'M') {
    sAdductor = adductor >= 50 ? 5 : adductor >= 44 ? 4 : adductor >= 31 ? 3 : adductor >= 21 ? 2 : 1;
  } else {
    sAdductor = adductor >= 42 ? 5 : adductor >= 34 ? 4 : adductor >= 29 ? 3 : adductor >= 21 ? 2 : 1;
  }

  return [sGrip, sOneLeg, sWalk, sChair, sAdductor];
}

// 自動計算 BMI 與腰臀比 WHR
function calcBodyMetrics() {
  const h = parseFloat(document.getElementById('height')?.value);
  const w = parseFloat(document.getElementById('weight')?.value);
  const waist = parseFloat(document.getElementById('waist')?.value);
  const hip = parseFloat(document.getElementById('hip')?.value);

  if (h > 0 && w > 0) {
    const bmi = w / Math.pow(h / 100, 2);
    if (document.getElementById('bmi')) document.getElementById('bmi').value = bmi.toFixed(1);
  } else {
    if (document.getElementById('bmi')) document.getElementById('bmi').value = '';
  }

  if (waist > 0 && hip > 0) {
    if (document.getElementById('whr')) document.getElementById('whr').value = (waist / hip).toFixed(2);
  } else {
    if (document.getElementById('whr')) document.getElementById('whr').value = '';
  }
}

// 初始化 Chart.js 雙圖層重疊雷達圖
let radarChart = null;
function initRadarChart() {
  const ctx = document.getElementById('overlapRadarChart').getContext('2d');
  radarChart = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: [
        ['① 上肢肌力', '(最大握力)'],
        ['② 靜態平衡', '(開眼單足立)'],
        ['③ 步行能力', '(5公尺步行)'],
        ['④ 下肢肌力', '(30秒坐立)'],
        ['⑤ 骨盆骶肌力', '(30秒內收)']
      ],
      datasets: [
        {
          label: '前測 (Pre-test)',
          data: assessmentState.pre.scores,
          backgroundColor: 'rgba(2, 132, 199, 0.24)',
          borderColor: 'rgba(2, 132, 199, 1)',
          pointBackgroundColor: 'rgba(2, 132, 199, 1)',
          borderWidth: 2.5,
          pointRadius: 4
        },
        {
          label: '後測 (Post-test)',
          data: assessmentState.post.scores,
          backgroundColor: 'rgba(217, 119, 6, 0.30)',
          borderColor: 'rgba(217, 119, 6, 1)',
          pointBackgroundColor: 'rgba(217, 119, 6, 1)',
          borderWidth: 2.5,
          pointRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 1,
      scales: {
        r: {
          min: 0,
          max: 5,
          ticks: { stepSize: 1, font: { size: 15, weight: 'bold' } },
          pointLabels: { font: { size: 16, weight: 'bold' }, color: '#1e293b' }
        }
      },
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 15, weight: 'bold' } } },
        tooltip: {
          callbacks: {
            label: function(context) {
              const idx = context.dataIndex;
              const isPre = context.datasetIndex === 0;
              const rawArr = isPre ? assessmentState.pre.raw : assessmentState.post.raw;
              const units = ['kg', '秒', '秒', '次', '次'];
              const rawText = rawArr ? `${rawArr[idx]} ${units[idx]}` : '尚未輸入';
              return `${context.dataset.label}：${context.raw} 級分（實測：${rawText}）`;
            }
          }
        }
      }
    }
  });
}

// 只在五項實測值齊全時才評分；不可把未填資料當成 0。
function readRadarInputs() {
  const ids = ['grip', 'oneLeg', 'walk5m', 'chairStand', 'adductor'];
  const values = ids.map(id => document.getElementById(id)?.value?.trim() ?? '');
  if (values.some(v => v === '' || !Number.isFinite(Number(v)))) return null;
  const raw = values.map(Number);
  if (raw.some(x => x < 0) || raw[2] <= 0 || raw[1] > 60) return null;
  return raw;
}
function refreshRadarView() {
  if (!radarChart) return;
  radarChart.data.datasets[0].data = assessmentState.pre.raw ? assessmentState.pre.scores : [null,null,null,null,null];
  radarChart.data.datasets[1].data = assessmentState.post.raw ? assessmentState.post.scores : [null,null,null,null,null];
  radarChart.update();
}
function recalculateAll() {
  const stage = document.getElementById('testStage')?.value;
  const gender = document.getElementById('gender')?.value;
  const ageGroup = document.getElementById('ageGroup')?.value;
  if (stage !== 'pre' && stage !== 'post') return;
  const raw = readRadarInputs();
  assessmentState[stage].raw = raw;
  assessmentState[stage].scores = raw && ['M','F'].includes(gender) && ageGroup
    ? computeFiveLevels(raw, gender, ageGroup) : [0,0,0,0,0];
  for (const key of ['pre','post']) {
    if (assessmentState[key].raw && ['M','F'].includes(gender) && ageGroup) {
      assessmentState[key].scores = computeFiveLevels(assessmentState[key].raw, gender, ageGroup);
    }
  }
  refreshRadarView();
  if (raw && gender && ageGroup) updateSummaryTableAndAlerts(assessmentState[stage].scores, raw[3]);
  else {
    const badge = document.getElementById('totalScoreBadge');
    if (badge) badge.textContent = '請完成五項體能檢測資料';
    const alertBox = document.getElementById('riskAlertBox');
    if (alertBox) { alertBox.className = 'alert'; alertBox.textContent = '請完成資料後再進行風險評估。'; }
    updateSummaryTableOnly();
  }
}
function updateSummaryTableOnly() {
  const tbody = document.getElementById('radarSummaryBody');
  if (!tbody) return;
  const labels = ['最大握力','開眼單足立','5公尺步行','30秒坐立','30秒內收'];
  const units = ['kg','秒','秒','次','次'];
  tbody.replaceChildren();
  labels.forEach((label, i) => {
    const tr = document.createElement('tr');
    const parts = [label, ...['pre','post'].map(stage => {
      const state = assessmentState[stage];
      return state.raw ? `${state.raw[i]} ${units[i]} (${state.scores[i]} 分)` : '--';
    })];
    let compare = '待補後測';
    if (assessmentState.pre.raw && assessmentState.post.raw) {
      const n=assessmentState.post.scores[i]-assessmentState.pre.scores[i];
      compare=n>0?`提升 +${n}`:n<0?`下降 ${n}`:'維持';
    }
    parts.push(compare);
    parts.forEach((v,j) => {
      const td = document.createElement('td');
      td.textContent = v;
      if (j===0) td.style.fontWeight='700';
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

function updateSummaryTableAndAlerts(currentScores, chairCount) {
  const total = currentScores.reduce((a, b) => a + b, 0);
  const badge = document.getElementById('totalScoreBadge');
  badge.textContent = `目前階段總點數：${total} / 25 分`;

  const alertBox = document.getElementById('riskAlertBox');
  if (total <= 15 || chairCount < 8) {
    badge.className = 'badge badge-red';
    alertBox.className = 'alert alert-danger';
    alertBox.innerHTML = `⚠️ <strong>體弱／跌倒高風險警示（總點數 ${total} 分 ${total<=15?'≤ 15分':''}${chairCount<8?'；30秒坐立 < 8次':''}）</strong>：依手冊第 38–40 頁評估標準，建議納入「衰弱組」循序漸進訓練，並加強防跌與下肢肌力處方。`;
  } else {
    badge.className = 'badge badge-green';
    alertBox.className = 'alert alert-success';
    alertBox.innerHTML = `✅ <strong>體能等級評估正常（總點數 ${total} / 25 分）</strong>：圖形面積越大代表體能越佳；可繼續輸入或載入前後測數據進行重疊對比。`;
  }

  updateSummaryTableOnly();
}

// 示範按鈕：展示前後測重疊雷達圖效果
function loadDemoOverlap() {
  document.getElementById('gender').value = 'F';
  document.getElementById('ageGroup').value = '75-79';
  assessmentState.pre.raw = [16.5, 8.2, 5.4, 12, 24];
  assessmentState.post.raw = [20.5, 19.5, 4.3, 17, 35];
  document.getElementById('testStage').value = 'post';
  document.getElementById('grip').value = 20.5;
  document.getElementById('oneLeg').value = 19.5;
  document.getElementById('walk5m').value = 4.3;
  document.getElementById('chairStand').value = 17;
  document.getElementById('adductor').value = 35;
  recalculateAll();
}

// Google Apps Script 公開 Web App GET 可能遭瀏覽器 CORS 攔截。
// 若您已建好同源 Netlify 查詢代理，可把下列地址改為代理路徑。
const RADAR_QUERY_URL = GAS_WEB_APP_URL;
const RADAR_SUBMIT_URL = GAS_WEB_APP_URL;
const getRadarValue = id => String(document.getElementById(id)?.value ?? '').trim();
function setRadarStatus(message, color = '#0284c7') {
  const el = document.getElementById('gasStatusMsg');
  if (el) { el.style.color = color; el.textContent = message; }
}
function normalizeGender(g) { return g === '男' ? 'M' : g === '女' ? 'F' : g; }
function normalizeAgeGroup(a) {
  const m=String(a||'').match(/(65|70|75|80|85)\s*[-–~～]\s*(69|74|79|84|89)/);
  if (m) return `${m[1]}-${m[2]}`;
  if (/90/.test(String(a))) return '90+';
  return String(a||'');
}
function fillRadarMetricInputs(raw) {
  ['grip','oneLeg','walk5m','chairStand','adductor'].forEach((id,i)=>{
    const el=document.getElementById(id);
    if (el) el.value=raw ? raw[i] : '';
  });
}
async function loadStudentFromGAS(options = {}) {
  const siteName=getRadarValue('siteName');
  const studentId=getRadarValue('studentId');
  const participantCode=getRadarValue('participantCode').toUpperCase();
  if (!siteName || !studentId || !participantCode) {
    setRadarStatus('⚠️ 請填入據點、姓名與受試者編號（例如 A789）。','#d97706');return;
  }
  const params=new URLSearchParams({siteName,studentId,participantCode});
  const url=RADAR_QUERY_URL+(RADAR_QUERY_URL.includes('?')?'&':'?')+params.toString();
  setRadarStatus('正在查詢正式表單及雷達圖資料庫...');
  try {
    const res=await fetch(url,{method:'GET',redirect:'follow'});
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data=await res.json();
    if (data.status==='ambiguous') throw new Error(data.message||'同名資料無法安全配對');
    if (data.status!=='success') throw new Error(data.message||'查詢失敗');
    const valid = v => Array.isArray(v) && v.length===5 && v.every(x=>x!=='' && x!==null && Number.isFinite(Number(x)));
    const pre=valid(data.pre)?data.pre.map(Number):null;
    const post=valid(data.post)?data.post.map(Number):null;
    if (!pre && !post) {
      setRadarStatus('查無符合據點、姓名、編號的前後測資料。舊紀錄若沒有編號，須先核對身分再補登。','#b45309');return;
    }
    const genderEl=document.getElementById('gender');
    if (data.gender && genderEl) genderEl.value=normalizeGender(data.gender);
    const ageEl=document.getElementById('ageGroup');
    if (ageEl) ageEl.value=data.ageGroup ? normalizeAgeGroup(data.ageGroup) : ''; // 未確認年齡時不得使用預設75-79歲
    // 若是從正式表單直接跳轉，不讓雲端舊紀錄覆蓋本次手上剛輸入的資料。
    const handoffStage=options.preserveHandoffStage || '';
    if (handoffStage!=='pre') assessmentState.pre.raw=pre;
    if (handoffStage!=='post') assessmentState.post.raw=post;
    const gender=getRadarValue('gender'), age=getRadarValue('ageGroup');
    ['pre','post'].forEach(key=>{
      const raw=assessmentState[key].raw;
      assessmentState[key].scores=raw&&['M','F'].includes(gender)&&age
        ?computeFiveLevels(raw,gender,age):[0,0,0,0,0];
    });
    const stageEl=document.getElementById('testStage');
    if (!handoffStage && stageEl) {
      stageEl.value='post'; // 查詢後以後測模式顯示或準備輸入後測
      fillRadarMetricInputs(post);
    }
    refreshRadarView();
    updateSummaryTableOnly();
    const badge=document.getElementById('totalScoreBadge');
    if (badge) badge.textContent=pre&&post?'已載入前測及後測':pre?'已載入前測，請輸入後測':'已載入後測（尚無前測）';
    setRadarStatus(`✅ 已查得 ${pre?'前測':''}${pre&&post?'與':''}${post?'後測':''}紀錄。${data.ageGroup?'可進行雷達圖比較。':'⚠️ 年齡層無法由原始資料確認，請人工選擇正確年齡層後再評分。'}`,'#16803c');
  } catch(err) {
    console.error('雲端查詢失敗：',err);
    setRadarStatus(`❌ 雲端查詢未完成：${err.message}。如為 Failed to fetch，請檢查 Apps Script 的 CORS／同源代理；本次已帶入的資料仍保留。`,'#dc2626');
  }
}

function applyOfficialFormHandoff() {
  let handoff;
  try {
    const text=sessionStorage.getItem('cl140028_radar_handoff');
    if (!text) return;
    sessionStorage.removeItem('cl140028_radar_handoff');
    handoff=JSON.parse(text);
  } catch(err) { console.warn('無法讀取表單交接資料',err);return; }
  if (!handoff || Date.now()-handoff.storedAt>30*60*1000) return;
  if (!['pre','post'].includes(handoff.testStage) || !Array.isArray(handoff.rawMetrics) ||
      handoff.rawMetrics.length!==5 || handoff.rawMetrics.some(v=>!Number.isFinite(Number(v)))) return;
  ['siteName','studentId','participantCode'].forEach(id=>{
    const el=document.getElementById(id);if(el) el.value=handoff[id]||'';
  });
  const genderEl=document.getElementById('gender');
  if(genderEl) genderEl.value=handoff.gender||'F';
  const stageEl=document.getElementById('testStage');
  if(stageEl) stageEl.value=handoff.testStage;
  if(handoff.ageGroup && document.getElementById('ageGroup')) {
    document.getElementById('ageGroup').value=handoff.ageGroup;
  }
  const stage=handoff.testStage;
  assessmentState[stage].raw=handoff.rawMetrics.map(Number);
  assessmentState[stage].scores=computeFiveLevels(assessmentState[stage].raw,
    getRadarValue('gender'),getRadarValue('ageGroup'));
  fillRadarMetricInputs(assessmentState[stage].raw);
  refreshRadarView();
  updateSummaryTableOnly();
  // 畫面上存在 openTab，切換至真正的雷達圖分頁。
  const tab=document.getElementById('tabRadar');
  const formTab=document.getElementById('tabForms');
  if (formTab) formTab.classList.remove('active');
  if (tab) tab.classList.add('active');
  document.querySelectorAll('.tab-btn').forEach((btn,i)=>btn.classList.toggle('active',i===1));
  const ageNote=handoff.ageGroup?'':'（出生月份與施測月份相同，無法確認實際年齡層，請人工確認後再採用級分）';
  if(!handoff.ageGroup){
    assessmentState[stage].scores=[0,0,0,0,0];
    refreshRadarView();updateSummaryTableOnly();
  }
  setRadarStatus('✅ 已帶入剛儲存的'+(stage==='pre'?'前測':'後測')+'五項資料。'+ageNote,'#16803c');
  // 雲端另一階段資料需明確查詢；CORS 失敗不影響本次顯示。
  // 允許使用者按「從雲端載入」比對另一階段。
  document.getElementById('gasStatusMsg')?.scrollIntoView({behavior:'smooth',block:'nearest'});
}

async function submitToGAS(e) {
  if(e?.preventDefault) e.preventDefault();
  const btn=document.getElementById('gasSubmitBtn');
  const stage=getRadarValue('testStage');
  const siteName=getRadarValue('siteName'), studentId=getRadarValue('studentId');
  const gender=getRadarValue('gender'), ageGroup=getRadarValue('ageGroup');
  const raw=readRadarInputs();
  if (!siteName || !studentId || !['pre','post'].includes(stage) ||
      !['M','F'].includes(gender) || !ageGroup || !raw) {
    setRadarStatus('❌ 請完整填寫據點、姓名、測驗階段、性別、年齡層及五項體能數值。','#dc2626');return;
  }
  // 強制以目前表單內容重新計算，避免儲存到切換階段前的舊數據。
  recalculateAll();
  const state=assessmentState[stage];
  if (!state?.raw || !state.scores.every(s=>s>=1 && s<=5)) {
    setRadarStatus('❌ 五項測驗資料不完整。','#dc2626');return;
  }
  const checked=id=>Boolean(document.getElementById(id)?.checked);
  const payload={
    action:'radarSubmit',
    siteName,studentId,
    participantCode:getRadarValue('participantCode').toUpperCase(),
    testStage:stage,gender,ageGroup,
    rawMetrics:state.raw,
    levelScores:state.scores,
    totalScore:state.scores.reduce((a,b)=>a+b,0),
    riskFlags:{frailty:checked('flagFrailty'),fall:checked('flagFall'),
      urine:checked('flagUrine'),nutrition:checked('flagNutrition'),cognition:checked('flagCog')},
    instructorName:getRadarValue('instructorName')
  };
  if (btn) btn.disabled=true;
  setRadarStatus('正在提交雷達圖資料...');
  try {
    // 若走同源代理可讀取明確成功/失敗回覆；直接呼叫 GAS 的 no-cors 無法確認寫入成功。
    const isProxy=RADAR_SUBMIT_URL.startsWith('/');
    const res=await fetch(RADAR_SUBMIT_URL,{
      method:'POST',mode:isProxy?'same-origin':'no-cors',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body:JSON.stringify(payload)
    });
    if(isProxy){
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      const data=await res.json();
      if(data.status!=='success') throw new Error(data.message||'後端未確認成功');
      setRadarStatus('✅ Google Sheets 已確認寫入雷達圖資料。','#16803c');
    } else {
      setRadarStatus('📨 已送出寫入請求，但瀏覽器無法確認 Google Sheets 是否儲存。請至「體能檢測資料庫」工作表核對。','#b45309');
    }
  } catch(err) {
    setRadarStatus('❌ 提交失敗：'+err.message,'#dc2626');
  } finally { if(btn) btn.disabled=false; }
}

document.addEventListener('DOMContentLoaded',()=>{
  initRadarChart();
  // 清除原始 HTML 中的示範數值，避免自動顯示為真實前測。
  fillRadarMetricInputs(null);
  updateSummaryTableOnly();
  applyOfficialFormHandoff();
});

// 前後測切換時顯示所選階段原值（不能把另一階段數據當成本階段測量）。
document.addEventListener('DOMContentLoaded',()=>{
  const stageEl=document.getElementById('testStage');
  if(stageEl) stageEl.addEventListener('change',()=>{
    const stage=stageEl.value;
    if(stage==='pre'||stage==='post') {
      fillRadarMetricInputs(assessmentState[stage].raw);
      recalculateAll();
    }
  });
});
