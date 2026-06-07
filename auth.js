// 说明：
// 1) 依赖 core.js 中已有的 SUPABASE_URL / SUPABASE_ANON_KEY（若存在）
// 2) 若 core.js 未注入，则使用下面的兜底配置
// 3) 所有关键状态优先写入 Supabase，前端 localStorage 仅做缓存

const GATE_CONFIG = {
  supabaseUrl: typeof SUPABASE_URL !== 'undefined'
    ? SUPABASE_URL
    : 'https://pjsyzkyvszakanbdjygz.supabase.co/rest/v1/',
  supabaseAnonKey: typeof SUPABASE_ANON_KEY !== 'undefined'
    ? SUPABASE_ANON_KEY
    : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqc3l6a3l2c3pha2FuYmRqeWd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NzEyMTQsImV4cCI6MjA5NjE0NzIxNH0.gnap4muK8tonRUkttA0vpONIHQTdIXvjXWlT9xKIRA4',
  quizTimeLimit: 30,
  quizFailCooldownMs: 10 * 60 * 1000,
  verifyCodeExpireMs: 15 * 60 * 1000,
  tokenExpireDays: 90,
  maxQuizFail: 3,
};

const TOKEN_KEY = 'mimi_gate_token';
const QUIZ_PASSED_KEY = 'mimi_quiz_passed';
const WEIBO_UID_KEY = 'mimi_weibo_uid';
const QUIZ_FAIL_KEY = 'mimi_quiz_fail';
const QUIZ_LAST_FAIL_KEY = 'mimi_quiz_last_fail';
const CURRENT_CODE_KEY = 'mimi_verify_code';
const CURRENT_CODE_TIME_KEY = 'mimi_verify_code_time';

let gateStep = 0; // 0=欢迎 1=答题 2=微博验证 3=成功
let currentQuiz = [];
let quizIndex = 0;
let quizCorrect = 0;
let quizTimer = null;
let quizTimeLeft = 0;
let generatedCode = '';
let codeGeneratedAt = 0;
let currentUid = '';

let quizFailCount = parseInt(localStorage.getItem(QUIZ_FAIL_KEY) || '0', 10);
let quizLastFail = parseInt(localStorage.getItem(QUIZ_LAST_FAIL_KEY) || '0', 10);

// ==================== Supabase 基础请求 ====================
function getSupabaseHeaders(extra = {}) {
  return Object.assign(
    {
      apikey: GATE_CONFIG.supabaseAnonKey,
      Authorization: 'Bearer ' + GATE_CONFIG.supabaseAnonKey,
      'Content-Type': 'application/json',
    },
    extra
  );
}

async function supabaseRequest(path, options = {}) {
  const url = GATE_CONFIG.supabaseUrl + path;
  const resp = await fetch(url, {
    ...options,
    headers: getSupabaseHeaders(options.headers || {}),
  });

  const text = await resp.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!resp.ok) {
    const msg = (data && data.message) || resp.statusText || 'Supabase request failed';
    throw new Error(msg);
  }

  return data;
}

function buildSupabaseRestPath(table, query = '') {
  return '/rest/v1/' + table + (query ? '?' + query : '');
}

function nowIso() {
  return new Date().toISOString();
}

function daysFromNow(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function isTokenValid(tokenData) {
  if (!tokenData) return false;
  return !!tokenData.expiresAt && tokenData.expiresAt > Date.now();
}

function getTokenData() {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveTokenData(tokenData) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokenData));
  localStorage.setItem(WEIBO_UID_KEY, tokenData.weiboUid || '');
}

function clearGateCache() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(QUIZ_PASSED_KEY);
  localStorage.removeItem(WEIBO_UID_KEY);
  localStorage.removeItem(CURRENT_CODE_KEY);
  localStorage.removeItem(CURRENT_CODE_TIME_KEY);
}

// ==================== 页面切换 ====================
function showGateStep(step) {
  gateStep = step;
  const pages = ['gateWelcome', 'gateQuiz', 'gateWeibo', 'gateSuccess'];
  pages.forEach(function (id, i) {
    const el = document.getElementById(id);
    if (el) el.style.display = i === step ? 'block' : 'none';
  });
}

