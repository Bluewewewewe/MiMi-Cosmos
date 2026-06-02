/**
 * MiMi-Cosmos 粉丝门禁系统
 * 基于微博验证 + 答题验证的门禁机制
 */

// ==================== 配置常量 ====================
const GATE_CONFIG = {
    QUIZ_COUNT: 3,                    // 每轮题目数量
    QUIZ_TIME_LIMIT: 30,              // 每题限时（秒）
    QUIZ_MAX_ATTEMPTS: 3,             // 最大答题尝试次数
    QUIZ_COOLDOWN: 10 * 60 * 1000,   // 答题失败冷却时间（10分钟）
    CODE_EXPIRY: 15 * 60 * 1000,     // 验证码有效期（15分钟）
    REGISTER_EXPIRY: 30 * 60 * 1000, // 注册全流程有效期（30分钟）
    TOKEN_VALIDITY: 90 * 24 * 60 * 60 * 1000, // Token有效期（90天）
    CHAOHUA_LEVEL_REQUIRED: 7,        // 所需超话等级
    CHAOHUA_CHECK_INTERVAL: 30 * 24 * 60 * 60 * 1000 // 超话复查间隔（30天）
};

// Supabase 配置
const SUPABASE_URL = "https://abdjwwhwpuvvfvenvmtx.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_lhJEVj76ZpvRuf2XRoB31A_lLHDuAdf";

// ==================== 全局状态 ====================
let gateState = {
    currentStep: 'welcome',           // welcome | quiz | weibo | success
    currentQuestions: [],
    currentQuestionIndex: 0,
    quizStartTime: null,
    timerInterval: null,
    quizAttempts: 0,
    lastQuizAttempt: 0,
    quizPassed: false,
    weiboUid: '',
    verifyCode: '',
    codeGeneratedAt: null,
    userToken: '',
    tokenCreatedAt: null
};

// ==================== 门禁页面元素 ====================
const gateElements = {
    welcomePage: null,
    quizPage: null,
    weiboPage: null,
    successPage: null
};

// ==================== 工具函数 ====================

/**
 * 生成6位随机验证码
 */
function generateVerifyCode() {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

/**
 * 生成用户Token
 */
function generateUserToken(weiboUid) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    const data = `${weiboUid}-${timestamp}-${random}`;
    // 简单的 Base64 编码
    return btoa(unescape(encodeURIComponent(data)));
}

/**
 * 格式化时间（秒转为 MM:SS）
 */
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * 检查答题冷却
 */
function isInQuizCooldown() {
    const now = Date.now();
    return (now - gateState.lastQuizAttempt) < GATE_CONFIG.QUIZ_COOLDOWN;
}

/**
 * 获取剩余冷却时间
 */
function getRemainingCooldown() {
    const elapsed = Date.now() - gateState.lastQuizAttempt;
    return Math.max(0, GATE_CONFIG.QUIZ_COOLDOWN - elapsed);
}

/**
 * 检查Token是否有效
 */
function isTokenValid(tokenData) {
    if (!tokenData || !tokenData.token) return false;
    const elapsed = Date.now() - tokenData.createdAt;
    return elapsed < GATE_CONFIG.TOKEN_VALIDITY;
}

/**
 * 保存Token到localStorage
 */
function saveToken(weiboUid, token, weiboName = '', chaohuaLevel = 0) {
    const tokenData = {
        token,
        weiboUid,
        weiboName,
        chaohuaLevel,
        createdAt: Date.now(),
        expiresAt: Date.now() + GATE_CONFIG.TOKEN_VALIDITY
    };
    localStorage.setItem('mimi_gate_token', JSON.stringify(tokenData));
    
    // 同时更新userDB（兼容现有逻辑）
    const userName = weiboName || `粉丝${weiboUid.slice(-4)}`;
    userDB[userName] = {
        uid: `UID${weiboUid.slice(-4)}`,
        token,
        weiboUid,
        weiboName,
        chaohuaLevel,
        type: 'fan',
        email: ''
    };
    saveAll();
    
    return tokenData;
}

/**
 * 从localStorage获取Token
 */
function getStoredToken() {
    try {
        const data = localStorage.getItem('mimi_gate_token');
        return data ? JSON.parse(data) : null;
    } catch {
        return null;
    }
}

/**
 * 清除Token
 */
function clearToken() {
    localStorage.removeItem('mimi_gate_token');
}

// ==================== 页面切换 ====================

/**
 * 显示指定页面，隐藏其他页面
 */
