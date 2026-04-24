// 教师管理功能
function isFollowed(teacherId) {
    const flags = getFlags(FOLLOW_FLAGS_KEY);
    return !!flags[teacherId];
}
function updateFollowUI() {
    if (!currentTeacherId) return;
    const count = followCounts[currentTeacherId] || 0;
    const btn = document.getElementById("teacherFollowBtn");
    if (btn) btn.innerText = (isFollowed(currentTeacherId) ? "已关注" : "关注") + ` (${count})`;
    const btnDetail = document.getElementById("followBtn");
    if (btnDetail) btnDetail.innerText = (isFollowed(currentTeacherId) ? "已关注" : "关注并订阅") + ` (${count})`;
}
function toggleFollowTeacherById(teacherId) {
    const flags = getFlags(FOLLOW_FLAGS_KEY);
    if (flags[teacherId]) {
        followCounts[teacherId] = Math.max(0, (followCounts[teacherId] || 1) - 1);
        removeFlag(FOLLOW_FLAGS_KEY, teacherId);
    } else {
        followCounts[teacherId] = (followCounts[teacherId] || 0) + 1;
        setFlag(FOLLOW_FLAGS_KEY, teacherId, true);
    }
    saveAll();
    updateFollowUI();
    renderRanks("week");
}
function toggleFollowTeacher() {
    if (!currentTeacherId) return;
    toggleFollowTeacherById(currentTeacherId);
}
function toggleFollowFromDetail() {
    if (!currentTeacherId) return;
    toggleFollowTeacherById(currentTeacherId);
}

function renderTeachers() {
    const g = document.getElementById("teacherGrid");
    g.innerHTML = "";
    const keyword = teacherSearchKey.trim().toLowerCase();
    let list = teachers.filter(t => {
        if (!isAdmin && t.hidden) return false;
        const inCat = (currentCategory === "全部" || t.category === currentCategory);
        if (!inCat) return false;
        if (!keyword) return true;
        const text = [t.name, t.sub, t.category, t.signature].join(" ").toLowerCase();
        return text.includes(keyword);
    });
    list.sort((a, b) => (a.name || "").localeCompare((b.name || ""), "zh-Hans-CN"));
    list.forEach(t => {
        const links = (t.links || []).map(l => `<div class="social-item"><span>${l.label}</span></div>`).join("");
        const catSelect = isAdmin ? `<select onchange="setTeacherCategory('${t.id}', this.value)">${teacherCategories.map(c => `<option value="${c}" ${t.category===c?'selected':''}>${c}</option>`).join("")}</select>` : "";
        const hideBtn = isAdmin ? `<button onclick="toggleTeacherHidden('${t.id}')" class="btn-ui-tag-del">${t.hidden ? "取消隐藏" : "隐藏"}</button>` : "";
        g.innerHTML += `<div class="teacher-card">
            <div class="avatar-circle" onclick="openTeacherModal('${t.id}')" style="background-image:url(${t.ava})"></div>
            <b onclick="openTeacherModal('${t.id}')">${t.name}</b>
            <p style="font-size:12px;color:var(--primary-dark)">${t.sub}</p>
            <div class="social-display-list">${links}</div>
            <div style="font-size:11px;color:#666; margin-top:6px;">分类：${t.category || "未分类"} ${t.hidden ? "· 已隐藏" : ""}</div>
            ${isAdmin ? `<div style="margin-top:8px; display:flex; gap:6px; align-items:center;">${catSelect}${hideBtn}<button onclick="delT('${t.id}')" class="btn-ui-tag-del">删除</button></div>` : ""}
        </div>`;
    });
}

