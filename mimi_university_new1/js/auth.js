// ==================== 粉丝门禁系统 ====================
// V2.0 - 微博验证 + 答题验证 + 超话等级检查

const SUPABASE_URL = "https://abdjwwhwpuvvfvenvmtx.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_lhJEVj76ZpvRuf2XRoB31A_lLHDuAdf";
const TOKEN_KEY = "mimi_gate_token";
const QUIZ_PASSED_KEY = "mimi_quiz_passed";
const WEIBO_UID_KEY = "mimi_weibo_uid";
const TOKEN_EXPIRE_DAYS = 90;
const QUIZ_TIME_LIMIT = 30; // 每题秒数
const QUIZ_FAIL_COOLDOWN = 10 * 60 * 1000; // 10分钟冷却
const VERIFY_CODE_EXPIRE = 15 * 60 * 1000; // 15分钟过期
const MAX_QUIZ_FAIL = 3;

let gateStep = 0; // 0=欢迎 1=答题 2=微博验证 3=成功
let currentQuiz = [];
let quizIndex = 0;
let quizCorrect = 0;
let quizTimer = null;
let quizTimeLeft = 0;
let quizFailCount = parseInt(localStorage.getItem('mimi_quiz_fail') || '0');
let quizLastFail = parseInt(localStorage.getItem('mimi_quiz_last_fail') || '0');
let generatedCode = '';
let codeGeneratedAt = 0;

// ==================== 初始化 ====================
function initGate() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token && isTokenValid(token)) {
        // 已有有效token，直接进入
        enterMainPage();
        return;
    }
    // 检查答题是否已通过
    if (localStorage.getItem(QUIZ_PASSED_KEY) === 'yes') {
        gateStep = 2;
    }
    showGateStep(gateStep);
}

function isTokenValid(token) {
    try {
        const data = JSON.parse(token);
        return data.expiresAt > Date.now();
    } catch { return false; }
}

function getTokenData() {
    try {
        return JSON.parse(localStorage.getItem(TOKEN_KEY));
    } catch { return null; }
}

// ==================== 页面切换 ====================
function showGateStep(step) {
    gateStep = step;
    const pages = ['gateWelcome', 'gateQuiz', 'gateWeibo', 'gateSuccess'];
    pages.forEach(function(id, i) {
        const el = document.getElementById(id);
        if (el) el.style.display = (i === step) ? 'block' : 'none';
    });
}

// ==================== 欢迎页 ====================
function startGate() {
    gateStep = 1;
    showGateStep(1);
    startQuiz();
}

