// ==================== 渲染逻辑 ====================
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

function renderCalendar() {
    const head = document.getElementById("calendarHead");
    const body = document.getElementById("calendarBody");
    const todayStr = getLocalDateStr();
    let headHtml = `<div class="calendar-head-cell">时间</div>`;
    for (let i = 0; i < 7; i++) {
        const info = getRealDate(curWeek, i);
        const isToday = info.full === todayStr ? "is-today" : "";
        headHtml += `<div class="calendar-head-cell ${isToday}">${weekNames[i]}<br><small>${info.show}</small></div>`;
    }
    head.innerHTML = headHtml;

    let timeCol = `<div class="calendar-time-col">`;
    for (let h = 0; h < 24; h++) {
        timeCol += `<div class="time-label">${String(h).padStart(2, "0")}:00</div>`;
    }
    timeCol += `</div>`;

    const data = allWeeks["week"+curWeek] || [];
    const sorted = sortRowsByTime(data);
    let dayCols = "";
    for (let d = 0; d < 7; d++) {
        let dayHtml = `<div class="calendar-day-col" data-day="${d}">`;
        if (getRealDate(curWeek, d).full === todayStr) {
            dayHtml += `<div class="now-line" id="nowLine"></div>`;
        }
        sorted.forEach(({ row, idx }) => {
            const item = row[d + 1] || {};
            if (!item.name) return;
            const t = teachers.find(x => x.id === item.tId);
            if (t && t.hidden) return;
            if (!isCourseTagVisible(item, t)) return;
            const { start, end } = parseTimeRange(row[0]);
            const top = (start / 60) * 50;
            const height = Math.max(30, ((end - start) / 60) * 50);
            const courseKey = getCourseKey(curWeek, idx, d + 1);
            const highlight = searchHits.has(courseKey) ? "highlight" : "";
            const seriesBg = item.seriesColor ? hexToRgba(item.seriesColor, 0.15) : "#e8f5e9";
            const seriesBorder = item.seriesColor ? item.seriesColor : "#a5d6a7";
            const wantKey = getWantKeyForItem(item, curWeek, idx, d + 1);
            const want = getWantCount(wantKey);
            dayHtml += `<div class="event-box ${highlight}" style="top:${top}px; height:${height}px; background:${seriesBg}; border-color:${seriesBorder};" onclick="showDetail(${idx},${d+1})">
                <b>${item.name}</b>
                ${t ? `<small>👤 ${t.name}</small>` : ""}
                ${item.seriesName ? `<span class="series-tag" style="background:${hexToRgba(item.seriesColor || '#4dabf7',0.2)};">${item.seriesName}</span>${item.seriesSub ? `<span class="series-sub">${item.seriesSub}</span>` : ""}` : ""}
                <div class="want-mini">想看 ${want}</div>
            </div>`;
        });
        const myList = getMyScheduleForWeek(curWeek).filter(x => Number(x.day) === d);
        myList.forEach((it) => {
            const { start, end } = parseTimeRange(it.time);
            const top = (start / 60) * 50;
            const height = Math.max(30, ((end - start) / 60) * 50);
            const cls = it.type === "课程" ? "personal course" : "personal";
            dayHtml += `<div class="event-box ${cls}" style="top:${top}px; height:${height}px;">
                <b>${it.title || "我的行程"}</b>
                <small>仅自己可见</small>
            </div>`;
        });
        dayHtml += `</div>`;
        dayCols += dayHtml;
    }
    body.innerHTML = timeCol + dayCols;
    updateNowLine();
}

