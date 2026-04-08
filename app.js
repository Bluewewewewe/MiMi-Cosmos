const SUPABASE_URL = "https://abdjwwhwpuvvfvenvmtx.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_lhJEVj76ZpvRuf2XRoB31A_lLHDuAdf";
const CLOUD_CHAT_ENABLED = true;
const STORAGE_KEY_V2 = "mimi_university_data_v2";
const WANT_FLAGS_KEY = "mimi_want_flags_v1";
const FOLLOW_FLAGS_KEY = "mimi_follow_flags_v1";
const weekNames = ["周日","周一","周二","周三","周四","周五","周六"];

let reactions = {};
let followCounts = {};
let inviteCodes = [];
let teacherCategories = [];
let lastLoginAt = {};
let currentUser = null;
let currentDetail = null;
let currentTeacherId = null;
let chatMessages = [];
let chatExpanded = false;
let chatChannel = null;
let searchHits = new Set();
let isTeacher = false;
let currentCategory = "全部";
let teacherSearchKey = "";
let teacherEditAva = "";
let tagFilterState = {};
let rankReasons = {};
let currentRankKey = "";
let rankReasonOpen = {};
let userSchedules = {};
let currentRankMode = "week";
const PLATFORM_OPTIONS = ["微博","抖音","小红书","B站","公众号","视频号","知乎","小宇宙"];
const REASON_LIKE_FLAGS_KEY = "mimi_rank_reason_likes_v1";

let supabaseClient = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase) {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

function getDefaultState() {
    return {
        userDB: {
            "admin": { uid: "UID001", pass: "admin123", type: "admin", email: "a@m.com" },
            "super": { uid: "UID000", pass: "super123", type: "super", email: "s@m.com" }
        },
        teachers: [{ id: "t1", name: "张老师", sub: "高数", ava: "", links: [], signature: "", category: "默认", hidden: false }],
        allWeeks: { "week1": [["08:30-10:00", {name:"高数入门", tId:"t1", video:"", tags:[], outline:"", materials:"", seriesName:"", seriesSub:"", seriesColor:"", comments:[], updatedAt: Date.now()}, {}, {}, {}, {}, {}, {}]] },
        reactions: {},
        followCounts: {},
        inviteCodes: [],
        teacherCategories: ["默认"],
        rankReasons: {},
        userSchedules: {},
        lastLoginAt: {},
        config: { start: "2026-04-07" },
        chatMessages: []
    };
}

async function loadCloudState() {
    if (!supabaseClient) return null;
    const { data, error } = await supabaseClient.from("app_state").select("data").eq("id", "main").maybeSingle();
    if (error || !data) return null;
    return data.data || null;
}

async function saveCloudState(payload) {
    if (!supabaseClient) return;
    await supabaseClient.from("app_state").upsert({ id: "main", data: payload });
}

function loadStorageV2() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY_V2);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (e) {
        return null;
    }
}

function saveStorageV2(payload) {
    localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(payload));
    saveCloudState(payload).catch(() => {});
}

function normalizeData() {
    if (!Array.isArray(teachers)) teachers = [];
    teachers = teachers.map(t => {
        if (!t.links) {
            const links = [];
            if (t.dy) links.push({ label: "抖音", url: t.dy });
            if (t.bz) links.push({ label: "B站", url: t.bz });
            if (t.xhs) links.push({ label: "小红书", url: t.xhs });
            t.links = links;
            delete t.dy; delete t.bz; delete t.xhs;
        }
        if (!t.signature) t.signature = "";
        if (!t.category) t.category = t.sub || "默认";
        if (typeof t.hidden !== "boolean") t.hidden = false;
        return t;
    });
    if (!allWeeks || typeof allWeeks !== "object") allWeeks = {};
    Object.keys(allWeeks).forEach(k => {
        const rows = allWeeks[k];
        if (!Array.isArray(rows)) return;
        rows.forEach(row => {
            for (let i = 1; i <= 7; i++) {
                if (!row[i]) row[i] = {};
                const item = row[i];
                if (item.name) {
                    item.tags = Array.isArray(item.tags) ? item.tags : [];
                    item.outline = item.outline || "";
                    item.materials = item.materials || "";
                    item.seriesName = item.seriesName || "";
                    item.seriesSub = item.seriesSub || "";
                    item.seriesColor = item.seriesColor || "";
                    item.comments = Array.isArray(item.comments) ? item.comments : [];
                    item.updatedAt = item.updatedAt || Date.now();
                }
            }
        });
    });
    reactions = reactions || {};
    followCounts = followCounts || {};
    inviteCodes = inviteCodes || [];
    if (!Array.isArray(teacherCategories) || teacherCategories.length === 0) teacherCategories = ["默认"];
    rankReasons = rankReasons || {};
    userSchedules = userSchedules || {};
    Object.keys(rankReasons).forEach(k => {
        if (!Array.isArray(rankReasons[k])) rankReasons[k] = [];
        rankReasons[k] = rankReasons[k].map(r => {
            if (typeof r === "string") return { id: "r"+Math.random().toString(36).slice(2), text: r, user: "匿名", ts: Date.now(), likes: 0 };
            return { id: r.id || ("r"+Math.random().toString(36).slice(2)), text: r.text || "", user: r.user || "匿名", ts: r.ts || Date.now(), likes: r.likes || 0 };
        });
    });
    lastLoginAt = lastLoginAt || {};
    chatMessages = Array.isArray(chatMessages) ? chatMessages : [];
}

