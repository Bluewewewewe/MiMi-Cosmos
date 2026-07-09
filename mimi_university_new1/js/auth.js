// ==================== 粉丝门禁系统 ====================
// V2.0 - 微博验证 + 答题验证 + 超话等级检查

// SUPABASE_URL 和 SUPABASE_ANON_KEY 已在 core.js 中声明，此处不再重复
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
        // 方案1: 尝试后端 API 验证（需要服务器端有有效Cookie）
        const savedCookie = localStorage.getItem('weibo_sub_cookie') || '';
        const resp = await fetch('/api/verify-weibo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid: uid, expectedCode: generatedCode, cookie: savedCookie })
        });

        const data = await resp.json();

        // 如果后端成功获取到微博数据
        if (data.weiboName) {
            if (data.bioMatch && data.isCPFan && data.chaohuaLevel >= 7) {
                gateRegisterSuccess(uid, data);
            } else {
                var reason = '';
                if (!data.bioMatch) reason += '简介验证码不匹配（请确认已修改简介）\n';
                if (!data.isCPFan) reason += '未加入栩你渝生超话\n';
                if (data.chaohuaLevel < 7) reason += '超话等级不足7级（当前：' + (data.chaohuaLevel || 0) + '级）\n';
                alert('验证未通过：\n' + reason);
            }
        } else {
            // 方案2: 后端无法获取数据（Cookie无效），切换到浏览器端验证
            showBrowserVerify(uid, generatedCode);
        }
    } catch (err) {
        console.error('验证失败:', err);
        // 网络错误也切换到浏览器端验证
        showBrowserVerify(uid, generatedCode);
    } finally {
        if (verifyBtn) {
            verifyBtn.disabled = false;
            verifyBtn.textContent = '🔍 验证';
        }
    }
}

// ==================== 浏览器端验证（Cookie在用户浏览器中有效） ====================
function showBrowserVerify(uid, code) {
    var step2 = document.getElementById('gateStep2');
    if (!step2) return;

    step2.innerHTML =
        '<div style="text-align:center;padding:20px;">' +
        '<h3 style="color:#c0e070;margin-bottom:15px;">📋 浏览器端验证</h3>' +
        '<p style="color:#aaa;margin-bottom:10px;font-size:14px;">服务器无法直接访问微博，请按以下步骤操作：</p>' +

        '<div style="background:rgba(255,255,255,0.05);border-radius:12px;padding:15px;margin:10px 0;text-align:left;font-size:13px;line-height:1.8;">' +
        '<p><b style="color:#c0e070;">步骤1：</b>确保你已将验证码 <b style="color:#ff6b6b;font-size:16px;">' + code + '</b> 写入微博简介</p>' +
        '<p><b style="color:#c0e070;">步骤2：</b>点击下方按钮打开微博页面</p>' +
        '<p><b style="color:#c0e070;">步骤3：</b>在微博页面按 F12 → Console（控制台）</p>' +
        '<p><b style="color:#c0e070;">步骤4：</b>复制下方代码，粘贴到控制台并回车</p>' +
        '<p><b style="color:#c0e070;">步骤5：</b>将弹出的验证结果复制回来</p>' +
        '</div>' +

        '<div style="margin:10px 0;">' +
        '<a href="https://weibo.com/u/' + uid + '" target="_blank" style="display:inline-block;background:#ff8200;color:white;padding:10px 25px;border-radius:8px;text-decoration:none;margin:5px;">打开我的微博主页</a>' +
        '<a href="https://weibo.com/p/1008085cf0862440cd3b74d986d8f0618870e0" target="_blank" style="display:inline-block;background:#ff6b6b;color:white;padding:10px 25px;border-radius:8px;text-decoration:none;margin:5px;">打开栩你渝生超话</a>' +
        '</div>' +

        '<div style="background:#1a1a2e;border-radius:8px;padding:10px;margin:10px 0;text-align:left;position:relative;">' +
        '<button onclick="copyVerifyScript()" style="position:absolute;top:5px;right:5px;background:#c0e070;color:#000;border:none;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:12px;">复制代码</button>' +
        '<code id="verifyScript" style="font-size:11px;color:#c0e070;word-break:break-all;white-space:pre-wrap;display:block;padding-right:60px;">' + getVerifyScript(uid, code) + '</code>' +
        '</div>' +

        '<div style="margin:15px 0;">' +
        '<p style="color:#aaa;font-size:13px;margin-bottom:8px;">粘贴验证结果：</p>' +
        '<textarea id="browserVerifyResult" placeholder="在此粘贴控制台输出的验证结果..." style="width:90%;height:80px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:white;padding:10px;font-size:12px;resize:none;"></textarea>' +
        '</div>' +

        '<button onclick="submitBrowserVerify()" style="background:#c0e070;color:#000;border:none;padding:12px 30px;border-radius:8px;cursor:pointer;font-size:15px;font-weight:bold;">提交验证</button>' +
        '<button onclick="showGateStep(2)" style="background:transparent;color:#aaa;border:1px solid rgba(255,255,255,0.2);padding:12px 20px;border-radius:8px;cursor:pointer;font-size:13px;margin-left:10px;">返回重试</button>' +
        '</div>';
}