function openSModal() {
    const title = document.getElementById("weekNumTitle");
    if (title) title.innerText = curWeek;
    const b = document.getElementById("editSBody");
    let tOpts = '<option value="">--未选--</option>';
    teachers.forEach(t => tOpts += `<option value="${t.id}">${t.name}</option>`);
    b.innerHTML = "";
    let data = allWeeks["week"+curWeek];
    if (!data || data.length === 0) {
        data = [["08:30-10:00",{},{},{},{},{},{},{}]];
    }
    data.forEach((row, r) => {
        const tr = document.createElement("tr");
        tr.className = "edit-table-row";
        let html = `<td><button onclick="delRow(${r})" class="btn-ui-tag-del">×</button></td>
                    <td><input class="time-inp" value="${row[0] || ''}" style="width:80px"></td>`;
        for (let c = 1; c <= 7; c++) {
            const item = row[c] || {};
            html += `<td>
                <input class="name-inp" value="${item.name||''}" placeholder="课名" style="width:70px">
                <select class="teacher-sel" style="width:70px">${tOpts}</select>
                <input class="video-inp" value="${item.video||''}" placeholder="回放" style="width:70px;margin-top:4px;font-size:10px;">
            </td>`;
        }
        tr.innerHTML = html;
        b.appendChild(tr);
        const selects = tr.querySelectorAll(".teacher-sel");
        for (let i = 0; i < 7; i++) {
            if (row[i+1] && row[i+1].tId) selects[i].value = row[i+1].tId;
        }
    });
    document.getElementById("modalS").style.display = "flex";
}

function mergeCourseDetails(oldItem, newItem) {
    if (!oldItem || !oldItem.name) return newItem;
    return {
        ...oldItem,
        ...newItem,
        tags: Array.isArray(oldItem.tags) ? oldItem.tags : [],
        outline: oldItem.outline || "",
        materials: oldItem.materials || "",
        seriesName: oldItem.seriesName || "",
        seriesSub: oldItem.seriesSub || "",
        seriesColor: oldItem.seriesColor || ""
    };
}

function saveS() {
    const oldData = allWeeks["week"+curWeek] || [];
    const rows = document.querySelectorAll(".edit-table-row");
    let newData = [];
    rows.forEach((tr, idx) => {
        let rowData = [tr.querySelector(".time-inp").value];
        const names = tr.querySelectorAll(".name-inp");
        const selects = tr.querySelectorAll(".teacher-sel");
        const videos = tr.querySelectorAll(".video-inp");
        for (let i = 0; i < 7; i++) {
            const base = { name: names[i].value, tId: selects[i].value, video: videos[i].value, updatedAt: Date.now() };
            const oldRow = oldData[idx] || [];
            const merged = mergeCourseDetails(oldRow[i+1], base);
            rowData.push(merged);
        }
        newData.push(rowData);
    });
    allWeeks["week"+curWeek] = newData;
    saveAll();
    renderCalendar();
    renderTagFilters();
    closeM("modalS");
    alert("本周课表已同步成功！");
}

function addRow() {
    if (!allWeeks["week"+curWeek]) allWeeks["week"+curWeek] = [];
    allWeeks["week"+curWeek].push(["00:00-01:00",{},{},{},{},{},{},{}]);
    saveAll();
    openSModal();
}

function delRow(idx) {
    if (confirm("确定删除此时间段吗？")) {
        allWeeks["week"+curWeek].splice(idx, 1);
        saveAll();
        openSModal();
    }
}

function updateWantUI() {
    if (!currentDetail) return;
    const item = (allWeeks["week"+currentDetail.week] || [])[currentDetail.row]?.[currentDetail.col];
    if (!item) return;
    const key = getWantKeyForItem(item, currentDetail.week, currentDetail.row, currentDetail.col);
    const count = getWantCount(key);
    const flags = getFlags(WANT_FLAGS_KEY);
    const active = !!flags[key];
    const btn = document.getElementById("wantBtn");
    btn.innerText = (active ? "💖 已想看" : "🤍 想看") + ` (${count})`;
}
function toggleWant() {
    if (!currentDetail) return;
    const item = (allWeeks["week"+currentDetail.week] || [])[currentDetail.row]?.[currentDetail.col];
    if (!item) return;
    const key = getWantKeyForItem(item, currentDetail.week, currentDetail.row, currentDetail.col);
    const flags = getFlags(WANT_FLAGS_KEY);
    if (flags[key]) {
        reactions[key] = Math.max(0, (reactions[key] || 1) - 1);
        removeFlag(WANT_FLAGS_KEY, key);
    } else {
        reactions[key] = (reactions[key] || 0) + 1;
        setFlag(WANT_FLAGS_KEY, key, true);
    }
    saveAll();
    updateWantUI();
    renderCalendar();
    renderRanks("week");
}