function showGateStep(step) {
    gateState.currentStep = step;
    
    const pages = ['welcomePage', 'quizPage', 'weiboPage', 'successPage'];
    pages.forEach(pageId => {
        const el = gateElements[pageId];
        if (el) {
            el.style.display = pageId === `${step}Page` ? 'block' : 'none';
        }
    });
}

/**
 * 初始化门禁页面
 */
function initGatePage() {
    // 获取页面元素
    gateElements.welcomePage = document.getElementById('gateWelcomePage');
    gateElements.quizPage = document.getElementById('gateQuizPage');
    gateElements.weiboPage = document.getElementById('gateWeiboPage');
    gateElements.successPage = document.getElementById('gateSuccessPage');
    
    // 检查是否有有效Token
    const storedToken = getStoredToken();
    if (storedToken && isTokenValid(storedToken)) {
        // Token有效，自动登录
        autoLoginWithToken(storedToken);
        return;
    }
    
    // 显示欢迎页面
    showGateStep('welcome');
    
    // 检查答题冷却
    updateCooldownDisplay();
}

/**
 * 自动登录（Token方式）
 */
function autoLoginWithToken(tokenData) {
    const userName = tokenData.weiboName || `粉丝${tokenData.weiboUid.slice(-4)}`;
    
    // 设置用户状态
    currentUser = {
        name: userName,
        type: 'fan',
        uid: `UID${tokenData.weiboUid.slice(-4)}`,
        weiboUid: tokenData.weiboUid,
        chaohuaLevel: tokenData.chaohuaLevel
    };
    isAdmin = false;
    isSuper = false;
    isTeacher = false;
    
    sessionStorage.setItem("mimi_current_user", JSON.stringify({
        name: userName,
        type: 'fan',
        uid: `UID${tokenData.weiboUid.slice(-4)}`
    }));
    
    // 隐藏门禁页面，显示主页面
    document.getElementById("authPage").style.display = "none";
    document.getElementById("mainPage").style.display = "block";
    
    // 设置用户显示
    document.getElementById("userDisp").innerText = userName + ` (微博用户)`;
    
    // 隐藏管理相关按钮
    document.getElementById("teacherSelfBtn").style.display = "none";
    document.getElementById("passBtn").style.display = "none";
    document.getElementById("adminManageBtn").style.display = "none";
    document.getElementById("adminDateSet").style.display = "none";
    document.getElementById("adminBtnS").style.display = "none";
    document.getElementById("adminBtnT").style.display = "none";
    document.getElementById("adminCatBtn").style.display = "none";
    
    // 渲染页面
    renderAll();
    
    // 启动音乐
    if (!isExplicitlyPaused) startPlay();
    
    // 更新最后活跃时间
    tokenData.lastActiveAt = Date.now();
    localStorage.setItem('mimi_gate_token', JSON.stringify(tokenData));
}

// ==================== 欢迎页面操作 ====================

/**
 * 开始答题验证
 */
function startQuizVerification() {
    // 检查冷却
    if (isInQuizCooldown()) {
        const remaining = getRemainingCooldown();
        alert(`答题过于频繁，请 ${formatTime(Math.ceil(remaining / 1000))} 后再试`);
        updateCooldownDisplay();
        return;
    }
    
    // 获取随机题目
    gateState.currentQuestions = getRandomQuestions(GATE_CONFIG.QUIZ_COUNT);
    gateState.currentQuestionIndex = 0;
    gateState.quizPassed = false;
    
    // 显示答题页面
    showGateStep('quiz');
    
    // 渲染第一题
    renderCurrentQuestion();
}

/**
 * 更新冷却时间显示
 */
function updateCooldownDisplay() {
    const cooldownEl = document.getElementById('quizCooldown');
    if (!cooldownEl) return;
    
    if (isInQuizCooldown()) {
        const remaining = getRemainingCooldown();
        cooldownEl.style.display = 'block';
        cooldownEl.innerHTML = `<span class="cooldown-text">⏰ 冷却中，请 ${formatTime(Math.ceil(remaining / 1000))} 后再试</span>`;
        setTimeout(updateCooldownDisplay, 1000);
    } else {
        cooldownEl.style.display = 'none';
    }
}

// ==================== 答题逻辑 ====================

/**
 * 渲染当前题目
 */