function getVerifyScript(uid, code) {
    var domain = window.location.origin;
    return "fetch('" + domain + "/api/verify-weibo-browser',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uid:'" + uid + "',code:'" + code + "'})}).then(r=>r.json()).then(d=>{prompt('请复制以下验证结果：',JSON.stringify(d))}).catch(e=>alert('错误:'+e.message))";
}

function copyVerifyScript() {
    var script = document.getElementById('verifyScript');
    if (script) {
        navigator.clipboard.writeText(script.textContent).then(function() {
            alert('代码已复制！请到微博页面的控制台粘贴执行');
        });
    }
}

async function submitBrowserVerify() {
    var resultEl = document.getElementById('browserVerifyResult');
    if (!resultEl || !resultEl.value.trim()) {
        alert('请粘贴验证结果');
        return;
    }

    try {
        var data = JSON.parse(resultEl.value.trim());
        var uid = document.getElementById('weiboUid') ?
            (document.getElementById('weiboUid').value.trim() || localStorage.getItem('mimi_weibo_uid')) :
            localStorage.getItem('mimi_weibo_uid');

        // 提交到后端验证结果
        var resp = await fetch('/api/verify-weibo-browser', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid: uid, verifyData: data })
        });
        var result = await resp.json();

        if (result.success) {
            gateRegisterSuccess(uid, result.user || data);
        } else {
            var reason = result.reason || '信息不匹配';
            alert('验证未通过：\n' + reason);
        }
    } catch (e) {
        alert('验证结果格式错误，请重新复制：' + e.message);
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
        var resp = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                weibo_uid: uid,
                weibo_name: tokenData.weiboName || '',
                avatar_url: tokenData.avatarUrl || '',
                chaohua_level: tokenData.chaohuaLevel || 0
            })
        });
        var result = await resp.json();
        if (result.user) {
            console.log('[米米宇宙] 用户数据已保存到数据库');
        } else {
            console.warn('[米米宇宙] 用户数据保存失败:', result.error);
        }
    } catch (e) {
        console.warn('[米米宇宙] 用户数据保存失败:', e.message);
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
    // 开发模式：URL 带 ?skip=1 直接跳过门禁
    var params = new URLSearchParams(window.location.search);
    if (params.get('skip') === '1') {
        if (!localStorage.getItem(TOKEN_KEY)) {
            localStorage.setItem(TOKEN_KEY, JSON.stringify({name:"admin",type:"admin",ts:Date.now()}));
        }
        enterMainPage();
        return true;
    }

    var token = localStorage.getItem(TOKEN_KEY);
    if (token && isTokenValid(token)) {
        enterMainPage();
        return true;
    }

    // 答题通过但未完成微博验证，显示验证步骤
    if (localStorage.getItem(QUIZ_PASSED_KEY) === 'yes') {
        gateStep = 2;
        showGateStep(2);
        return true;
    }

    showGateStep(gateStep);
    return false;
}

// ==================== 彩蛋：连点 🌽 跳过门禁 ====================
(function() {
    var cornClicks = 0, cornTimer = null;
    document.addEventListener('click', function(e) {
        if (e.target.textContent === '🌽' && e.target.classList.contains('gate-welcome-icon')) {
            cornClicks++;
            clearTimeout(cornTimer);
            cornTimer = setTimeout(function() { cornClicks = 0; }, 2000);
            if (cornClicks >= 5) {
                cornClicks = 0;
                e.target.style.transition = 'transform 0.4s';
                e.target.style.transform = 'scale(1.5) rotate(360deg)';
                setTimeout(function() {
                    localStorage.setItem(TOKEN_KEY, JSON.stringify({name:"admin",type:"admin",ts:Date.now()}));
                    enterMainPage();
                }, 400);
            }
        }
    });
})();

// ==================== 页面加载时初始化 ====================
document.addEventListener('DOMContentLoaded', function() {
    autoLogin();
});