function setButtonLoading(id, loading, loadingText, defaultText) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.disabled = !!loading;
  btn.textContent = loading ? loadingText : defaultText;
}

function safeAlert(message) {
  alert(message);
}

// ==================== 初始化 ====================
function initGate() {
  const tokenData = getTokenData();
  if (tokenData && isTokenValid(tokenData)) {
    enterMainPage();
    return;
  }

  if (localStorage.getItem(QUIZ_PASSED_KEY) === 'yes') {
    gateStep = 2;
  }

  showGateStep(gateStep);
}

// ==================== 欢迎页 ====================
function startGate() {
  gateStep = 1;
  showGateStep(1);
  startQuiz();
}

// ==================== 答题验证 ====================
function getRandomQuiz(count) {
  if (typeof window.getRandomQuiz === 'function') {
    return window.getRandomQuiz(count);
  }

  const fallback = [
    { question: '你是否认真阅读过入门说明？', options: ['是', '否', '不确定'], answer: 0 },
    { question: '完成门禁需要先通过哪一步？', options: ['答题', '发帖', '抽奖'], answer: 0 },
    { question: '验证码需要写在哪里？', options: ['微博简介', '私信', '评论区'], answer: 0 },
    { question: '服务端直验的作用是什么？', options: ['校验用户是否真的修改了简介', '加快页面动画', '生成头像'], answer: 0 },
    { question: 'token 主要用于什么？', options: ['登录态校验', '图片压缩', '题库加密'], answer: 0 },
  ];

  const pool = fallback.slice();
  const result = [];
  while (result.length < count && pool.length > 0) {
    const idx = Math.floor(Math.random() * pool.length);
    result.push(pool.splice(idx, 1)[0]);
  }
  return result;
}

function startQuiz() {
  if (quizFailCount >= GATE_CONFIG.maxQuizFail) {
    const elapsed = Date.now() - quizLastFail;
    if (elapsed < GATE_CONFIG.quizFailCooldownMs) {
      const mins = Math.ceil((GATE_CONFIG.quizFailCooldownMs - elapsed) / 60000);
      safeAlert('答题失败次数过多，请 ' + mins + ' 分钟后再试');
      return;
    }
    quizFailCount = 0;
    localStorage.setItem(QUIZ_FAIL_KEY, '0');
  }

  currentQuiz = getRandomQuiz(3);
  quizIndex = 0;
  quizCorrect = 0;
  renderQuizQuestion();
}

function renderQuizQuestion() {
  if (quizIndex >= currentQuiz.length) {
    finishQuiz();
    return;
  }

  const q = currentQuiz[quizIndex];
  const container = document.getElementById('quizContent');
  if (!container) return;

  quizTimeLeft = GATE_CONFIG.quizTimeLimit;
  clearInterval(quizTimer);
  updateTimerDisplay();

  quizTimer = setInterval(function () {
    quizTimeLeft--;
    updateTimerDisplay();

    if (quizTimeLeft <= 0) {
      clearInterval(quizTimer);
      quizIndex++;
      renderQuizQuestion();
    }
  }, 1000);

  container.innerHTML =
    '<div class="quiz-progress">第 ' + (quizIndex + 1) + ' / ' + currentQuiz.length + ' 题</div>' +
    '<div class="quiz-timer"><div class="quiz-timer-bar" id="timerBar"></div><span id="timerText">' + quizTimeLeft + 's</span></div>' +
    '<div class="quiz-question">' + q.question + '</div>' +
    '<div class="quiz-options">' +
    q.options
      .map(function (opt, i) {
        return '<button class="quiz-option" onclick="selectAnswer(' + i + ')">' + opt + '</button>';
      })
      .join('') +
    '</div>';
}

function updateTimerDisplay() {
  const bar = document.getElementById('timerBar');
  const text = document.getElementById('timerText');
  if (bar) bar.style.width = (quizTimeLeft / GATE_CONFIG.quizTimeLimit) * 100 + '%';
  if (text) text.textContent = quizTimeLeft + 's';
  if (bar) {
    bar.style.background = quizTimeLeft <= 5 ? '#ff4757' : quizTimeLeft <= 10 ? '#ffa502' : '#7bed9f';
  }
}