function showDetail(r, c) {
    const weekData = allWeeks["week"+curWeek] || [];
    if (!weekData[r]) return;
    const item = weekData[r][c];
    if (!item || !item.name) return;
    currentDetail = { week: curWeek, row: r, col: c };
    const t = teachers.find(x => x.id === item.tId);
    currentTeacherId = item.tId || null;
    document.getElementById("dTitle").innerText = item.name;
    document.getElementById("dTeacherInfo").innerHTML = t ? `<div class="avatar-circle" style="width:50px;height:50px;margin:0 10px 0 0;background-image:url(${t.ava})"></div><div><b>${t.name}</b><br><small>${t.sub}</small></div>` : "未分配老师";
    document.getElementById("dVideoArea").innerHTML = item.video ? `<button class="btn-video-play" onclick="window.open('${item.video}')">🎬 观看回放</button>` : `<p style="color:#999;font-size:11px;">暂无回放数据</p>`;
    document.getElementById("dSeries").innerHTML = item.seriesName
        ? `<div><span class="series-tag" style="background:${hexToRgba(item.seriesColor || '#4dabf7',0.2)};">系列：${item.seriesName}</span>${item.seriesSub ? `<div style="font-size:11px;color:#666;margin-top:4px;">${item.seriesSub}</div>` : ""}</div>`
        : "";
    const tagWrap = document.getElementById("dTags");
    tagWrap.innerHTML = "";
    (item.tags || []).forEach(tag => {
        const span = document.createElement("span");
        span.className = "detail-tag";
        span.innerText = tag;
        tagWrap.appendChild(span);
    });
    document.getElementById("dMaterials").innerHTML = item.materials ? `<div class="detail-label">资料</div>${item.materials.split(",").map(x => x.trim()).filter(Boolean).map(x => `<a class="teacher-link" href="${x}" target="_blank">${x}</a>`).join(" ")}` : "";
    document.getElementById("dOutline").innerText = item.outline || "暂无大纲";
    document.getElementById("dEditArea").style.display = (isTeacher && t && currentUser && t.id === currentUser.teacherId) ? "block" : "none";
    document.getElementById("dSeriesName").value = item.seriesName || "";
    document.getElementById("dSeriesSub").value = item.seriesSub || "";
    document.getElementById("dSeriesColor").value = item.seriesColor || "";
    document.getElementById("dTagsInp").value = (item.tags || []).join(",");
    document.getElementById("dMaterialsInp").value = item.materials || "";
    document.getElementById("dVideoInp").value = item.video || "";
    document.getElementById("dOutlineInp").value = item.outline || "";
    updateWantUI();
    updateFollowUI();
    renderComments();
    document.getElementById("modalD").style.display = "flex";
}

function saveCourseDetail() {
    if (!currentDetail) return;
    const data = allWeeks["week"+currentDetail.week] || [];
    const row = data[currentDetail.row];
    if (!row) return;
    const item = row[currentDetail.col] || {};
    const t = teachers.find(x => x.id === item.tId);
    if (!isTeacher || !currentUser || !t || t.id !== currentUser.teacherId) {
        return alert("只有授课老师可以编辑该课程详情");
    }
    item.seriesName = document.getElementById("dSeriesName").value.trim();
    item.seriesSub = document.getElementById("dSeriesSub").value.trim();
    item.seriesColor = document.getElementById("dSeriesColor").value.trim();
    item.tags = document.getElementById("dTagsInp").value.split(",").map(x => x.trim()).filter(Boolean);
    item.materials = document.getElementById("dMaterialsInp").value.trim();
    item.video = document.getElementById("dVideoInp").value.trim();
    item.outline = document.getElementById("dOutlineInp").value.trim();
    item.updatedAt = Date.now();
    row[currentDetail.col] = item;
    allWeeks["week"+currentDetail.week] = data;
    saveAll();
    showDetail(currentDetail.row, currentDetail.col);
    renderCalendar();
    renderTagFilters();
}