function openTeacherModal(id) {
    const t = teachers.find(x => x.id === id);
    if (t && t.hidden && !isAdmin) {
        alert("该老师主页已隐藏");
        return;
    }
    currentTeacherId = id;
    renderTeacherModal();
    document.getElementById("modalTeacher").style.display = "flex";
}
function renderTeacherModal() {
    const t = teachers.find(x => x.id === currentTeacherId);
    if (!t) return;
    document.getElementById("teacherAva").style.backgroundImage = `url(${t.ava})`;
    document.getElementById("teacherName").innerText = t.name;
    document.getElementById("teacherSub").innerText = `${t.sub}${t.category ? " · " + t.category : ""}`;
    const linkWrap = document.getElementById("teacherLinks");
    linkWrap.innerHTML = (t.links || []).map(l => `<a class="teacher-link" href="${l.url}" target="_blank">${l.label}</a>`).join("") || `<div style="color:#999;font-size:11px;">暂无平台链接</div>`;
    document.getElementById("teacherSignature").innerText = t.signature || "";
    const courses = [];
    Object.keys(allWeeks).forEach(weekKey => {
        const rows = allWeeks[weekKey] || [];
        rows.forEach((row, r) => {
            for (let c = 1; c <= 7; c++) {
                const item = row[c];
                if (item && item.name && item.tId === t.id) {
                    courses.push({ week: weekKey, row: r, col: c, time: row[0], name: item.name, seriesName: item.seriesName, seriesSub: item.seriesSub });
                }
            }
        });
    });
    const list = document.getElementById("teacherCourses");
    const rankMap = getCourseRankMap(currentRankMode);
    const now = new Date();
    const upcoming = [];
    const past = [];
    courses.forEach(c => {
        const dt = getCourseDateTime(Number(c.week.replace("week","")), c.col-1, c.time);
        const isPast = dt && dt < now;
        const key = c.seriesName ? `series:${t.id}:${c.seriesName}` : c.name;
        const rank = rankMap[key] || "-";
        const title = `${c.seriesName || c.name}${c.seriesSub ? " · " + c.seriesSub : ""}`;
        const itemHtml = `<div class="teacher-course-item" onclick="jumpToCourse(${c.week.replace('week','')},${c.row},${c.col})">${title} (${c.time}) <span style="color:#888;">排名 #${rank}</span></div>`;
        if (isPast) past.push(itemHtml);
        else upcoming.push(itemHtml);
    });
    list.innerHTML = `
        <div style="margin-bottom:8px;"><b>未播课程</b></div>
        ${upcoming.join("") || "<div style='color:#999;'>暂无未播课程</div>"}
        <div style="margin:12px 0 8px;"><b>历史课程</b></div>
        ${past.join("") || "<div style='color:#999;'>暂无历史课程</div>"}
    `;
    document.getElementById("teacherEditBtn").style.display = ((isTeacher && currentUser && currentUser.teacherId === t.id) || isAdmin) ? "inline-block" : "none";
    updateFollowUI();
}
function jumpToCourse(weekNum, row, col) {
    closeM("modalTeacher");
    curWeek = Number(weekNum);
    weekSel.value = String(curWeek);
    renderCalendar();
    showDetail(row, col);
}

function openMyTeacherProfile() {
    if (!currentUser || !currentUser.teacherId) return;
    openTeacherModal(currentUser.teacherId);
}
function editTeacherSelf() {
    const t = teachers.find(x => x.id === currentTeacherId);
    if (!t) return;
    if (!(isAdmin || (isTeacher && currentUser && currentUser.teacherId === t.id))) return;
    openTeacherEditModal(t);
}

function openTeacherEditModal(t) {
    teacherEditAva = t.ava || "";
    document.getElementById("teacherEditAva").style.backgroundImage = `url(${teacherEditAva})`;
    document.getElementById("teacherEditName").value = t.name || "";
    document.getElementById("teacherEditSub").value = t.sub || "";
    document.getElementById("teacherEditSign").value = t.signature || "";
    const catSel = document.getElementById("teacherEditCat");
    const cats = [...teacherCategories, "未分类"];
    catSel.innerHTML = cats.map(c => `<option value="${c}" ${t.category===c?'selected':''}>${c}</option>`).join("");
    if (!t.category) t.category = "未分类";
    catSel.value = t.category;
    const wrap = document.getElementById("teacherEditLinks");
    wrap.innerHTML = "";
    (t.links || []).forEach(l => addTeacherLinkRow(l.label, l.url));
    if ((t.links || []).length === 0) addTeacherLinkRow();
    document.getElementById("modalTeacherEdit").style.display = "flex";
}
function addTeacherLinkRow(label = "", url = "") {
    const wrap = document.getElementById("teacherEditLinks");
    const row = document.createElement("div");
    row.className = "link-row";
    row.innerHTML = `
        <div style="flex:1;">
            <select class="platform-select">
                ${PLATFORM_OPTIONS.map(p => `<option value="${p}" ${p===label?'selected':''}>${p}</option>`).join("")}
            </select>
        </div>
        <input placeholder="链接地址" value="${url}">
        <button class="btn-ui-tag-del">删</button>`;
    row.querySelector("button").onclick = () => row.remove();
    wrap.appendChild(row);
}
function previewTeacherEdit(i) {
    if (i.files && i.files[0]) {
        const r = new FileReader();
        r.onload = (e) => {
            teacherEditAva = e.target.result;
            document.getElementById("teacherEditAva").style.backgroundImage = `url(${teacherEditAva})`;
        };
        r.readAsDataURL(i.files[0]);
    }
}
function saveTeacherProfile() {
    const targetId = isAdmin ? currentTeacherId : currentUser?.teacherId;
    if (!targetId) return;
    const t = teachers.find(x => x.id === targetId);
    if (!t) return;
    t.ava = teacherEditAva;
    t.signature = document.getElementById("teacherEditSign").value.trim();
    t.category = document.getElementById("teacherEditCat").value || t.category;
    const links = [];
    document.querySelectorAll("#teacherEditLinks .link-row").forEach(row => {
        const label = row.querySelector(".platform-select")?.value?.trim();
        const url = row.querySelector("input")?.value?.trim();
        if (label && url) links.push({ label, url });
    });
    t.links = links;
    saveAll();
    renderTeacherModal();
    renderTeachers();
    closeM("modalTeacherEdit");
}