function selectAnswer(idx) {
  clearInterval(quizTimer);
  const q = currentQuiz[quizIndex];
  const btns = document.querySelectorAll('.quiz-option');
  btns.forEach(function (btn, i) {
    btn.disabled = true;
    if (i === q.answer) btn.classList.add('correct');
    if (i === idx && idx !== q.answer) btn.classList.add('wrong');
  });
  if (idx === q.answer) quizCorrect++;

  setTimeout(function () {
    quizIndex++;
    renderQuizQuestion();
  }, 800);
}

async function recordQuizAttempt(passed, questions, answers) {
  try {
    await supabaseRequest(buildSupabaseRestPath('quiz_attempts'), {
      method: 'POST',
      headers: {
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        weibo_uid: currentUid || null,
        questions: questions.map(function (q) { return q.question; }),
        answers: answers,
        passed: passed,
        created_at: nowIso(),
      }),
    });
  } catch (err) {
    console.warn('记录答题失败：', err.message);
  }
}

async function finishQuiz() {
  clearInterval(quizTimer);

  const passed = quizCorrect >= 3;
  const answers = currentQuiz.map(function (q) {
    return typeof q.answer === 'number' ? String(q.answer) : '';
  });

  await recordQuizAttempt(passed, currentQuiz, answers);

  if (passed) {
    localStorage.setItem(QUIZ_PASSED_KEY, 'yes');
    quizFailCount = 0;
    localStorage.setItem(QUIZ_FAIL_KEY, '0');
    gateStep = 2;
    showGateStep(2);
    return;
  }

  quizFailCount++;
  quizLastFail = Date.now();
  localStorage.setItem(QUIZ_FAIL_KEY, String(quizFailCount));
  localStorage.setItem(QUIZ_LAST_FAIL_KEY, String(quizLastFail));

  const container = document.getElementById('quizContent');
  if (container) {
    container.innerHTML =
      '<div class="quiz-result fail">' +
      '<div class="quiz-result-icon">😢</div>' +
      '<div class="quiz-result-text">答对 ' + quizCorrect + ' / ' + currentQuiz.length + ' 题</div>' +
      '<div class="quiz-result-hint">需要全部答对才能进入哦</div>' +
      (quizFailCount >= GATE_CONFIG.maxQuizFail
        ? '<div class="quiz-result-cooldown">失败次数过多，请10分钟后再试</div>'
        : '<button class="gate-btn" onclick="startQuiz()">再试一次</button>') +
      '</div>';
  }
}

// ==================== 微博验证 ====================
function generateVerifyCode() {
  const uidInput = document.getElementById('weiboUid');
  const uid = uidInput ? uidInput.value.trim() : '';

  if (!uid || !/^\d+$/.test(uid)) {
    safeAlert('请输入正确的微博UID（纯数字）');
    return;
  }

  currentUid = uid;

  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  generatedCode = '';
  for (let i = 0; i < 6; i++) {
    generatedCode += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  codeGeneratedAt = Date.now();
  localStorage.setItem(CURRENT_CODE_KEY, generatedCode);
  localStorage.setItem(CURRENT_CODE_TIME_KEY, String(codeGeneratedAt));

  const codeDisplay = document.getElementById('codeDisplay');
  if (codeDisplay) codeDisplay.textContent = generatedCode;

  const codeArea = document.getElementById('codeArea');
  if (codeArea) codeArea.style.display = 'block';

  if (uidInput) uidInput.readOnly = true;
}

async function syncVerifyCodeToServer(uid, code) {
  try {
    await supabaseRequest(buildSupabaseRestPath('verify_codes'), {
      method: 'POST',
      headers: {
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        weibo_uid: uid,
        code: code,
        verified: false,
        created_at: nowIso(),
        expires_at: new Date(Date.now() + GATE_CONFIG.verifyCodeExpireMs).toISOString(),
      }),
    });
  } catch (err) {
    console.warn('验证码写入 Supabase 失败：', err.message);
  }
}

