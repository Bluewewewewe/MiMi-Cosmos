
let userDB = {
    "admin": { uid: "UID001", pass: "admin123", type: "admin", email: "a@m.com" },
    "super": { uid: "UID000", pass: "super123", type: "super", email: "s@m.com" }
};
let teachers = [{ id: "t1", name: "张老师", sub: "高数", ava: "", dy: "math66", bz: "123", xhs: "xhs1" }];
let allWeeks = { "week1": [["08:30-10:00", {name:"高数入门", tId:"t1", video:""}, {}, {}, {}, {}, {}, {}]] };
let curWeek = 1, isAdmin = false, isSuper = false, tempAva = "", config = { start: "2026-04-07" };

const STORAGE_KEY = "mimi_university_data_v1";
function loadStorage() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const data = JSON.parse(raw);
        if (data && typeof data === "object") {
            if (data.userDB) userDB = data.userDB;
            if (data.teachers) teachers = data.teachers;
            if (data.allWeeks) allWeeks = data.allWeeks;
            if (data.config) config = data.config;
        }
    } catch (e) {}
}
function saveStorage() {
    const data = { userDB, teachers, allWeeks, config };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// 初始化周选择器
const weekSel = document.getElementById('weekSel');
for(let i=1; i<=20; i++) weekSel.add(new Option(i, i));

// ==================== 音乐与拖拽 ====================
let isPlaying = false, isExplicitlyPaused = false, isDragging = false, startX, startY;
const musicCtrl = document.getElementById('musicCtrl'), bgm = document.getElementById('bgm');

musicCtrl.onmousedown = (e) => {
    isDragging = false; startX = e.clientX; startY = e.clientY;
    let offsetL = e.clientX - musicCtrl.offsetLeft, offsetT = e.clientY - musicCtrl.offsetTop;
    document.onmousemove = (mvE) => {
        if (Math.abs(mvE.clientX - startX) > 5 || Math.abs(mvE.clientY - startY) > 5) {
            isDragging = true;
            musicCtrl.style.left = (mvE.clientX - offsetL) + 'px';
            musicCtrl.style.top = (mvE.clientY - offsetT) + 'px';
            musicCtrl.style.right = 'auto';
        }
    };
    document.onmouseup = () => { document.onmousemove = null; document.onmouseup = null; };
};

musicCtrl.onclick = () => {
    if (isDragging) return;
    if (isPlaying) {
        bgm.pause(); isPlaying=false; isExplicitlyPaused=true;
        musicCtrl.style.animationPlayState='paused';
    } else {
        bgm.play(); isPlaying=true; isExplicitlyPaused=false;
        musicCtrl.style.animationPlayState='running';
    }
};
function autoPlayAttempt() { if (!isPlaying && !isExplicitlyPaused) startPlay(); }
function startPlay() { bgm.play().then(()=>{ isPlaying=true; musicCtrl.style.animationPlayState='running'; }).catch(()=>{}); }

// ==================== 课表编辑核心逻辑 ====================
function openSModal(){
    const title = document.getElementById('weekNumTitle');
    if(title) title.innerText = curWeek;

    const b = document.getElementById('editSBody');
    let tOpts = '<option value="">--未选--</option>';
    teachers.forEach(t => tOpts += `<option value="${t.id}">${t.name}</option>`);
    b.innerHTML = '';

    // 获取当前周数据，若无则初始化一行
    let data = allWeeks["week"+curWeek];
    if(!data || data.length === 0) {
        data = [["08:30-10:00",{},{},{},{},{},{},{}]];
    }

    data.forEach((row, r) => {
        let tr = document.createElement('tr');
        tr.className = "edit-table-row";

        let html = `<td><button onclick="delRow(${r})" class="btn-ui-tag-del">×</button></td>
                    <td><input class="time-inp" value="${row[0] || ''}" style="width:80px"></td>`;

        for(let c=1; c<=7; c++){
            let item = row[c] || {};
            html += `<td>
                <input class="name-inp" value="${item.name||''}" placeholder="课名" style="width:70px">
                <select class="teacher-sel" style="width:70px">${tOpts}</select>
                <input class="video-inp" value="${item.video||''}" placeholder="回放" style="width:70px;margin-top:4px;font-size:10px;">
            </td>`;
        }
        tr.innerHTML = html;
        b.appendChild(tr);

        // 回填选中的老师
        const selects = tr.querySelectorAll('.teacher-sel');
        for(let i=0; i<7; i++) {
            if(row[i+1] && row[i+1].tId) selects[i].value = row[i+1].tId;
        }
    });

    document.getElementById('modalS').style.display='flex';
}

function saveS() {
    let newData = [];
    const rows = document.querySelectorAll('.edit-table-row');
    rows.forEach(tr => {
        let rowData = [tr.querySelector('.time-inp').value];
        const names = tr.querySelectorAll('.name-inp');
        const selects = tr.querySelectorAll('.teacher-sel');
        const videos = tr.querySelectorAll('.video-inp');
        for(let i=0; i<7; i++) {
            rowData.push({
                name: names[i].value,
                tId: selects[i].value,
                video: videos[i].value
            });
        }
        newData.push(rowData);
    });
    allWeeks["week"+curWeek] = newData;
    saveStorage();
    renderTable();
    closeM('modalS');
    alert("本周课表已同步成功！");
}

function addRow(){
    if(!allWeeks["week"+curWeek]) allWeeks["week"+curWeek] = [];
    allWeeks["week"+curWeek].push(["00:00",{},{},{},{},{},{},{}]);
    saveStorage();
    openSModal();
}

function delRow(idx){
    if(confirm("确定删除此时间段吗？")){
        allWeeks["week"+curWeek].splice(idx, 1);
        saveStorage();
        openSModal();
    }
}

// ==================== 登录与权限 ====================
function handleLogin() {
    const u = document.getElementById('lUser').value.trim(), p = document.getElementById('lPass').value, r = document.getElementById('lRole').value;
    if (!userDB[u] || userDB[u].type !== r || userDB[u].pass !== p) return alert("账号或密码错误");
    isAdmin = (r=='admin' || r=='super');
    isSuper = (r=='super');
    document.getElementById('authPage').style.display='none';
    document.getElementById('mainPage').style.display='block';
    document.getElementById('userDisp').innerText = u + ` (${userDB[u].uid})` + (isSuper ? " [大管理]" : "");
    if(isAdmin) {
        document.getElementById('adminDateSet').style.display='flex';
        document.getElementById('adminBtnS').style.display='inline-block';
        document.getElementById('adminBtnT').style.display='inline-block';
        document.getElementById('startDateInp').value = config.start;
    }
    renderAll();
    if(!isExplicitlyPaused) startPlay();
}

function handleRegister() {
    let u=document.getElementById('rUser').value.trim(), em=document.getElementById('rEmail').value.trim(), p=document.getElementById('rPass').value, p2=document.getElementById('rPass2').value, t=document.getElementById('rRole').value;
    if(!u || !p || p!==p2) return alert("请检查输入信息");
    const passRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
    if (!passRegex.test(p)) return alert("密码需至少8位，且包含数字和字母");
    userDB[u] = { uid: "UID"+Math.floor(1000+Math.random()*9000), pass: p, email: em, type: t };
    saveStorage();
    alert("注册成功！"); switchAuthTab('L');
}

// ==================== 渲染逻辑 ====================
function renderTable() {
    const head = document.getElementById('sHead'), body = document.getElementById('sBody');
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    let weekNames = ["周日","周一","周二","周三","周四","周五","周六"];
    let hTr = `<tr><th>时段</th>`;
    for(let i=0; i<7; i++) {
        let info = getRealDate(curWeek, i);
        let realDayName = weekNames[new Date(info.full).getDay()];
        hTr += `<th class="${info.full==today?'is-today':''}"> ${realDayName} <small>${info.show}</small></th>`;
    }
    head.innerHTML = hTr + `</tr>`;
    body.innerHTML = '';

    let data = allWeeks["week"+curWeek] || [];
    data.forEach((row, r) => {
        let tr = `<tr><td style="background:var(--light); font-weight:bold;">${row[0]}</td>`;
        for(let i=1; i<=7; i++) {
            let item = row[i] || {}, t = teachers.find(x => x.id === item.tId);
            let badge = item.video ? `<span class="video-badge">📺</span>` : '';
            tr += `<td><div class="course-box" onclick="showDetail(${r},${i})">${badge}<b>${item.name||'-'}</b>${t?`<small style="display:block;color:var(--primary-dark)">👤${t.name}</small>`:''}</div></td>`;
        }
        body.innerHTML += tr + `</tr>`;
    });
}

function renderTeachers() {
    const g = document.getElementById('teacherGrid'); g.innerHTML = '';
    teachers.forEach(t => {
        let ss = '';
        if(t.dy) ss += `<div class="social-item"><i class="icon-tag" style="background:var(--douyin)">音</i><span>${t.dy}</span></div>`;
        if(t.bz) ss += `<div class="social-item"><i class="icon-tag" style="background:var(--bilibili)">B</i><span>${t.bz}</span></div>`;
        if(t.xhs) ss += `<div class="social-item"><i class="icon-tag" style="background:var(--xhs)">书</i><span>${t.xhs}</span></div>`;
        g.innerHTML += `<div class="teacher-card"><div class="avatar-circle" style="background-image:url(${t.ava})"></div><b>${t.name}</b><p style="font-size:12px;color:var(--primary-dark)">${t.sub}</p><div class="social-display-list">${ss}</div>${isAdmin?`<div style="margin-top:10px"><button onclick="editT('${t.id}')" class="btn-ui-tag-edit">修改</button><button onclick="delT('${t.id}')" class="btn-ui-tag-del">删除</button></div>`:''}</div>`;
    });
}

function renderCategoryList() {
    const wrap = document.getElementById("teacherCategories");
    if (!wrap) return;
    const extra = teachers.some(t => t.category === "未分类") ? ["未分类"] : [];
    const cats = ["全部", ...teacherCategories, ...extra];
    wrap.innerHTML = cats.map(c => `<div class="teacher-cat ${currentCategory===c?'active':''}" onclick="setCategoryFilter('${c}')">${c}</div>`).join("");
}
function setCategoryFilter(cat) {
    currentCategory = cat;
    renderCategoryList();
    renderTeachers();
}
function filterTeachers() {
    const inp = document.getElementById("teacherSearchInp");
    teacherSearchKey = inp ? inp.value : "";
    renderTeachers();
}
function clearTeacherSearch() {
    teacherSearchKey = "";
    const inp = document.getElementById("teacherSearchInp");
    if (inp) inp.value = "";
    renderTeachers();
}
function setTeacherCategory(tid, cat) {
    const t = teachers.find(x => x.id === tid);
    if (!t) return;
    t.category = cat;
    saveAll();
    renderTeachers();
}

function openCategoryModal() {
    if (!isAdmin && !isSuper) return;
    document.getElementById("modalCat").style.display = "flex";
    renderCategoryModal();
}
function renderCategoryModal() {
    const list = document.getElementById("catList");
    list.innerHTML = teacherCategories.map(c => `<div class="rank-item" draggable="true" ondragstart="handleCatDragStart(event,'${c}')" ondragover="event.preventDefault()" ondrop="handleCatDrop(event,'${c}')"><span>${c}</span><button class="btn-ui-tag-del" onclick="removeCategory('${c}')">删除</button></div>`).join("") || "<div style='color:#999;'>暂无分类</div>";
}
function addCategory() {
    const inp = document.getElementById("catInp");
    const name = inp.value.trim();
    if (!name) return;
    if (!teacherCategories.includes(name)) teacherCategories.push(name);
    inp.value = "";
    saveAll();
    renderCategoryModal();
    renderCategoryList();
}
function removeCategory(name) {
    if (!confirm("确认删除该分类？老师会变为未分类")) return;
    teacherCategories = teacherCategories.filter(c => c !== name);
    teachers.forEach(t => {
        if (t.category === name) t.category = "未分类";
    });
    saveAll();
    renderCategoryModal();
    renderCategoryList();
    renderTeachers();
}

function handleCatDragStart(e, name) {
    e.dataTransfer.setData("text/plain", name);
}
function handleCatDrop(e, targetName) {
    const name = e.dataTransfer.getData("text/plain");
    if (!name || name === targetName) return;
    const from = teacherCategories.indexOf(name);
    const to = teacherCategories.indexOf(targetName);
    if (from === -1 || to === -1) return;
    teacherCategories.splice(from, 1);
    teacherCategories.splice(to, 0, name);
    saveAll();
    renderCategoryModal();
    renderCategoryList();
    renderTeachers();
}

function toggleTeacherHidden(tid) {
    const t = teachers.find(x => x.id === tid);
    if (!t) return;
    t.hidden = !t.hidden;
    saveAll();
    renderTeachers();
    renderCalendar();
    renderRanks("week");
}

function getAllTags() {
    return teacherCategories.length ? teacherCategories : ["默认"];
}
function renderTagFilters() {
    const wrap = document.getElementById("tagFilters");
    if (!wrap) return;
    const tags = getAllTags();
    tags.forEach(t => {
        if (typeof tagFilterState[t] !== "boolean") tagFilterState[t] = true;
    });
    const actions = `<div class="tag-filter-actions">
        <button class="btn-ui-secondary" onclick="setAllTags(true)">全选</button>
        <button class="btn-ui-secondary" onclick="setAllTags(false)">全不选</button>
    </div>`;
    const items = tags.map(t => `<div class="tag-filter ${tagFilterState[t] ? "active" : ""}" onclick="toggleTagFilter('${t}')">${t}</div>`).join("") || "<span style='color:#999;'>暂无标签</span>";
    wrap.innerHTML = actions + items;
}
function toggleTagFilter(tag) {
    tagFilterState[tag] = !tagFilterState[tag];
    renderTagFilters();
    renderCalendar();
}
function setAllTags(val) {
    Object.keys(tagFilterState).forEach(k => tagFilterState[k] = val);
    renderTagFilters();
    renderCalendar();
}
function isCourseTagVisible(item, teacher) {
    const cat = teacher?.category || teacher?.sub || "默认";
    if (typeof tagFilterState[cat] !== "boolean") return true;
    return tagFilterState[cat] !== false;
}

function getMyScheduleForWeek(weekNum) {
    if (!currentUser) return [];
    const u = userSchedules[currentUser.name] || {};
    return u["week"+weekNum] || [];
}
function openMyScheduleModal() {
    if (!currentUser) return alert("请先登录");
    renderMyScheduleForm();
    document.getElementById("modalMySchedule").style.display = "flex";
}
function renderMyScheduleForm() {
    const list = getMyScheduleForWeek(curWeek);
    const wrap = document.getElementById("myScheduleList");
    if (!wrap) return;
    const rows = list.map((it, idx) => renderMyScheduleRow(it, idx)).join("");
    wrap.innerHTML = rows || "<div style='color:#999;'>暂无行程</div>";
}
function renderMyScheduleRow(it, idx) {
    const dayOpts = weekNames.map((n, i) => `<option value="${i}" ${Number(it.day)===i?'selected':''}>${n}</option>`).join("");
    const typeOpts = isTeacher
        ? `<option value="个人" ${it.type==="个人"?'selected':''}>个人</option><option value="课程" ${it.type==="课程"?'selected':''}>课程</option>`
        : `<option value="个人" selected>个人</option>`;
    return `<div class="edit-form my-schedule-row" data-idx="${idx}">
        <input class="ms-title" placeholder="标题" value="${it.title || ""}">
        <input class="ms-time" placeholder="时间(如 08:00-09:00)" value="${it.time || ""}">
        <select class="ms-day">${dayOpts}</select>
        <select class="ms-type">${typeOpts}</select>
        <button class="btn-ui-tag-del" onclick="removeMyScheduleRow(${idx})">删除</button>
    </div>`;
}
function addMyScheduleRow() {
    const list = getMyScheduleForWeek(curWeek);
    list.push({ title: "", time: "08:00-09:00", day: 1, type: "个人" });
    if (!userSchedules[currentUser.name]) userSchedules[currentUser.name] = {};
    userSchedules[currentUser.name]["week"+curWeek] = list;
    renderMyScheduleForm();
}
function removeMyScheduleRow(idx) {
    const list = getMyScheduleForWeek(curWeek);
    list.splice(idx, 1);
    if (!userSchedules[currentUser.name]) userSchedules[currentUser.name] = {};
    userSchedules[currentUser.name]["week"+curWeek] = list;
    renderMyScheduleForm();
}
function saveMySchedule() {
    const list = [];
    document.querySelectorAll("#myScheduleList .my-schedule-row").forEach(row => {
        const title = row.querySelector(".ms-title").value.trim();
        const time = row.querySelector(".ms-time").value.trim();
        const day = row.querySelector(".ms-day").value;
        const type = row.querySelector(".ms-type").value;
        if (!time) return;
        list.push({ title, time, day, type });
    });
    if (!userSchedules[currentUser.name]) userSchedules[currentUser.name] = {};
    userSchedules[currentUser.name]["week"+curWeek] = list;
    saveAll();
    renderCalendar();
    closeM("modalMySchedule");
}

// ==================== 工具函数 ====================
function getRealDate(w, d) {
    let base = new Date(config.start);
    let target = new Date(base.getTime() + ((w-1)*7 + d)*86400000);
    return { show: (target.getMonth()+1)+"/"+target.getDate(), full: target.toISOString().split('T')[0] };
}
function getWeekIndexByDate(dateStr) {
    const base = new Date(config.start);
    const target = new Date(dateStr);
    const diffDays = Math.floor((target - base) / 86400000);
    if (Number.isNaN(diffDays)) return 1;
    return Math.floor(diffDays / 7) + 1;
}
function jumpToDate() {
    const d = document.getElementById('dateViewInp').value;
    if (!d) return;
    const w = getWeekIndexByDate(d);
    if (w < 1) return alert("该日期早于起始日");
    curWeek = w;
    if (weekSel) weekSel.value = String(curWeek);
    renderTable();
}
function doSearch() {
    let k = document.getElementById('searchInp').value.trim().toLowerCase();
    document.querySelectorAll('#sBody .course-box').forEach(box => {
        let content = box.innerText.toLowerCase();
        if (k !== "" && content.includes(k)) { box.classList.add('highlight'); box.style.opacity = "1"; }
        else if (k === "") { box.classList.remove('highlight'); box.style.opacity = "1"; }
        else { box.classList.remove('highlight'); box.style.opacity = "0.15"; }
    });
}
function changePage(p){
    document.getElementById('pageS').style.display=p=='S'?'block':'none';
    document.getElementById('pageT').style.display=p=='T'?'block':'none';
    document.getElementById('navS').className=(p=='S'?'active':'');
    document.getElementById('navT').className=(p=='T'?'active':'');
    if(p=='T') renderTeachers();
}
function closeM(id){ document.getElementById(id).style.display='none'; }
function preview(i){ if(i.files && i.files[0]){ let r=new FileReader(); r.onload=(e)=>{tempAva=e.target.result; document.getElementById('avaPrev').style.backgroundImage=`url(${tempAva})`;}; r.readAsDataURL(i.files[0]); } }
function updateDate(){
    config.start=document.getElementById('startDateInp').value;
    saveStorage();
    renderTable();
}
function loadWeek() { curWeek = parseInt(weekSel.value); renderTable(); }
function renderAll(){ renderTable(); renderTeachers(); }
function switchAuthTab(m){
    document.getElementById('loginForm').style.display=m=='L'?'block':'none';
    document.getElementById('regForm').style.display=m=='R'?'block':'none';
    document.getElementById('tabL').className=m=='L'?'tab-btn active':'tab-btn';
    document.getElementById('tabR').className=m=='R'?'tab-btn active':'tab-btn';
    if (m === 'R') toggleTeacherInvite();
}
function openForgotModal(){ document.getElementById('forgotModal').style.display='flex'; }
function sendForgotEmail(){ let em=document.getElementById('forgotEmail').value; for(let n in userDB){ if(userDB[n].email==em){ alert(`密码：${userDB[n].pass}`); return; } } alert("邮箱未注册"); }

// 教师管理功能
function openTModal(){
    document.getElementById('editTId').value=""; document.getElementById('tName').value=""; document.getElementById('tSub').value="";
    document.getElementById('tDY').value=""; document.getElementById('tBZ').value=""; document.getElementById('tXHS').value="";
    document.getElementById('avaPrev').style.backgroundImage=""; tempAva=""; document.getElementById('modalT').style.display='flex';
}
function editT(id){
    let t=teachers.find(x=>x.id==id);
    document.getElementById('editTId').value=t.id; document.getElementById('tName').value=t.name; document.getElementById('tSub').value=t.sub;
    document.getElementById('tDY').value=t.dy||""; document.getElementById('tBZ').value=t.bz||""; document.getElementById('tXHS').value=t.xhs||"";
    document.getElementById('avaPrev').style.backgroundImage=`url(${t.ava})`; tempAva=t.ava; document.getElementById('modalT').style.display='flex';
}
function saveT(){
    let id=document.getElementById('editTId').value, name=document.getElementById('tName').value, sub=document.getElementById('tSub').value;
    if(!name || !sub) return alert("请填写完整姓名和科目");
    let data={name,sub,ava:tempAva,dy:document.getElementById('tDY').value,bz:document.getElementById('tBZ').value,xhs:document.getElementById('tXHS').value};
    if(id){ let idx=teachers.findIndex(x=>x.id==id); teachers[idx]={id,...data}; }
    else { teachers.push({id:'t'+Date.now(),...data}); }
    saveStorage();
    renderAll(); closeM('modalT');
}
function delT(id){ if(confirm("确认删除该老师档案？相关课程将失去关联。")){ teachers=teachers.filter(x=>x.id!==id); saveStorage(); renderAll(); } }

function showDetail(r, c) {
    if(!allWeeks["week"+curWeek] || !allWeeks["week"+curWeek][r]) return;
    let item = allWeeks["week"+curWeek][r][c]; if(!item || !item.name) return;
    document.getElementById('dTitle').innerText = item.name;
    let t = teachers.find(x => x.id == item.tId);
    document.getElementById('dTeacherInfo').innerHTML = t ? `<div class="avatar-circle" style="width:50px;height:50px;margin:0 10px 0 0;background-image:url(${t.ava})"></div><div><b>${t.name}</b><br><small>${t.sub}</small></div>` : "未分配老师";
    document.getElementById('dVideoArea').innerHTML = item.video ? `<button class="btn-video-play" onclick="window.open('${item.video}')">🎬 观看回放</button>` : `<p style="color:#999;font-size:11px;">暂无回放数据</p>`;
    document.getElementById('modalD').style.display = 'flex';
}

function exportScheduleImage() {
    const target = document.querySelector('#pageS .table-wrapper');
    if (!target) return alert("未找到课表区域");
    const week = curWeek;
    html2canvas(target, { backgroundColor: "#ffffff", scale: 2 }).then(canvas => {
        const link = document.createElement('a');
        link.download = `课表_第${week}周.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }).catch(() => alert("导出失败，请重试"));
}

// 启动时加载本地持久化数据，并初始化日期/周
loadStorage();
const _d = new Date();
const todayStr = `${_d.getFullYear()}-${String(_d.getMonth()+1).padStart(2,'0')}-${String(_d.getDate()).padStart(2,'0')}`;
document.getElementById('dateViewInp').value = todayStr;
const initWeek = getWeekIndexByDate(todayStr);
curWeek = initWeek > 0 ? initWeek : 1;
weekSel.value = String(curWeek);