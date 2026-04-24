function switchAuthTab(m){
    document.getElementById('loginForm').style.display=m=='L'?'block':'none';
    document.getElementById('regForm').style.display=m=='R'?'block':'none';
    document.getElementById('tabL').className=m=='L'?'tab-btn active':'tab-btn';
    document.getElementById('tabR').className=m=='R'?'tab-btn active':'tab-btn';
    if (m === 'R') toggleTeacherInvite();
}
function openForgotModal(){ document.getElementById('forgotModal').style.display='flex'; }
function sendForgotEmail(){
    let em=document.getElementById('forgotEmail').value;
    for(let n in userDB){
        if(userDB[n].email==em){
            alert(`密码：${userDB[n].pass}`);
            return;
        }
    }
    alert("邮箱未注册");
}

function handleLogin() {
    const u = document.getElementById("lUser").value.trim();
    const p = document.getElementById("lPass").value;
    const r = document.getElementById("lRole").value;
    if (!userDB[u] || userDB[u].type !== r || userDB[u].pass !== p) return alert("账号或密码错误");

    isAdmin = (r === "admin" || r === "super");
    isSuper = (r === "super");
    isTeacher = (r === "teacher");
    currentUser = { name: u, type: r, uid: userDB[u].uid, teacherId: userDB[u].teacherId || null };

    if (isTeacher && !currentUser.teacherId) {
        const newTeacher = { id: "t"+Date.now(), name: u, sub: "未设置", ava: "", links: [], signature: "", category: "默认" };
        teachers.push(newTeacher);
        userDB[u].teacherId = newTeacher.id;
        currentUser.teacherId = newTeacher.id;
    }

    // 再次登录无需填写密码：记住用户名、密码和角色
    localStorage.setItem("rememberedUser", u);
    localStorage.setItem("rememberedPass", p);
    localStorage.setItem("rememberedRole", r);

    document.getElementById("authPage").style.display="none";
    document.getElementById("mainPage").style.display="block";
    document.getElementById("userDisp").innerText = u + ` (${userDB[u].uid})` + (isSuper ? " [大管理]" : "");
    document.getElementById("teacherSelfBtn").style.display = isTeacher ? "inline-block" : "none";
    document.getElementById("passBtn").style.display = (isAdmin || isSuper) ? "inline-block" : "none";
    document.getElementById("adminManageBtn").style.display = isSuper ? "inline-block" : "none";
    document.getElementById("adminDateSet").style.display = isAdmin ? "flex" : "none";
    document.getElementById("adminBtnS").style.display = isAdmin ? "inline-block" : "none";
    document.getElementById("adminBtnT").style.display = isAdmin ? "inline-block" : "none";
    document.getElementById("adminCatBtn").style.display = isAdmin ? "inline-block" : "none";
    document.getElementById("startDateInp").value = config.start;

    const prevLogin = lastLoginAt[u] || 0;
    renderAll();
    showNotifications(prevLogin);
    lastLoginAt[u] = Date.now();
    saveAll();

    if (!isExplicitlyPaused) startPlay();
}

function handleRegister() {
    const u = document.getElementById("rUser").value.trim();
    const em = document.getElementById("rEmail").value.trim();
    const p = document.getElementById("rPass").value;
    const p2 = document.getElementById("rPass2").value;
    const t = document.getElementById("rRole").value;
    const invite = document.getElementById("rInvite").value.trim();

    if (!u || !p || p !== p2) return alert("请检查输入信息");

    const passRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
    if (!passRegex.test(p)) return alert("密码需至少8位，且包含数字和字母");

    if (t === "teacher") {
        if (!inviteCodes.includes(invite)) return alert("邀请码无效");
        inviteCodes = inviteCodes.filter(c => c !== invite);
    }

    userDB[u] = { uid: "UID"+Math.floor(1000+Math.random()*9000), pass: p, email: em, type: t };

    if (t === "teacher") {
        const newTeacher = { id: "t"+Date.now(), name: u, sub: "未设置", ava: "", links: [], signature: "", category: "默认" };
        teachers.push(newTeacher);
        userDB[u].teacherId = newTeacher.id;
    }

    saveAll();
    alert("注册成功！");
    switchAuthTab("L");
}

function openPassModal() {
    if (!currentUser) return;
    document.getElementById("oldPass").value = "";
    document.getElementById("newPass").value = "";
    document.getElementById("newPass2").value = "";
    document.getElementById("modalPass").style.display = "flex";
}
function changeMyPassword() {
    if (!currentUser) return;
    const oldP = document.getElementById("oldPass").value;
    const newP = document.getElementById("newPass").value;
    const newP2 = document.getElementById("newPass2").value;
    if (!userDB[currentUser.name] || userDB[currentUser.name].pass !== oldP) return alert("旧密码不正确");
    if (newP !== newP2) return alert("两次新密码不一致");
    const passRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
    if (!passRegex.test(newP)) return alert("密码需至少8位，且包含数字和字母");
    userDB[currentUser.name].pass = newP;
    saveAll();
    alert("密码已更新");
    closeM("modalPass");
}