async function doVerify() {
  if (!generatedCode) {
    safeAlert('请先获取验证码');
    return;
  }

  if (Date.now() - codeGeneratedAt > GATE_CONFIG.verifyCodeExpireMs) {
    safeAlert('验证码已过期，请重新获取');
    generatedCode = '';
    const codeArea = document.getElementById('codeArea');
    if (codeArea) codeArea.style.display = 'none';
    const uidInput = document.getElementById('weiboUid');
    if (uidInput) uidInput.readOnly = false;
    return;
  }

  const uidInput = document.getElementById('weiboUid');
  const uid = uidInput ? uidInput.value.trim() : currentUid;
  currentUid = uid;

  await syncVerifyCodeToServer(uid, generatedCode);

  const verifyBtn = document.getElementById('verifyBtn');
  if (verifyBtn) {
    verifyBtn.disabled = true;
    verifyBtn.textContent = '验证中...';
  }

  try {
    const resp = await fetch(GATE_CONFIG.supabaseUrl + '/functions/v1/verify-weibo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + GATE_CONFIG.supabaseAnonKey,
      },
      body: JSON.stringify({
        uid: uid,
        expectedCode: generatedCode,
      }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      throw new Error((data && data.error) || (data && data.message) || '微博验证失败');
    }

    if (data && data.bioMatch && data.isCPFan && Number(data.chaohuaLevel || 0) >= 7) {
      await gateRegisterSuccess(uid, data);
    } else {
      let reason = '';
      if (!data.bioMatch) reason += '简介验证码不匹配（请确认已修改简介）\n';
      if (!data.isCPFan) reason += '未加入目标超话\n';
      if (Number(data.chaohuaLevel || 0) < 7) reason += '超话等级不足7级（当前：' + (data.chaohuaLevel || 0) + '级）\n';
      safeAlert('验证未通过：\n' + reason);
    }
  } catch (err) {
    console.error('验证失败:', err);
    safeAlert('验证服务暂时不可用，请稍后再试\n错误: ' + err.message);
  } finally {
    if (verifyBtn) {
      verifyBtn.disabled = false;
      verifyBtn.textContent = '🔍 验证';
    }
  }
}

// ==================== 注册成功与落库 ====================
async function gateRegisterSuccess(uid, weiboData) {
  const tokenData = {
    weiboUid: uid,
    weiboName: weiboData.weiboName || '',
    avatarUrl: weiboData.avatarUrl || '',
    chaohuaLevel: Number(weiboData.chaohuaLevel || 0),
    createdAt: Date.now(),
    expiresAt: Date.now() + GATE_CONFIG.tokenExpireDays * 24 * 60 * 60 * 1000,
  };

  saveTokenData(tokenData);

  try {
    await supabaseRequest(buildSupabaseRestPath('mimi_users'), {
      method: 'POST',
      headers: {
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        weibo_uid: uid,
        weibo_name: tokenData.weiboName,
        weibo_avatar_url: tokenData.avatarUrl,
        chaohua_level: tokenData.chaohuaLevel,
        quiz_passed: true,
        token: JSON.stringify(tokenData),
        token_expires_at: new Date(tokenData.expiresAt).toISOString(),
        status: 'active',
        last_active_at: nowIso(),
      }),
    });

    await supabaseRequest(buildSupabaseRestPath('verify_codes', 'weibo_uid=eq.' + encodeURIComponent(uid) + '&order=created_at.desc&limit=1'), {
      method: 'PATCH',
      body: JSON.stringify({ verified: true }),
    });
  } catch (err) {
    console.warn('Supabase 落库失败：', err.message);
  }

  gateStep = 3;
  showGateStep(3);
}