async function initApp() {
    const localState = loadStorageV2();
    let base = localState || getDefaultState();
    if (supabaseClient) {
        const cloud = await loadCloudState();
        if (cloud) base = cloud;
    }
    userDB = base.userDB || userDB;
    teachers = base.teachers || teachers;
    allWeeks = base.allWeeks || allWeeks;
    reactions = base.reactions || {};
    followCounts = base.followCounts || {};
    inviteCodes = base.inviteCodes || [];
    teacherCategories = base.teacherCategories || [];
    rankReasons = base.rankReasons || {};
    userSchedules = base.userSchedules || {};
    lastLoginAt = base.lastLoginAt || {};
    config = base.config || config;
    chatMessages = base.chatMessages || [];
    normalizeData();

    const today = getLocalDateStr();
    document.getElementById("dateViewInp").value = today;
    curWeek = Math.max(1, getWeekIndexByDate(today));
    weekSel.value = String(curWeek);
    renderAll();
    initChat();
    renderChat();
    toggleTeacherInvite();
    updateNowLine();
    setInterval(updateNowLine, 60000);

    const chatInp = document.getElementById("chatInput");
    if (chatInp) {
        chatInp.addEventListener("keydown", (e) => {
            if (e.key === "Enter") sendChat();
        });
    }
    const searchInp = document.getElementById("searchInp");
    if (searchInp) {
        searchInp.addEventListener("keydown", (e) => {
            if (e.key === "Enter") doSearch();
        });
    }
    const teacherSearchInp = document.getElementById("teacherSearchInp");
    if (teacherSearchInp) {
        teacherSearchInp.addEventListener("keydown", (e) => {
            if (e.key === "Enter") filterTeachers();
        });
    }
}

function saveAll() {
    const payload = { userDB, teachers, allWeeks, reactions, followCounts, inviteCodes, teacherCategories, rankReasons, userSchedules, lastLoginAt, config, chatMessages };
    saveStorageV2(payload);
}