function renderCurrentQuestion() {
    const question = gateState.currentQuestions[gateState.currentQuestionIndex];
    if (!question) {
        quizComplete();
        return;
    }
    
    const container = document.getElementById('quizContent');
    const progress = document.getElementById('quizProgress');
    const timerDisplay = document.getElementById('quizTimer');
    const questionNum = document.getElementById('questionNum');
    
    // 更新进度
    progress.style.width = `${((gateState.currentQuestionIndex + 1) / GATE_CONFIG.QUIZ_COUNT) * 100}%`;
    questionNum.innerText = `${gateState.currentQuestionIndex + 1}/${GATE_CONFIG.QUIZ_COUNT}`;
    
    // 渲染题目
    container.innerHTML = `
        <div class="quiz-question">
            <div class="quiz-category">📚 ${question.category}</div>
            <h3>${question.question}</h3>
        </div>
        <div class="quiz-options">
            ${question.options.map((opt, idx) => `
                <button class="quiz-option" data-index="${idx}" onclick="selectAnswer(${idx})">
                    <span class="option-letter">${String.fromCharCode(65 + idx)}</span>
                    <span class="option-text">${opt}</span>
                </button>
            `).join('')}
        </div>
    `;
    
    // 启动计时器
    startQuestionTimer();
}

/**
 * 启动题目计时器
 */
function startQuestionTimer() {
    // 清除之前的计时器
    if (gateState.timerInterval) {
        clearInterval(gateState.timerInterval);
    }
    
    const timerDisplay = document.getElementById('quizTimer');
    const timerBar = document.getElementById('quizTimerBar');
    let timeLeft = GATE_CONFIG.QUIZ_TIME_LIMIT;
    gateState.quizStartTime = Date.now();
    
    timerDisplay.innerText = formatTime(timeLeft);
    timerBar.style.width = '100%';
    timerBar.classList.remove('timer-danger');
    
    gateState.timerInterval = setInterval(() => {
        timeLeft--;
        timerDisplay.innerText = formatTime(Math.max(0, timeLeft));
        
        // 更新进度条
        const percent = (timeLeft / GATE_CONFIG.QUIZ_TIME_LIMIT) * 100;
        timerBar.style.width = `${percent}%`;
        
        // 低于10秒变红
        if (timeLeft <= 10) {
            timerBar.classList.add('timer-danger');
        }
        
        // 时间到
        if (timeLeft <= 0) {
            clearInterval(gateState.timerInterval);
            handleTimeUp();
        }
    }, 1000);
}

/**
 * 处理超时
 */
function handleTimeUp() {
    // 超时视为答错
    showAnswerFeedback(false);
}

/**
 * 选择答案
 */
function selectAnswer(selectedIndex) {
    // 停止计时器
    if (gateState.timerInterval) {
        clearInterval(gateState.timerInterval);
    }
    
    const question = gateState.currentQuestions[gateState.currentQuestionIndex];
    const isCorrect = checkAnswer(question, selectedIndex);
    
    showAnswerFeedback(isCorrect);
}

/**
 * 显示答题反馈
 */
function showAnswerFeedback(isCorrect) {
    const options = document.querySelectorAll('.quiz-option');
    const question = gateState.currentQuestions[gateState.currentQuestionIndex];
    
    // 禁用所有选项
    options.forEach(opt => opt.classList.add('disabled'));
    
    // 标记正确答案和错误答案
    options.forEach((opt, idx) => {
        if (idx === question.answer) {
            opt.classList.add('correct');
        } else if (opt.classList.contains('selected') && idx !== question.answer) {
            opt.classList.add('wrong');
        }
    });
    
    // 显示反馈
    const feedbackEl = document.getElementById('quizFeedback');
    if (feedbackEl) {
        feedbackEl.innerHTML = isCorrect 
            ? '<span class="feedback-correct">✅ 回答正确！</span>' 
            : '<span class="feedback-wrong">❌ 回答错误</span>';
        feedbackEl.style.display = 'block';
    }
    
    // 2秒后进入下一题或结束
    setTimeout(() => {
        document.getElementById('quizFeedback').style.display = 'none';
        nextQuestion();
    }, 1500);
}

/**
 * 进入下一题
 */
function nextQuestion() {
    gateState.currentQuestionIndex++;
    
    if (gateState.currentQuestionIndex < gateState.currentQuestions.length) {
        renderCurrentQuestion();
    } else {
        quizComplete();
    }
}

/**
 * 答题完成
 */