function openAdminManageModal() {
    if (!isSuper) return;
    renderAdminList();
    document.getElementById("modalAdminManage").style.display = "flex";
}
function renderAdminList() {
    const list = document.getElementById("adminList");
    const admins = Object.keys(userDB).filter(u => ["admin","super"].includes(userDB[u].type));
    list.innerHTML = admins.map(u => {
        const role = userDB[u].type === "super" ? "大管理" : "管理员";
        const resetBtn = userDB[u].type === "admin" ? `<button class="btn-ui-secondary" onclick="resetAdminPassword('${u}')">重置密码</button>` : "";
        return `<div class="rank-item"><span>${u}（${role}） 密码：${userDB[u].pass}</span>${resetBtn}</div>`;
    }).join("") || "<div style='color:#999;'>暂无管理员</div>";
}
function addAdminAccount() {
    if (!isSuper) return;
    const u = document.getElementById("adminUserInp").value.trim();
    const p = document.getElementById("adminPassInp").value.trim();
    if (!u || !p) return alert("请输入管理员用户名和密码");
    if (userDB[u]) return alert("用户名已存在");
    const passRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
    if (!passRegex.test(p)) return alert("密码需至少8位，且包含数字和字母");
    userDB[u] = { uid: "UID"+Math.floor(1000+Math.random()*9000), pass: p, type: "admin", email: "" };
    saveAll();
    document.getElementById("adminUserInp").value = "";
    document.getElementById("adminPassInp").value = "";
    renderAdminList();
}
function resetAdminPassword(u) {
    if (!isSuper) return;
    const p = prompt("输入新密码（至少8位，数字+英文）");
    if (!p) return;
    const passRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
    if (!passRegex.test(p)) return alert("密码需至少8位，且包含数字和字母");
    userDB[u].pass = p;
    saveAll();
    renderAdminList();
}

// 自动登录功能：检查本地存储的登录信息，如果有效则自动登录
function autoLogin() {
    const u = localStorage.getItem("rememberedUser");
    const p = localStorage.getItem("rememberedPass");
    const r = localStorage.getItem("rememberedRole");
    if (!u || !p || !r) return; // 没有保存的登录信息，跳过自动登录

    // 设置输入框的值（可选，用于显示）
    document.getElementById("lUser").value = u;
    document.getElementById("lPass").value = p;
    document.getElementById("lRole").value = r;

    // 执行登录逻辑（复制handleLogin的核心部分）
    isAdmin = (r === "admin" || r === "super");
    isSuper = (r === "super");
    isTeacher = (r === "teacher");
    currentUser = { name: u, type: r, uid: userDB[u].uid, teacherId: userDB[u].teacherId || null };

    if (isTeacher && !currentUser.teacherId) {
        const newTeacher = { id: "t"+Date.now(), name: u, sub: "未设置", ava: "", links: [], signature: "", category: "默认" };
        teachers.push(newTeacher);
        userDB[u].teacherId = newTeacher.id;
        currentUser.teacherId = newTeacher.id;
    }

    // 切换到主页面
    document.getElementById("authPage").style.display = "none";
    document.getElementById("mainPage").style.display = "block";
    document.getElementById("userDisp").innerText = u + ` (${userDB[u].uid})` + (isSuper ? " [大管理]" : "");

    // 设置按钮可见性
    document.getElementById("teacherSelfBtn").style.display = isTeacher ? "inline-block" : "none";
    document.getElementById("passBtn").style.display = (isAdmin || isSuper) ? "inline-block" : "none";
    document.getElementById("adminManageBtn").style.display = isSuper ? "inline-block" : "none";
    document.getElementById("adminDateSet").style.display = isAdmin ? "flex" : "none";
    document.getElementById("adminBtnS").style.display = isAdmin ? "inline-block" : "none";
    document.getElementById("adminBtnT").style.display = isAdmin ? "inline-block" : "none";
    document.getElementById("adminCatBtn").style.display = isAdmin ? "inline-block" : "none";
    document.getElementById("startDateInp").value = config.start;

    // 渲染页面和通知
    const prevLogin = lastLoginAt[u] || 0;
    renderAll();
    showNotifications(prevLogin);
    lastLoginAt[u] = Date.now();
    saveAll();

    // 启动音乐
    if (!isExplicitlyPaused) autoPlayAttempt();
}