function parseMinutes(t) {
    if (!t) return 0;
    const [h, m] = t.split(":").map(x => parseInt(x, 10));
    return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
}
function parseTimeRange(range) {
    const [s, e] = (range || "").split("-");
    const start = parseMinutes(s);
    const end = Math.max(start + 30, parseMinutes(e));
    return { start, end };
}
function parseStartMinutes(range) {
    return parseTimeRange(range).start;
}
function formatLocalDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}
function getLocalDateStr() {
    return formatLocalDate(new Date());
}
function sortRowsByTime(rows) {
    return rows.map((row, idx) => ({ row, idx })).sort((a, b) => parseStartMinutes(a.row[0]) - parseStartMinutes(b.row[0]));
}
function hexToRgba(hex, alpha) {
    if (!hex) return `rgba(154,205,50,${alpha})`;
    let h = hex.replace("#", "");
    if (h.length === 3) h = h.split("").map(x => x + x).join("");
    const r = parseInt(h.substring(0,2), 16);
    const g = parseInt(h.substring(2,4), 16);
    const b = parseInt(h.substring(4,6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
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

function renderAll() {
    renderCalendar();
    renderTeachers();
    renderInviteList();
    renderCategoryList();
    renderTagFilters();
    renderRanks("week");
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

function getFlags(key) {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    try { return JSON.parse(raw) || {}; } catch { return {}; }
}
function setFlag(key, flagKey, value) {
    const flags = getFlags(key);
    flags[flagKey] = value;
    localStorage.setItem(key, JSON.stringify(flags));
}
function removeFlag(key, flagKey) {
    const flags = getFlags(key);
    delete flags[flagKey];
    localStorage.setItem(key, JSON.stringify(flags));
}

function getCourseKey(w, r, c) {
    return `${w}_${r}_${c}`;
}
function getSeriesKey(item) {
    if (!item || !item.seriesName) return null;
    return `series:${item.tId || "none"}:${item.seriesName}`;
}
function getWantKeyForItem(item, w, r, c) {
    const seriesKey = getSeriesKey(item);
    return seriesKey || getCourseKey(w, r, c);
}
function getWantCount(courseKey) {
    return reactions[courseKey] || 0;
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

function getCourseDateTime(weekNum, dayIndex, timeRange) {
    try {
        const dateInfo = getRealDate(weekNum, dayIndex);
        const start = (timeRange || "").split("-")[0] || "00:00";
        return new Date(`${dateInfo.full}T${start}:00`);
    } catch {
        return null;
    }
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

function getRealDate(w, d) {
    let base = new Date(config.start);
    let target = new Date(base.getTime() + ((w-1)*7 + d)*86400000);
    return { show: (target.getMonth()+1)+"/"+target.getDate(), full: formatLocalDate(target) };
}
function getWeekIndexByDate(dateStr) {
    const base = new Date(config.start);
    const target = new Date(dateStr);
    const diffDays = Math.floor((target - base) / 86400000);
    if (Number.isNaN(diffDays)) return 1;
    return Math.floor(diffDays / 7) + 1;
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

function doSearch() {
    const k = document.getElementById("searchInp").value.trim().toLowerCase();
    const results = [];
    searchHits = new Set();
    if (k) {
        Object.keys(allWeeks).forEach(weekKey => {
            const rows = allWeeks[weekKey] || [];
            rows.forEach((row, r) => {
                for (let c = 1; c <= 7; c++) {
                    const item = row[c];
                    if (!item || !item.name) continue;
                    const t = teachers.find(x => x.id === item.tId);
                    if (t && t.hidden) continue;
                    const text = [item.name, t?.name, (item.tags||[]).join(" "), item.outline, item.seriesName, item.seriesSub].join(" ").toLowerCase();
                    if (text.includes(k)) {
                        const wk = weekKey.replace("week", "");
                        results.push({ type: "课程", label: `${item.name} (${weekNames[c-1]} ${row[0]})`, week: Number(wk), row: r, col: c });
                        searchHits.add(getCourseKey(Number(wk), r, c));
                    }
                }
            });
        });
        teachers.forEach(t => {
            if (t.hidden && !isAdmin) return;
            const text = [t.name, t.sub, t.category, t.signature, ...(t.links||[]).map(l => l.label)].join(" ").toLowerCase();
            if (text.includes(k)) results.push({ type: "老师主页", label: t.name, teacherId: t.id });
        });
    }
    renderCalendar();
    renderSearchResults(results);
}
function renderSearchResults(results) {
    const box = document.getElementById("searchResults");
    if (!results || results.length === 0) { box.style.display = "none"; return; }
    box.style.display = "block";
    box.innerHTML = results.slice(0, 20).map(r => `<div class="search-item" onclick="${r.type==='课程' ? `jumpToCourse(${r.week},${r.row},${r.col})` : `openTeacherModal('${r.teacherId}')`}"><span class="search-type">[${r.type}]</span>${r.label}</div>`).join("");
}

function showNotifications(sinceOverride) {
    if (!currentUser) return;
    const bar = document.getElementById("notifyBar");
    const followIds = Object.keys(getFlags(FOLLOW_FLAGS_KEY));
    if (!followIds.length) { bar.style.display = "none"; return; }
    const since = typeof sinceOverride === "number" ? sinceOverride : (lastLoginAt[currentUser.name] || 0);
    const newCourses = [];
    Object.keys(allWeeks).forEach(weekKey => {
        const rows = allWeeks[weekKey] || [];
        rows.forEach((row, r) => {
            for (let c = 1; c <= 7; c++) {
                const item = row[c];
                if (!item || !item.name) continue;
                const t = teachers.find(x => x.id === item.tId);
                if (t && t.hidden) continue;
                if (followIds.includes(item.tId) && (item.updatedAt || 0) > since) {
                    newCourses.push(`${item.name} (${weekNames[c-1]} ${row[0]})`);
                }
            }
        });
    });
    if (newCourses.length) {
        bar.style.display = "block";
        bar.innerText = "关注老师更新：" + newCourses.slice(0, 5).join("，");
    } else {
        bar.style.display = "none";
    }
}

function renderRanks(mode) {
    currentRankMode = mode;
    const courseWrap = document.getElementById("rankCourses");
    const teacherWrap = document.getElementById("rankTeachers");
    const courseMap = new Map();
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
                const key = seriesKey || wantKey;
                if (!courseMap.has(key)) {
                    courseMap.set(key, { name: item.seriesName || item.name, sub: item.seriesSub || "", count: getWantCount(wantKey), key });
                }
            }
        });
    });
    const courseCounts = Array.from(courseMap.values()).sort((a,b)=>b.count-a.count);
    courseWrap.innerHTML = courseCounts.slice(0,10).map(x => {
        const key = getRankKey(mode, "course", x.key);
        const reasons = rankReasons[key] || [];
        const open = !!rankReasonOpen[key];
        const safeKey = encodeURIComponent(key);
        const safeName = encodeURIComponent(x.name);
        return `<div>
            <div class="rank-item">
                <span>${x.name}${x.sub ? " · " + x.sub : ""}</span>
                <div style="display:flex; gap:6px; align-items:center;">
                    <b>${x.count}</b>
                    <button class="rank-reason-btn" onclick="toggleRankReason('${safeKey}')">理由(${reasons.length})</button>
                    <button class="rank-reason-btn" onclick="openRankReason('${safeKey}','${safeName}')">+</button>
                    ${isAdmin ? `<button class="rank-reason-btn" onclick="deleteRankItem('${safeKey}','course')">删除</button>` : ""}
                </div>
            </div>
            ${open ? renderRankReasonList(reasons) : ""}
        </div>`;
    }).join("") || "<div style='color:#999;'>暂无数据</div>";
    const teacherCounts = teachers.filter(t => !t.hidden).map(t => ({ id: t.id, name: t.name, count: followCounts[t.id] || 0 }));
    teacherCounts.sort((a,b)=>b.count-a.count);
    teacherWrap.innerHTML = teacherCounts.slice(0,10).map(x => {
        const key = getRankKey(mode, "teacher", x.id);
        const reasons = rankReasons[key] || [];
        const open = !!rankReasonOpen[key];
        const safeKey = encodeURIComponent(key);
        const safeName = encodeURIComponent(x.name);
        return `<div>
            <div class="rank-item">
                <span>${x.name}</span>
                <div style="display:flex; gap:6px; align-items:center;">
                    <b>${x.count}</b>
                    <button class="rank-reason-btn" onclick="toggleRankReason('${safeKey}')">理由(${reasons.length})</button>
                    <button class="rank-reason-btn" onclick="openRankReason('${safeKey}','${safeName}')">+</button>
                    ${isAdmin ? `<button class="rank-reason-btn" onclick="deleteRankItem('${safeKey}','teacher')">删除</button>` : ""}
                </div>
            </div>
            ${open ? renderRankReasonList(reasons) : ""}
        </div>`;
    }).join("") || "<div style='color:#999;'>暂无数据</div>";
}

function getRankKey(mode, type, name) {
    return `${mode}:${type}:${name}`;
}
function renderRankReasonList(reasons) {
    if (!reasons.length) return `<div class="rank-reason-text">暂无推荐理由</div>`;
    return reasons.map(r => {
        const liked = isReasonLiked(r.id);
        const time = new Date(r.ts || Date.now()).toLocaleString();
        return `<div class="rank-reason-text">
            ${r.text} (${r.user})
            <div class="rank-reason-meta">
                <span>时间：${time}</span>
                <button class="rank-like-btn" onclick="toggleReasonLike('${r.id}')">👍 ${r.likes || 0}</button>
            </div>
        </div>`;
    }).join("");
}

function getReasonLikeFlags() {
    const raw = localStorage.getItem(REASON_LIKE_FLAGS_KEY);
    if (!raw) return {};
    try { return JSON.parse(raw) || {}; } catch { return {}; }
}
function isReasonLiked(id) {
    const flags = getReasonLikeFlags();
    return !!flags[id];
}
function toggleReasonLike(id) {
    const flags = getReasonLikeFlags();
    const liked = !!flags[id];
    Object.keys(rankReasons).forEach(key => {
        const list = rankReasons[key] || [];
        list.forEach(r => {
            if (r.id === id) {
                r.likes = r.likes || 0;
                r.likes = liked ? Math.max(0, r.likes - 1) : r.likes + 1;
            }
        });
    });
    if (liked) delete flags[id];
    else flags[id] = true;
    localStorage.setItem(REASON_LIKE_FLAGS_KEY, JSON.stringify(flags));
    saveAll();
    renderRanks(currentRankMode);
}

function deleteRankItem(safeKey, type) {
    if (!isAdmin) return;
    const key = decodeURIComponent(safeKey);
    if (!confirm("确认删除该排行榜条目？相关课程/老师也会删除")) return;
    if (type === "teacher") {
        const parts = key.split(":");
        const teacherId = parts[2];
        if (teacherId) delT(teacherId);
        return;
    }
    if (type === "course") {
        const parts = key.split(":");
        const seriesKey = parts.slice(2).join(":");
        Object.keys(allWeeks).forEach(weekKey => {
            const rows = allWeeks[weekKey] || [];
            rows.forEach(row => {
                for (let c = 1; c <= 7; c++) {
                    const item = row[c];
                    if (!item || !item.name) continue;
                    const sKey = getSeriesKey(item) || item.name;
                    if (sKey === seriesKey) {
                        row[c] = {};
                    }
                }
            });
        });
        saveAll();
        renderCalendar();
        renderRanks(currentRankMode);
    }
}
function toggleRankReason(safeKey) {
    const key = decodeURIComponent(safeKey);
    rankReasonOpen[key] = !rankReasonOpen[key];
    renderRanks(currentRankMode);
}

function openRankReason(safeKey, safeName) {
    const key = decodeURIComponent(safeKey);
    const name = decodeURIComponent(safeName);
    currentRankKey = key;
    document.getElementById("rankReasonTitle").innerText = `推荐理由 - ${name}`;
    document.getElementById("rankReasonText").value = "";
    document.getElementById("modalRankReason").style.display = "flex";
}
function saveRankReason() {
    if (!currentRankKey) return;
    const text = document.getElementById("rankReasonText").value.trim();
    if (text) {
        if (!Array.isArray(rankReasons[currentRankKey])) rankReasons[currentRankKey] = [];
        rankReasons[currentRankKey].push({ id: "r"+Math.random().toString(36).slice(2), text, user: currentUser?.name || "匿名", ts: Date.now(), likes: 0 });
    }
    saveAll();
    renderRanks(currentRankMode);
    closeM("modalRankReason");
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

function toggleChatBox() {
    chatExpanded = !chatExpanded;
    document.getElementById("chatMini").style.display = chatExpanded ? "none" : "block";
    document.getElementById("chatExpand").style.display = chatExpanded ? "block" : "none";
}
function pushChatMessage(msg) {
    chatMessages.push(msg);
    if (chatMessages.length > 30) chatMessages.shift();
    saveAll();
    renderChat();
}
function renderChat() {
    const wrap = document.getElementById("chatMessages");
    const last10 = chatMessages.slice(-10);
    wrap.innerHTML = last10.map((m, i) => `<div class="chat-msg" style="opacity:${0.4 + (i/10)}">[${m.role}] ${m.user}: ${m.text}</div>`).join("");
}
function initChat() {
    if (supabaseClient && CLOUD_CHAT_ENABLED) {
        chatChannel = supabaseClient.channel("chat", { config: { broadcast: { self: false } } });
        chatChannel.on("broadcast", { event: "message" }, ({ payload }) => {
            if (payload) pushChatMessage(payload);
        }).subscribe();
    } else if ("BroadcastChannel" in window) {
        chatChannel = new BroadcastChannel("mimi_chat");
        chatChannel.onmessage = (e) => pushChatMessage(e.data);
    }
}
function sendChat() {
    const inp = document.getElementById("chatInput");
    const text = inp.value.trim();
    if (!text) return;
    const msg = { user: currentUser?.name || "匿名", role: currentUser?.type || "学生", text, ts: Date.now() };
    if (supabaseClient && CLOUD_CHAT_ENABLED && chatChannel?.send) {
        chatChannel.send({ type: "broadcast", event: "message", payload: msg });
        pushChatMessage(msg);
    } else if (chatChannel?.postMessage) {
        chatChannel.postMessage(msg);
    } else {
        pushChatMessage(msg);
    }
    inp.value = "";
}

function exportScheduleImage() {
    const target = document.getElementById("mainPage");
    if (!target) return alert("未找到页面区域");
    html2canvas(target, { backgroundColor: "#ffffff", scale: 2 }).then(canvas => {
        const link = document.createElement("a");
        link.download = `课表整页_第${curWeek}周.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
    }).catch(() => alert("导出失败，请重试"));
}

function scrollToOutline() {
    const el = document.getElementById("dOutline");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function changePage(p) {
    document.getElementById("pageS").style.display = p === "S" ? "block" : "none";
    document.getElementById("pageT").style.display = p === "T" ? "block" : "none";
    document.getElementById("pageR").style.display = p === "R" ? "block" : "none";
    document.getElementById("navS").className = p === "S" ? "active" : "";
    document.getElementById("navT").className = p === "T" ? "active" : "";
    document.getElementById("navR").className = p === "R" ? "active" : "";
    if (p === "T") renderTeachers();
    if (p === "R") renderRanks(currentRankMode || "week");
}