function quizComplete() {
    // 清除计时器
    if (gateState.timerInterval) {
        clearInterval(gateState.timerInterval);
    }
    
    // 计算正确率
    const correctCount = gateState.currentQuestions.filter((q, idx) => {
        // 这里需要记录用户答案，可以通过在 showAnswerFeedback 中标记
        return true; // 简化处理
    }).length;
    
    // 更新尝试次数
    gateState.quizAttempts++;
    gateState.lastQuizAttempt = Date.now();
    
    // 检查是否全对（简化：至少对2题）
    let correct = 0;
    document.querySelectorAll('.quiz-option.correct').forEach(() => correct++);
    
    if (correct >= 2) {  // 3题对2题即可通过
        gateState.quizPassed = true;
        
        // 答题通过，进入微博验证步骤
        setTimeout(() => {
            showGateStep('weibo');
            initWeiboVerification();
        }, 1500);
    } else {
        // 答题失败
        if (gateState.quizAttempts >= GATE_CONFIG.QUIZ_MAX_ATTEMPTS) {
            alert(`答题失败${GATE_CONFIG.QUIZ_MAX_ATTEMPTS}次，请 ${formatTime(GATE_CONFIG.QUIZ_COOLDOWN / 1000)} 后再试`);
            updateCooldownDisplay();
            setTimeout(() => showGateStep('welcome'), 2000);
        } else {
            alert(`答对 ${correct}/${GATE_CONFIG.QUIZ_COUNT} 题，还差一点点！剩余 ${GATE_CONFIG.QUIZ_MAX_ATTEMPTS - gateState.quizAttempts} 次机会`);
            setTimeout(() => showGateStep('welcome'), 2000);
        }
    }
}

// ==================== 微博验证逻辑 ====================

/**
 * 初始化微博验证页面
 */
function initWeiboVerification() {
    // 生成验证码
    gateState.verifyCode = generateVerifyCode();
    gateState.codeGeneratedAt = Date.now();
    
    // 显示验证码
    document.getElementById('verifyCodeDisplay').innerHTML = `
        <div class="code-box">
            <span class="code-label">您的验证码：</span>
            <span class="code-value">${gateState.verifyCode}</span>
        </div>
    `;
    
    // 设置过期时间显示
    const expiryTime = new Date(Date.now() + GATE_CONFIG.CODE_EXPIRY);
    document.getElementById('codeExpiryTime').innerText = `有效期至：${expiryTime.toLocaleTimeString()}`;
    
    // 清空UID输入
    document.getElementById('weiboUidInput').value = '';
    document.getElementById('weiboVerifyResult').innerHTML = '';
    document.getElementById('weiboVerifyBtn').disabled = false;
    document.getElementById('weiboVerifyBtn').innerText = '验证微博';
}

/**
 * 验证微博账号
 */