// ==================== 答题验证 ====================
function startQuiz() {
    // 检查冷却
    if (quizFailCount >= MAX_QUIZ_FAIL) {
        const elapsed = Date.now() - quizLastFail;
        if (elapsed < QUIZ_FAIL_COOLDOWN) {
            const mins = Math.ceil((QUIZ_FAIL_COOLDOWN - elapsed) / 60000);
            alert('答题失败次数过多，请' + mins + '分钟后再试');
            return;
        }
        quizFailCount = 0;
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

    // 倒计时
    quizTimeLeft = QUIZ_TIME_LIMIT;
    clearInterval(quizTimer);
    updateTimerDisplay();

    quizTimer = setInterval(function() {
        quizTimeLeft--;
        updateTimerDisplay();
        if (quizTimeLeft <= 0) {
            clearInterval(quizTimer);
            // 超时判错
            quizIndex++;
            renderQuizQuestion();
        }
    }, 1000);

    container.innerHTML = '<div class="quiz-progress">第 ' + (quizIndex + 1) + ' / ' + currentQuiz.length + ' 题</div>' +
        '<div class="quiz-timer"><div class="quiz-timer-bar" id="timerBar"></div><span id="timerText">' + quizTimeLeft + 's</span></div>' +
        '<div class="quiz-question">' + q.question + '</div>' +
        '<div class="quiz-options">' +
        q.options.map(function(opt, i) {
            return '<button class="quiz-option" onclick="selectAnswer(' + i + ')">' + opt + '</button>';
        }).join('') +
        '</div>';
}

function updateTimerDisplay() {
    const bar = document.getElementById('timerBar');
    const text = document.getElementById('timerText');
    if (bar) bar.style.width = (quizTimeLeft / QUIZ_TIME_LIMIT * 100) + '%';
    if (text) text.textContent = quizTimeLeft + 's';
    if (bar) {
        bar.style.background = quizTimeLeft <= 5 ? '#ff4757' : quizTimeLeft <= 10 ? '#ffa502' : '#7bed9f';
    }
}

function selectAnswer(idx) {
    clearInterval(quizTimer);
    const q = currentQuiz[quizIndex];
    const btns = document.querySelectorAll('.quiz-option');
    btns.forEach(function(btn, i) {
        btn.disabled = true;
        if (i === q.answer) btn.classList.add('correct');
        if (i === idx && idx !== q.answer) btn.classList.add('wrong');
    });
    if (idx === q.answer) quizCorrect++;

    setTimeout(function() {
        quizIndex++;
        renderQuizQuestion();
    }, 800);
}

function finishQuiz() {
    clearInterval(quizTimer);
    if (quizCorrect >= 3) {
        localStorage.setItem(QUIZ_PASSED_KEY, 'yes');
        quizFailCount = 0;
        localStorage.setItem('mimi_quiz_fail', '0');
        gateStep = 2;
        showGateStep(2);
    } else {
        quizFailCount++;
        localStorage.setItem('mimi_quiz_fail', String(quizFailCount));
        localStorage.setItem('mimi_quiz_last_fail', String(Date.now()));
        const container = document.getElementById('quizContent');
        if (container) {
            container.innerHTML = '<div class="quiz-result fail">' +
                '<div class="quiz-result-icon">😢</div>' +
                '<div class="quiz-result-text">答对 ' + quizCorrect + ' / ' + currentQuiz.length + ' 题</div>' +
                '<div class="quiz-result-hint">需要全部答对才能进入哦</div>' +
                (quizFailCount >= MAX_QUIZ_FAIL ?
                    '<div class="quiz-result-cooldown">失败次数过多，请10分钟后再试</div>' :
                    '<button class="gate-btn" onclick="startQuiz()">再试一次</button>') +
                '</div>';
        }
    }
}

// ==================== 微博验证 ====================
function generateVerifyCode() {
    const uid = document.getElementById('weiboUid').value.trim();
    if (!uid || !/^\d+$/.test(uid)) {
        alert('请输入正确的微博UID（纯数字）');
        return;
    }
    // 生成6位验证码
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    generatedCode = '';
    for (var i = 0; i < 6; i++) {
        generatedCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    codeGeneratedAt = Date.now();

    const codeDisplay = document.getElementById('codeDisplay');
    if (codeDisplay) codeDisplay.textContent = generatedCode;

    const codeArea = document.getElementById('codeArea');
    if (codeArea) codeArea.style.display = 'block';

    const uidInput = document.getElementById('weiboUid');
    if (uidInput) uidInput.readOnly = true;
}

async function doVerify() {
    if (!generatedCode) {
        alert('请先获取验证码');
        return;
    }
    // 检查验证码是否过期
    if (Date.now() - codeGeneratedAt > VERIFY_CODE_EXPIRE) {
        alert('验证码已过期，请重新获取');
        generatedCode = '';
        document.getElementById('codeArea').style.display = 'none';
        document.getElementById('weiboUid').readOnly = false;
        return;
    }

    const uid = document.getElementById('weiboUid').value.trim();
    const verifyBtn = document.getElementById('verifyBtn');
    if (verifyBtn) {
        verifyBtn.disabled = true;
        verifyBtn.textContent = '验证中...';
    }

    try {
        // 调用Supabase Edge Function验证
        const resp = await fetch(SUPABASE_URL + '/functions/v1/verify-weibo', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
            },
            body: JSON.stringify({ uid: uid, expectedCode: generatedCode })
        });

        const data = await resp.json();

        if (data.bioMatch && data.isCPFan && data.chaohuaLevel >= 7) {
            // 验证通过
            gateRegisterSuccess(uid, data);
        } else {
            // 验证失败，给出具体原因
            var reason = '';
            if (!data.bioMatch) reason += '简介验证码不匹配（请确认已修改简介）\n';
            if (!data.isCPFan) reason += '未加入栩你渝生超话\n';
            if (data.chaohuaLevel < 7) reason += '超话等级不足7级（当前：' + (data.chaohuaLevel || 0) + '级）\n';
            alert('验证未通过：\n' + reason);
        }
    } catch (err) {
        console.error('验证失败:', err);
        // 降级：如果Edge Function不可用，暂时允许通过（仅验证码匹配）
        alert('验证服务暂时不可用，请稍后再试\n错误: ' + err.message);
    } finally {
        if (verifyBtn) {
            verifyBtn.disabled = false;
            verifyBtn.textContent = '🔍 验证';
        }
    }
}