function openTModal() {
    document.getElementById("editTId").value="";
    document.getElementById("tName").value="";
    fillSubOptions();
    document.getElementById("tSub").value="";
    document.getElementById("tLinkLabel1").value="";
    document.getElementById("tLinkUrl1").value="";
    document.getElementById("tLinkLabel2").value="";
    document.getElementById("tLinkUrl2").value="";
    document.getElementById("avaPrev").style.backgroundImage="";
    tempAva="";
    document.getElementById("modalT").style.display="flex";
}
function editT(id) {
    const t = teachers.find(x => x.id === id);
    if (!t) return;
    document.getElementById("editTId").value=t.id;
    document.getElementById("tName").value=t.name;
    fillSubOptions();
    document.getElementById("tSub").value=t.sub || "";
    document.getElementById("avaPrev").style.backgroundImage=`url(${t.ava})`;
    tempAva=t.ava || "";
    const l1 = t.links?.[0] || {};
    const l2 = t.links?.[1] || {};
    document.getElementById("tLinkLabel1").value=l1.label||"";
    document.getElementById("tLinkUrl1").value=l1.url||"";
    document.getElementById("tLinkLabel2").value=l2.label||"";
    document.getElementById("tLinkUrl2").value=l2.url||"";
    document.getElementById("modalT").style.display="flex";
}
function saveT() {
    const id = document.getElementById("editTId").value;
    const name = document.getElementById("tName").value.trim();
    const sub = document.getElementById("tSub").value.trim();
    if (!name || !sub) return alert("请填写完整姓名和科目");
    const isSelfTeacher = isTeacher && currentUser && currentUser.teacherId === id;
    const existing = teachers.find(x => x.id === id) || {};
    const links = [];
    const l1 = document.getElementById("tLinkLabel1").value.trim();
    const u1 = document.getElementById("tLinkUrl1").value.trim();
    const l2 = document.getElementById("tLinkLabel2").value.trim();
    const u2 = document.getElementById("tLinkUrl2").value.trim();
    if (l1 && u1) links.push({ label: l1, url: u1 });
    if (l2 && u2) links.push({ label: l2, url: u2 });
    const data = {
        name,
        sub,
        ava: isSelfTeacher ? tempAva : (existing.ava || ""),
        links: isSelfTeacher ? links : (existing.links || []),
        signature: isSelfTeacher ? (existing.signature || "") : (existing.signature || ""),
        category: existing.category || sub || "默认",
        hidden: typeof existing.hidden === "boolean" ? existing.hidden : false
    };
    if (id) {
        const idx = teachers.findIndex(x => x.id === id);
        teachers[idx] = { id, ...data };
    } else {
        teachers.push({ id: "t"+Date.now(), ...data, category: "默认", signature: "" });
    }
    saveAll();
    renderTeachers();
    closeM("modalT");
}

function fillSubOptions() {
    const sel = document.getElementById("tSub");
    if (!sel) return;
    const opts = teacherCategories.length ? teacherCategories : ["默认"];
    sel.innerHTML = `<option value="">请选择科目</option>` + opts.map(c => `<option value="${c}">${c}</option>`).join("");
}
function delT(id) {
    if (confirm("确认删除该老师档案？相关课程将失去关联。")) {
        teachers = teachers.filter(x => x.id !== id);
        Object.keys(allWeeks).forEach(weekKey => {
            const rows = allWeeks[weekKey] || [];
            rows.forEach(row => {
                for (let c = 1; c <= 7; c++) {
                    const item = row[c];
                    if (item && item.tId === id) {
                        row[c] = {};
                    }
                }
            });
        });
        saveAll();
        renderTeachers();
        renderCalendar();
        renderRanks(currentRankMode);
    }
}

function toggleTeacherInvite() {
    const role = document.getElementById("rRole").value;
    document.getElementById("rInvite").style.display = role === "teacher" ? "block" : "none";
}
function generateInviteCode() {
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    inviteCodes.push(code);
    saveAll();
    renderInviteList();
}
function renderInviteList() {
    const panel = document.getElementById("invitePanel");
    const list = document.getElementById("inviteList");
    if (!isAdmin && !isSuper) { panel.style.display = "none"; return; }
    panel.style.display = "block";
    list.innerHTML = inviteCodes.map(c => `<span class="invite-code">${c}</span>`).join("") || "<span style='color:#999;'>暂无邀请码</span>";
}