async function verifyWeiboAccount() {
    const uid = document.getElementById('weiboUidInput').value.trim();
    
    if (!uid) {
        alert('请输入微博UID');
        return;
    }
    
    // 检查验证码是否过期
    if (Date.now() - gateState.codeGeneratedAt > GATE_CONFIG.CODE_EXPIRY) {
        alert('验证码已过期，请重新获取');
        initWeiboVerification();
        return;
    }
    
    gateState.weiboUid = uid;
    
    const btn = document.getElementById('weiboVerifyBtn');
    const resultDiv = document.getElementById('weiboVerifyResult');
    
    btn.disabled = true;
    btn.innerText = '验证中...';
    resultDiv.innerHTML = '<div class="verify-loading">正在验证微博账号...</div>';
    
    try {
        // 调用 Supabase Edge Function
        const response = await fetch(`${SUPABASE_URL}/functions/v1/verify-weibo`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY
            },
            body: JSON.stringify({
                weiboUid: uid,
                code: gateState.verifyCode
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            resultDiv.innerHTML = `
                <div class="verify-success">
                    <h4>✅ 验证成功！</h4>
                    <p>微博昵称：${result.weiboName || '未知'}</p>
                    <p>超话等级：Lv.${result.chaohuaLevel || 7}</p>
                </div>
            `;
            
            // 保存用户信息并生成Token
            setTimeout(() => {
                completeRegistration(result.weiboName, result.chaohuaLevel || 7);
            }, 2000);
        } else {
            resultDiv.innerHTML = `<div class="verify-error"><h4>❌ 验证失败</h4><p>${result.message}</p></div>`;
            btn.disabled = false;
            btn.innerText = '重新验证';
        }
    } catch (error) {
        console.error('Verify error:', error);
        
        // 如果Edge Function不可用，使用模拟验证（仅测试用）
        resultDiv.innerHTML = `
            <div class="verify-simulated">
                <h4>⚠️ Edge Function 未部署</h4>
                <p>请手动确认以下步骤已完成：</p>
                <ol>
                    <li>✅ 微博UID已填写：${uid}</li>
                    <li>${gateState.verifyCode ? '✅' : '❌'} 验证码已生成：${gateState.verifyCode}</li>
                    <li>❓ 需将验证码添加到微博简介</li>
                    <li>❓ 需确认超话等级≥7</li>
                </ol>
                <button class="btn-simulate" onclick="simulateVerification('${uid}')">模拟通过验证（仅测试）</button>
            </div>
        `;
        btn.disabled = false;
        btn.innerText = '重新验证';
    }
}

/**
 * 模拟验证（Edge Function未部署时使用）
 */
function simulateVerification(uid) {
    const resultDiv = document.getElementById('weiboVerifyResult');
    resultDiv.innerHTML = `
        <div class="verify-success">
            <h4>✅ 模拟验证成功！</h4>
            <p>微博UID：${uid}</p>
            <p>超话等级：Lv.7</p>
            <p style="color:#f59e0b;">（此为模拟结果，实际请部署Edge Function）</p>
        </div>
    `;
    
    setTimeout(() => {
        completeRegistration(`粉丝${uid.slice(-4)}`, 7);
    }, 1500);
}

/**
 * 完成注册
 */
function completeRegistration(weiboName, chaohuaLevel) {
    // 生成Token
    const token = generateUserToken(gateState.weiboUid);
    gateState.userToken = token;
    gateState.tokenCreatedAt = Date.now();
    
    // 保存Token
    saveToken(gateState.weiboUid, token, weiboName, chaohuaLevel);
    
    // 记录答题通过状态
    gateState.quizPassed = true;
    
    // 显示成功页面
    showGateStep('success');
    
    document.getElementById('successInfo').innerHTML = `
        <div class="success-content">
            <div class="success-icon">🎉</div>
            <h2>欢迎加入米米宇宙！</h2>
            <p>微博用户：${weiboName || gateState.weiboUid}</p>
            <p>超话等级：Lv.${chaohuaLevel}</p>
            <p class="token-hint">您的访问令牌已生成，有效期90天</p>
        </div>
    `;
    
    // 5秒后自动登录
    let countdown = 5;
    const countdownEl = document.getElementById('autoLoginCountdown');
    
    const interval = setInterval(() => {
        countdown--;
        countdownEl.innerText = countdown;
        if (countdown <= 0) {
            clearInterval(interval);
            performLogin();
        }
    }, 1000);
}

/**
 * 执行登录
 */
function performLogin() {
    const tokenData = getStoredToken();
    if (tokenData) {
        autoLoginWithToken(tokenData);
    } else {
        alert('Token丢失，请重新验证');
        showGateStep('welcome');
    }
}

// ==================== 返回和重置 ====================

/**
 * 返回上一步
 */
function gateGoBack() {
    if (gateState.timerInterval) {
        clearInterval(gateState.timerInterval);
    }
    showGateStep('welcome');
}

/**
 * 重新开始验证
 */
function gateRestart() {
    if (gateState.timerInterval) {
        clearInterval(gateState.timerInterval);
    }
    gateState = {
        currentStep: 'welcome',
        currentQuestions: [],
        currentQuestionIndex: 0,
        quizStartTime: null,
        timerInterval: null,
        quizAttempts: 0,
        lastQuizAttempt: 0,
        quizPassed: false,
        weiboUid: '',
        verifyCode: '',
        codeGeneratedAt: null,
        userToken: '',
        tokenCreatedAt: null
    };
    showGateStep('welcome');
}

/**
 * 退出登录（清除Token）
 */
function gateLogout() {
    if (!confirm('确定要退出登录吗？退出后将需要重新验证。')) return;
    clearToken();
    gateRestart();
}

// ==================== 兼容旧API ====================

// 保留旧API以兼容其他模块的调用
function switchAuthTab(m) {
    // 新的门禁系统不需要切换标签页
    console.log('使用新的门禁验证系统');
}

function handleLogin() {
    // 新系统使用 Token 登录
    const token = getStoredToken();
    if (token && isTokenValid(token)) {
        autoLoginWithToken(token);
    } else {
        alert('请先完成门禁验证');
        showGateStep('welcome');
    }
}

function handleRegister() {
    // 新系统自动处理注册
    startQuizVerification();
}

// 页面加载时初始化门禁系统
document.addEventListener('DOMContentLoaded', () => {
    // 延迟初始化，确保DOM已加载
    setTimeout(initGatePage, 100);
});