function gateRegisterSuccess(uid, weiboData) {
    // 生成token
    var tokenData = {
        weiboUid: uid,
        weiboName: weiboData.weiboName || '',
        avatarUrl: weiboData.avatarUrl || '',
        chaohuaLevel: weiboData.chaohuaLevel || 0,
        createdAt: Date.now(),
        expiresAt: Date.now() + TOKEN_EXPIRE_DAYS * 24 * 60 * 60 * 1000
    };
    localStorage.setItem(TOKEN_KEY, JSON.stringify(tokenData));
    localStorage.setItem(WEIBO_UID_KEY, uid);

    // 写入Supabase
    saveUserToSupabase(uid, tokenData);

    gateStep = 3;
    showGateStep(3);
}

async function saveUserToSupabase(uid, tokenData) {
    try {
        await fetch(SUPABASE_URL + '/rest/v1/mimi_users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
                'Prefer': 'return=minimal'
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
                last_active_at: new Date().toISOString()
            })
        });
    } catch (e) {
        console.error('Supabase保存失败:', e);
    }
}

// ==================== 进入主页 ====================
function enterMainPage() {
    var tokenData = getTokenData();
    if (!tokenData) return;

    // 设置全局用户信息（兼容现有系统）
    currentUser = { name: tokenData.weiboName || tokenData.weiboUid, type: 'student', uid: tokenData.weiboUid };
    isAdmin = false;
    isSuper = false;
    sessionStorage.setItem('mimi_current_user', JSON.stringify(currentUser));

    var authPage = document.getElementById('authPage');
    var mainPage = document.getElementById('mainPage');
    if (authPage) authPage.style.display = 'none';
    if (mainPage) mainPage.style.display = 'block';

    // 显示用户信息
    var userDisp = document.getElementById('userDisp');
    if (userDisp) userDisp.innerText = (tokenData.weiboName || tokenData.weiboUid) + ' (UID:' + tokenData.weiboUid + ')';

    // 隐藏管理员按钮
    var adminEls = ['passBtn', 'adminManageBtn', 'adminDateSet', 'adminBtnS', 'adminBtnT', 'adminCatBtn'];
    adminEls.forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    // 渲染
    if (typeof renderAll === 'function') renderAll();
    if (!isExplicitlyPaused) autoPlayAttempt();
}

// ==================== 登出 ====================
function gateLogout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(QUIZ_PASSED_KEY);
    location.reload();
}

// ==================== 自动登录检查 ====================
function autoLogin() {
    var token = localStorage.getItem(TOKEN_KEY);
    if (token && isTokenValid(token)) {
        enterMainPage();
        return true;
    }
    // token过期但答题已通过，直接跳到微博验证
    if (localStorage.getItem(QUIZ_PASSED_KEY) === 'yes') {
        gateStep = 2;
    }
    showGateStep(gateStep);
    return false;
}

// ==================== 页面加载时初始化 ====================
document.addEventListener('DOMContentLoaded', function() {
    autoLogin();
});
