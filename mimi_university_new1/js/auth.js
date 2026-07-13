// ==================== 粉丝门禁系统 ====================
// V3.0 - 登录/注册 + 微博验证

// SUPABASE_URL 和 SUPABASE_ANON_KEY 已在 core.js 中声明，此处不再重复
const TOKEN_KEY = "mimi_gate_token";
const WEIBO_UID_KEY = "mimi_weibo_uid";
const TOKEN_EXPIRE_DAYS = 90;
const VERIFY_CODE_EXPIRE = 15 * 60 * 1000; // 15分钟过期

let generatedCode = '';
let codeGeneratedAt = 0;

// ==================== 初始化 ====================
function initGate() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token && isTokenValid(token)) {
        enterMainPage();
        return;
    }
    // 默认显示登录页
    switchAuthTab('login');
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

// ==================== 登录/注册切换 ====================
function switchAuthTab(tab) {
    const loginPage = document.getElementById('loginPage');
    const registerPage = document.getElementById('registerPage');
    const tabs = document.querySelectorAll('.auth-tab');
    
    tabs.forEach(t => t.classList.remove('active'));
    
    if (tab === 'login') {
        if (loginPage) loginPage.style.display = 'block';
        if (registerPage) registerPage.style.display = 'none';
        tabs[0].classList.add('active');
    } else {
        if (loginPage) loginPage.style.display = 'none';
        if (registerPage) registerPage.style.display = 'block';
        tabs[1].classList.add('active');
        // 重置注册页状态
        const codeArea = document.getElementById('codeArea');
        if (codeArea) codeArea.style.display = 'none';
        generatedCode = '';
    }
    // 隐藏错误提示
    const loginError = document.getElementById('loginError');
    if (loginError) loginError.style.display = 'none';
}

// ==================== 登录 ====================
async function doLogin() {
    const usernameInput = document.getElementById('loginUsername');
    const passwordInput = document.getElementById('loginPassword');
    const errorEl = document.getElementById('loginError');
    if (!usernameInput || !passwordInput) return;
    
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    
    if (!username) {
        if (errorEl) {
            errorEl.textContent = '请输入用户名';
            errorEl.style.display = 'block';
        }
        return;
    }
    if (!password) {
        if (errorEl) {
            errorEl.textContent = '请输入密码';
            errorEl.style.display = 'block';
        }
        return;
    }
    
    try {
        // 调用登录API
        const resp = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await resp.json();
        
        if (data.success && data.user) {
            // 登录成功
            var tokenData = {
                weiboUid: data.user.weibo_uid || '',
                weiboName: data.user.weibo_name || username,
                avatarUrl: data.user.avatar_url || '',
                chaohuaLevel: data.user.chaohua_level || 0,
                username: username,
                createdAt: Date.now(),
                expiresAt: Date.now() + TOKEN_EXPIRE_DAYS * 24 * 60 * 60 * 1000
            };
            localStorage.setItem(TOKEN_KEY, JSON.stringify(tokenData));
            localStorage.setItem(WEIBO_UID_KEY, data.user.weibo_uid || '');
            enterMainPage();
        } else {
            // 登录失败
            if (errorEl) {
                errorEl.textContent = data.error || '用户名或密码错误';
                errorEl.style.display = 'block';
            }
        }
    } catch (e) {
        if (errorEl) {
            errorEl.textContent = '网络错误，请稍后重试';
            errorEl.style.display = 'block';
        }
    }
}

// ==================== 注册（微博验证） ====================
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
        '<button onclick="switchAuthTab(\'register\')" style="background:transparent;color:#aaa;border:1px solid rgba(255,255,255,0.2);padding:12px 20px;border-radius:8px;cursor:pointer;font-size:13px;margin-left:10px;">返回重试</button>' +
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
    // 获取注册表单的用户名和密码
    const username = document.getElementById('regUsername') ? document.getElementById('regUsername').value.trim() : '';
    const password = document.getElementById('regPassword') ? document.getElementById('regPassword').value : '';
    
    if (!username || !password) {
        alert('请填写用户名和密码');
        return;
    }
    
    // 生成token
    var tokenData = {
        weiboUid: uid,
        weiboName: weiboData.weiboName || username,
        avatarUrl: weiboData.avatarUrl || '',
        chaohuaLevel: weiboData.chaohuaLevel || 0,
        username: username,
        createdAt: Date.now(),
        expiresAt: Date.now() + TOKEN_EXPIRE_DAYS * 24 * 60 * 60 * 1000
    };
    localStorage.setItem(TOKEN_KEY, JSON.stringify(tokenData));
    localStorage.setItem(WEIBO_UID_KEY, uid);

    // 写入Supabase（包含用户名和密码）
    saveUserToSupabase(uid, tokenData, username, password);

    // 显示成功页
    showRegisterSuccess();
}

function showRegisterSuccess() {
    const loginPage = document.getElementById('loginPage');
    const registerPage = document.getElementById('registerPage');
    const successPage = document.getElementById('gateSuccess');
    const authTabs = document.getElementById('authTabs');
    
    if (loginPage) loginPage.style.display = 'none';
    if (registerPage) registerPage.style.display = 'none';
    if (authTabs) authTabs.style.display = 'none';
    if (successPage) successPage.style.display = 'block';
}

async function saveUserToSupabase(uid, tokenData, username, password) {
    try {
        var resp = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                weibo_uid: uid,
                weibo_name: tokenData.weiboName || '',
                avatar_url: tokenData.avatarUrl || '',
                chaohua_level: tokenData.chaohuaLevel || 0,
                username: username,
                password: password
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

    // 显示登录页
    switchAuthTab('login');
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