function renderComments() {
    const wrap = document.getElementById("dComments");
    wrap.innerHTML = "";
    if (!currentDetail) return;
    const item = (allWeeks["week"+currentDetail.week] || [])[currentDetail.row]?.[currentDetail.col];
    if (!item) return;
    (item.comments || []).forEach(c => {
        const div = document.createElement("div");
        div.className = "comment-item";
        div.innerHTML = `<div class="comment-meta">${c.user || "匿名"} (${c.role || "学生"}) · ${new Date(c.ts).toLocaleString()}</div><div>${c.text}</div>`;
        const replies = document.createElement("div");
        replies.className = "reply-list";
        (c.replies || []).forEach(r => {
            const rp = document.createElement("div");
            rp.className = "comment-item";
            rp.innerHTML = `<div class="comment-meta">${r.user} (${r.role})</div><div>${r.text}</div>`;
            replies.appendChild(rp);
        });
        const replyInput = document.createElement("div");
        replyInput.className = "reply-input";
        replyInput.innerHTML = `<input placeholder="回复..."><button class="btn-ui-secondary">回复</button>`;
        replyInput.querySelector("button").onclick = () => addReply(c.id, replyInput.querySelector("input").value);
        replies.appendChild(replyInput);
        div.appendChild(replies);
        wrap.appendChild(div);
    });
}

function addComment() {
    const inp = document.getElementById("dCommentInput");
    const text = inp.value.trim();
    if (!text || !currentDetail) return;
    const data = allWeeks["week"+currentDetail.week] || [];
    const item = data[currentDetail.row][currentDetail.col];
    if (!item.comments) item.comments = [];
    item.comments.push({ id: "c"+Date.now(), user: currentUser?.name || "匿名", role: currentUser?.type || "学生", text, ts: Date.now(), replies: [] });
    inp.value = "";
    saveAll();
    renderComments();
}
function addReply(cid, text) {
    if (!text || !currentDetail) return;
    const item = (allWeeks["week"+currentDetail.week] || [])[currentDetail.row]?.[currentDetail.col];
    if (!item) return;
    const target = (item.comments || []).find(c => c.id === cid);
    if (!target) return;
    target.replies = target.replies || [];
    target.replies.push({ user: currentUser?.name || "匿名", role: currentUser?.type || "学生", text });
    saveAll();
    renderComments();
}

function getCourseRankMap(mode) {
    const map = {};
    const temp = new Map();
    Object.keys(allWeeks).forEach(weekKey => {
        const rows = allWeeks[weekKey] || [];
        rows.forEach((row, r) => {
            for (let c = 1; c <= 7; c++) {
                const item = row[c];
                if (!item || !item.name) continue;
                const t = teachers.find(x => x.id === item.tId);
                if (t && t.hidden) continue;
                const seriesKey = getSeriesKey(item);
                const wantKey = getWantKeyForItem(item, weekKey.replace("week",""), r, c);
                const key = seriesKey || item.name;
                if (!temp.has(key)) temp.set(key, getWantCount(wantKey));
            }
        });
    });
    const sorted = Array.from(temp.entries()).sort((a,b)=>b[1]-a[1]);
    sorted.forEach((it, idx) => { map[it[0]] = idx + 1; });
    return map;
}

function updateNowLine() {
    const line = document.getElementById("nowLine");
    if (!line) return;
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const top = (minutes / 60) * 50;
    line.style.top = `${top}px`;
}
function jumpToDate() {
    const d = document.getElementById("dateViewInp").value;
    if (!d) return;
    const w = getWeekIndexByDate(d);
    if (w < 1) return alert("该日期早于起始日");
    curWeek = w;
    weekSel.value = String(curWeek);
    renderCalendar();
}
function loadWeek() {
    curWeek = parseInt(weekSel.value, 10);
    renderCalendar();
}
function updateDate() {
    config.start = document.getElementById("startDateInp").value;
    saveAll();
    renderCalendar();
}
function scrollToOutline() {
    const el = document.getElementById("dOutline");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}