// ==================== 进入主页 ====================
function enterMainPage() {
  const tokenData = getTokenData();
  if (!tokenData) return;

  if (typeof currentUser === 'undefined') {
    window.currentUser = null;
  }
  if (typeof isAdmin === 'undefined') window.isAdmin = false;
  if (typeof isSuper === 'undefined') window.isSuper = false;

  window.currentUser = {
    name: tokenData.weiboName || tokenData.weiboUid,
    type: 'student',
    uid: tokenData.weiboUid,
  };
  window.isAdmin = false;
  window.isSuper = false;

  sessionStorage.setItem('mimi_current_user', JSON.stringify(window.currentUser));

  const authPage = document.getElementById('authPage');
  const mainPage = document.getElementById('mainPage');
  if (authPage) authPage.style.display = 'none';
  if (mainPage) mainPage.style.display = 'block';

  const userDisp = document.getElementById('userDisp');
  if (userDisp) userDisp.innerText = (tokenData.weiboName || tokenData.weiboUid) + ' (UID:' + tokenData.weiboUid + ')';

  const adminEls = ['passBtn', 'adminManageBtn', 'adminDateSet', 'adminBtnS', 'adminBtnT', 'adminCatBtn'];
  adminEls.forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  if (typeof renderAll === 'function') renderAll();
  if (typeof isExplicitlyPaused !== 'undefined' && !isExplicitlyPaused && typeof autoPlayAttempt === 'function') {
    autoPlayAttempt();
  }
}

// ==================== 登出 ====================
function gateLogout() {
  clearGateCache();
  location.reload();
}

// ==================== 自动登录检查 ====================
async function checkTokenWithServer(tokenData) {
  try {
    const uid = tokenData.weiboUid || '';
    if (!uid) return false;

    const { data } = await fetch(GATE_CONFIG.supabaseUrl + '/rest/v1/mimi_users?weibo_uid=eq.' + encodeURIComponent(uid) + '&select=weibo_uid,status,token_expires_at,token,last_active_at', {
      method: 'GET',
      headers: getSupabaseHeaders({}),
    }).then(function (resp) {
      return resp.json().then(function (json) {
        if (!resp.ok) throw new Error((json && json.message) || 'check token failed');
        return { data: json };
      });
    });

    if (!data || !data.length) return false;
    const row = data[0];
    if (row.status && row.status !== 'active') return false;
    return true;
  } catch (err) {
    console.warn('Token 校验失败：', err.message);
    return true; // 网络失败时先放行本地 token，避免误伤用户
  }
}

async function autoLogin() {
  const tokenData = getTokenData();
  if (tokenData && isTokenValid(tokenData)) {
    const ok = await checkTokenWithServer(tokenData);
    if (ok) {
      enterMainPage();
      return true;
    }
  }

  if (localStorage.getItem(QUIZ_PASSED_KEY) === 'yes') {
    gateStep = 2;
  }

  showGateStep(gateStep);
  return false;
}

// ==================== 可选：token 续期 ====================
async function renewToken() {
  const tokenData = getTokenData();
  if (!tokenData) {
    safeAlert('当前没有可续期的登录态');
    return false;
  }

  try {
    const resp = await fetch(GATE_CONFIG.supabaseUrl + '/api/auth/renew', {
      method: 'POST',
      headers: getSupabaseHeaders(),
      body: JSON.stringify({ weibo_uid: tokenData.weiboUid, token: JSON.stringify(tokenData) }),
    });

    const data = await resp.json();
    if (!resp.ok) throw new Error((data && data.message) || '续期失败');

    const newTokenData = {
      ...tokenData,
      createdAt: Date.now(),
      expiresAt: Date.now() + GATE_CONFIG.tokenExpireDays * 24 * 60 * 60 * 1000,
    };
    saveTokenData(newTokenData);
    return true;
  } catch (err) {
    console.warn('token 续期失败：', err.message);
    return false;
  }
}

// ==================== 暴露到全局 ====================
window.initGate = initGate;
window.startGate = startGate;
window.startQuiz = startQuiz;
window.selectAnswer = selectAnswer;
window.generateVerifyCode = generateVerifyCode;
window.doVerify = doVerify;
window.gateLogout = gateLogout;
window.enterMainPage = enterMainPage;
window.autoLogin = autoLogin;
window.renewToken = renewToken;
window.showGateStep = showGateStep;

// ==================== 页面加载时初始化 ====================
document.addEventListener('DOMContentLoaded', function () {
  autoLogin();
});
