let userDB = {
    "admin": { uid: "UID001", pass: "admin123", type: "admin", email: "a@m.com" },
    "super": { uid: "UID000", pass: "super123", type: "super", email: "s@m.com" }
};
let teachers = [{ id: "t1", name: "张老师", sub: "高数", ava: "", dy: "math66", bz: "123", xhs: "xhs1" }];
let allWeeks = { "week1": [["08:30-10:00", {name:"高数入门", tId:"t1", video:""}, {}, {}, {}, {}, {}, {}]] };
let curWeek = 1, isAdmin = false, isSuper = false, tempAva = "", config = { start: "2026-04-07" };

// 初始化周选择器
const weekSel = document.getElementById('weekSel');
if (weekSel) {
    for(let i=1; i<=20; i++) weekSel.add(new Option(i, i));
}

// ==================== 音乐与拖拽 ====================
let isPlaying = false, isExplicitlyPaused = false, isDragging = false, startX, startY;
const musicCtrl = document.getElementById('musicCtrl'), bgm = document.getElementById('bgm');

if (musicCtrl) {
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
}
function autoPlayAttempt() { if (!isPlaying && !isExplicitlyPaused) startPlay(); }
function startPlay() {
    if (!bgm || !musicCtrl) return;
    bgm.play().then(()=>{
        isPlaying=true;
        musicCtrl.style.animationPlayState='running';
    }).catch(()=>{});
}

// ==================== v2 功能增强（覆盖旧逻辑） ====================
const SUPABASE_URL = "https://abdjwwhwpuvvfvenvmtx.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_lhJEVj76ZpvRuf2XRoB31A_lLHDuAdf";
const CLOUD_CHAT_ENABLED = true;
const STORAGE_KEY_V2 = "mimi_university_data_v2";
const WANT_FLAGS_KEY = "mimi_want_flags_v1";
const FOLLOW_FLAGS_KEY = "mimi_follow_flags_v1";
const weekNames = ["周日","周一","周二","周三","周四","周五","周六"];

// 当前显示的页面，S: 课程表, T: 教师档案, R: 排行榜
let currentPage = "S";
let feedbackEntries = [];
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
let selectedDateStr = ""; // 用户选择的日期，用于高亮显示
const PLATFORM_OPTIONS = ["微博","抖音","小红书","B站","公众号","视频号","知乎","小宇宙"];
const REASON_LIKE_FLAGS_KEY = "mimi_rank_reason_likes_v1";
const FEEDBACK_CATEGORIES = ["功能建议", "体验问题", "课程咨询", "其他"];
const FEEDBACK_STATUS_OPTIONS = ["全部", "未解决", "已解决"];

let supabaseClient = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase) {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

function getDefaultState() {
    return {
        userDB: {
            "admin": { uid: "UID001", pass: "admin123", type: "admin", email: "a@m.com" },
            "super": { uid: "UID000", pass: "super123", type: "super", email: "s@m.com" },
            
        },
        teachers: [{ id: "t1", name: "张老师", sub: "高数", ava: "", links: [], signature: "", category: "默认", hidden: false }],
        allWeeks: { "week1": [["08:30-10:00", {name:"高数入门", tId:"t1", video:"", tags:[], outline:"", materials:"", seriesName:"", seriesSub:"", seriesColor:"", comments:[], updatedAt: Date.now()}, {}, {}, {}, {}, {}, {}]] },
        reactions: {},
        followCounts: {},
        inviteCodes: [],
        teacherCategories: ["默认"],
        rankReasons: {},
        userSchedules: {},
        feedbackEntries: [],
        lastLoginAt: {},
        config: { start: formatLocalDate(new Date()) },
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
    inviteCodes = (inviteCodes || []).filter(c => typeof c === "string").map(c => normalizeInviteCode(c));
    if (!Array.isArray(teacherCategories) || teacherCategories.length === 0) teacherCategories = ["默认"];
    feedbackEntries = Array.isArray(feedbackEntries) ? feedbackEntries : [];
    feedbackEntries = feedbackEntries.map(e => {
        const base = {
            id: e.id || ("f" + Math.random().toString(36).slice(2)),
            user: e.user || "匿名",
            role: e.role || "student",
            content: String(e.content || "").trim(),
            ts: e.ts || Date.now(),
            category: FEEDBACK_CATEGORIES.includes(e.category) ? e.category : FEEDBACK_CATEGORIES[0],
            status: e.status === "已解决" ? "已解决" : "未解决",
            messages: []
        };
        if (Array.isArray(e.messages)) {
            base.messages = e.messages.map(m => ({
                text: String(m.text || "").trim(),
                user: m.user || base.user,
                role: m.role || base.role,
                ts: m.ts || Date.now()
            })).filter(m => m.text);
        } else if (e.reply && e.reply.text) {
            base.messages = [{
                text: String(e.reply.text).trim(),
                user: e.reply.user || "管理员",
                role: e.reply.role || "admin",
                ts: e.reply.ts || Date.now()
            }];
        }
        return base;
    }).filter(e => e.content);
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

function normalizeInviteCode(code) {
    return String(code || "").replace(/\s+/g, "").toUpperCase();
}

/** 邀请码是否仍可用（未消耗） */
function isInviteCodeAvailable(code) {
    const target = normalizeInviteCode(code);
    if (!target) return false;
    return inviteCodes.some(c => normalizeInviteCode(c) === target);
}

/** 用一个销毁一个：校验通过则从列表移除，返回是否成功消耗 */
function consumeInviteCode(code) {
    const target = normalizeInviteCode(code);
    if (!target) return false;
    const before = inviteCodes.length;
    inviteCodes = inviteCodes.filter(c => normalizeInviteCode(c) !== target);
    return inviteCodes.length < before;
}

function saveAll() {
    const payload = { userDB, teachers, allWeeks, reactions, followCounts, inviteCodes, teacherCategories, rankReasons, userSchedules, feedbackEntries, lastLoginAt, config, chatMessages };
    saveStorageV2(payload);
}

// ==================== 工具函数 ====================
function closeM(id){ document.getElementById(id).style.display='none'; }
function preview(i){
    if(i.files && i.files[0]){
        let r=new FileReader();
        r.onload=(e)=>{
            tempAva=e.target.result;
            document.getElementById('avaPrev').style.backgroundImage=`url(${tempAva})`;
        };
        r.readAsDataURL(i.files[0]);
    }
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
function getRealDate(w, d) {
    const [y, m, day] = config.start.split('-').map(x => parseInt(x));
    let baseDate = new Date(y, m - 1, day);
    // 计算baseDate对应的周日
    let baseSunday = new Date(baseDate);
    baseSunday.setDate(baseDate.getDate() - baseDate.getDay());
    // 从基础周日开始计算
    let target = new Date(baseSunday.getFullYear(), baseSunday.getMonth(), baseSunday.getDate() + ((w-1)*7 + d));
    return { show: (target.getMonth()+1)+"/"+target.getDate(), full: formatLocalDate(target) };
}
function getWeekIndexByDate(dateStr) {
    const [y1, m1, day1] = config.start.split('-').map(x => parseInt(x));
    const [y2, m2, day2] = dateStr.split('-').map(x => parseInt(x));
    let baseDate = new Date(y1, m1 - 1, day1);
    let targetDate = new Date(y2, m2 - 1, day2);
    // 计算baseDate对应的周日
    let baseSunday = new Date(baseDate);
    baseSunday.setDate(baseDate.getDate() - baseDate.getDay());
    // 计算targetDate对应的周日
    let targetSunday = new Date(targetDate);
    targetSunday.setDate(targetDate.getDate() - targetDate.getDay());
    const diffDays = Math.round((targetSunday - baseSunday) / 86400000);
    if (Number.isNaN(diffDays)) return 1;
    return Math.floor(diffDays / 7) + 1;
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

function renderAll() {
    // 设置日期输入框为今天
    const dateInput = document.getElementById("dateViewInp");
    if (dateInput) {
        dateInput.value = getLocalDateStr();
        selectedDateStr = getLocalDateStr();
    }
    renderCalendar();
    renderTeachers();
    renderInviteList();
    renderCategoryList();
    renderTagFilters();
    renderRanks("week");
}

// 刷新当前页面的内容
function refreshCurrentPage() {
    if (currentPage === "S") {
        renderCalendar();
        renderTagFilters();
    } else if (currentPage === "T") {
        renderTeachers();
        renderCategoryList();
        renderInviteList();
    } else if (currentPage === "R") {
        renderRanks(currentRankMode);
    } else if (currentPage === "F") {
        renderFeedbackPage();
    } else if (currentPage === "W") {
        if (typeof wsSyncFromMain === "function") wsSyncFromMain();
        if (typeof wsUpdateToolbar === "function") wsUpdateToolbar();
        if (typeof wsRenderAll === "function") wsRenderAll();
    }
}

function changePage(p) {
    if (p !== "W" && typeof wsLeavePage === "function") wsLeavePage();
    currentPage = p;
    document.getElementById("pageS").style.display = p === "S" ? "block" : "none";
    document.getElementById("pageT").style.display = p === "T" ? "block" : "none";
    document.getElementById("pageR").style.display = p === "R" ? "block" : "none";
    document.getElementById("pageF").style.display = p === "F" ? "block" : "none";
    const pageW = document.getElementById("pageW");
    if (pageW) pageW.style.display = p === "W" ? "block" : "none";
    document.getElementById("navS").className = p === "S" ? "active" : "";
    document.getElementById("navT").className = p === "T" ? "active" : "";
    document.getElementById("navR").className = p === "R" ? "active" : "";
    const navW = document.getElementById("navW");
    if (navW) navW.className = p === "W" ? "active" : "";
    if (p === "T") {
        renderTeachers();
        renderInviteList();
    }
    if (p === "R") renderRanks(currentRankMode || "week");
    if (p === "F") renderFeedbackPage();
    if (p === "W" && typeof wsEnterPage === "function") wsEnterPage();
}

// 按钮点击效果处理
// 为按钮添加绿色高亮效果，300ms后自动移除
function setButtonActive(btnId) {
    document.getElementById(btnId).classList.add('btn-active');
    setTimeout(() => {
        document.getElementById(btnId).classList.remove('btn-active');
    }, 300);
}

// 处理聊天按钮点击：添加效果后调用聊天框切换
function handleChatToggle() {
    setButtonActive('chatToggleBtn');
    toggleChatBox();
}

function handleFeedback() {
    setButtonActive('feedbackBtn');
    changePage('F');
}

function renderFeedbackPage() {
    const hint = document.getElementById('feedbackHint');
    const list = document.getElementById('feedbackList');
    const title = document.getElementById('feedbackListTitle');
    const textarea = document.getElementById('feedbackText');
    const categorySelect = document.getElementById('feedbackCategory');
    const filterCategory = document.getElementById('feedbackFilterCategory');
    const filterStatus = document.getElementById('feedbackFilterStatus');
    if (!hint || !list || !title || !textarea || !categorySelect || !filterCategory || !filterStatus || !currentUser) return;

    const isAdminViewer = isAdmin || isSuper;
    hint.innerText = isAdminViewer ? '管理员和大管理可查看所有意见' : '你仅可查看自己提交的意见';

    // 初始化分类选项
    const currentFilterCategory = filterCategory.value || '全部';
    const currentFilterStatus = filterStatus.value || '全部';
    categorySelect.innerHTML = FEEDBACK_CATEGORIES.map(cat => `<option value="${cat}">${cat}</option>`).join('');
    filterCategory.innerHTML = ['全部', ...FEEDBACK_CATEGORIES].map(cat => `<option value="${cat}">${cat}</option>`).join('');
    filterStatus.innerHTML = FEEDBACK_STATUS_OPTIONS.map(status => `<option value="${status}">${status}</option>`).join('');
    filterCategory.value = ['全部', ...FEEDBACK_CATEGORIES].includes(currentFilterCategory) ? currentFilterCategory : '全部';
    filterStatus.value = FEEDBACK_STATUS_OPTIONS.includes(currentFilterStatus) ? currentFilterStatus : '全部';

    const selectedCategory = filterCategory.value || '全部';
    const selectedStatus = filterStatus.value || '全部';

    const visibleEntries = feedbackEntries
        .slice()
        .reverse()
        .filter(e => (isAdminViewer || e.user === currentUser.name)
            && (selectedCategory === '全部' || e.category === selectedCategory)
            && (selectedStatus === '全部' || e.status === selectedStatus)
        );

    const filterLabel = selectedCategory === '全部' ? '' : ` / 分类：${selectedCategory}`;
    const statusLabel = selectedStatus === '全部' ? '' : ` / 状态：${selectedStatus}`;
    title.innerText = isAdminViewer
        ? `全部反馈 (${visibleEntries.length})${filterLabel}${statusLabel}`
        : `我的反馈 (${visibleEntries.length})${filterLabel}${statusLabel}`;
    list.innerHTML = visibleEntries.length
        ? visibleEntries.map(entry => {
            const time = new Date(entry.ts).toLocaleString();
            const owner = isAdminViewer ? `<div style="font-size:12px;color:#999; margin-top:8px;">${entry.user} / ${entry.role}</div>` : '';
            const conversation = (entry.messages || []).map(msg => {
                const author = msg.role === 'admin' || msg.role === 'super' ? '管理员' : (msg.user === currentUser.name ? '我' : msg.user);
                const bg = msg.role === 'admin' || msg.role === 'super' ? '#fffbea' : '#e7f5ff';
                return `<div style="margin-top:12px; padding:12px; background:${bg}; border-radius:14px; border:1px solid #f3e9c8;"><div style="font-size:13px; color:#555; font-weight:600;">${author}：</div><div style="white-space:pre-wrap; margin-top:8px; color:#333;">${msg.text}</div><div style="font-size:12px; color:#999; margin-top:8px;">${new Date(msg.ts).toLocaleString()}</div></div>`;
            }).join('');
            const canOwn = entry.user === currentUser.name;
            const adminActions = `<div class="feedback-card-actions"><button class="btn-ui-secondary" onclick="replyFeedback('${entry.id}')">回复</button><button class="btn-ui-secondary" style="background:#fff1f0; color:#c92a2a;" onclick="deleteFeedback('${entry.id}')">删除</button><button class="btn-ui-primary" style="background:${entry.status==='已解决' ? '#ff6b6b' : 'var(--primary)'}" onclick="toggleFeedbackStatus('${entry.id}')">${entry.status==='已解决' ? '标记未解决' : '标记已解决'}</button></div>`;
            const ownActions = canOwn ? `<div class="feedback-card-actions"><button class="btn-ui-secondary" onclick="editFeedback('${entry.id}')">编辑</button><button class="btn-ui-secondary" onclick="replyFeedback('${entry.id}')">回复管理员</button><button class="btn-ui-secondary" style="background:#fff1f0; color:#c92a2a;" onclick="deleteFeedback('${entry.id}')">删除</button></div>` : '';
            const actionBlock = isAdminViewer ? adminActions : ownActions;
            return `
                <div style="background:#ffffff; padding:18px; border-radius:20px; border:1px solid #f0f1ea; box-shadow:0 4px 20px rgba(0,0,0,0.03);">
                    <div style="display:flex; flex-wrap:wrap; gap:10px; align-items:center; justify-content:space-between;">
                        <div style="display:flex; gap:8px; align-items:center;">
                            <span class="feedback-badge category">${entry.category}</span>
                            <span class="feedback-badge status ${entry.status==='未解决' ? 'status-unresolved' : ''}">${entry.status}</span>
                        </div>
                        <div style="font-size:12px; color:#999;">${time}</div>
                    </div>
                    <div style="white-space:pre-wrap; line-height:1.8; color:#333; margin-top:14px;">${entry.content}</div>
                    ${owner}
                    ${conversation}
                    ${actionBlock}
                </div>
            `;
        }).join('')
        : '<div style="color:#888;">暂无反馈</div>';
}

function submitFeedback() {
    if (!currentUser) return alert('请先登录后提交意见');
    const textarea = document.getElementById('feedbackText');
    const categorySelect = document.getElementById('feedbackCategory');
    if (!textarea || !categorySelect) return;
    const content = textarea.value.trim();
    const category = FEEDBACK_CATEGORIES.includes(categorySelect.value) ? categorySelect.value : FEEDBACK_CATEGORIES[0];
    if (!content) return alert('请输入你的意见内容');

    feedbackEntries.push({
        id: 'f' + Date.now() + Math.random().toString(36).slice(2),
        user: currentUser.name,
        role: currentUser.type,
        content,
        ts: Date.now(),
        category,
        status: '未解决',
        messages: []
    });
    textarea.value = '';
    saveAll();
    renderFeedbackPage();
    alert('你的意见已提交，感谢反馈！');
}

function clearFeedbackFilters() {
    const filterCategory = document.getElementById('feedbackFilterCategory');
    const filterStatus = document.getElementById('feedbackFilterStatus');
    if (filterCategory) filterCategory.value = '全部';
    if (filterStatus) filterStatus.value = '全部';
    renderFeedbackPage();
}

function replyFeedback(id) {
    if (!currentUser) return alert('请先登录');
    const entry = feedbackEntries.find(item => item.id === id);
    if (!entry) return alert('未找到该反馈');
    if (!(isAdmin || isSuper) && entry.user !== currentUser.name) return alert('你没有权限回复该意见');
    const promptText = (isAdmin || isSuper) ? '请输入管理员回复内容：' : '请输入你想发送给管理员的说明：';
    const replyText = prompt(promptText, '');
    if (replyText === null) return;
    const text = String(replyText).trim();
    if (!text) return alert('回复内容不能为空');
    entry.messages = Array.isArray(entry.messages) ? entry.messages : [];
    entry.messages.push({
        text,
        user: currentUser.name,
        role: currentUser.type,
        ts: Date.now()
    });
    saveAll();
    renderFeedbackPage();
}

function deleteFeedback(id) {
    if (!currentUser) return alert('请先登录');
    const entryIndex = feedbackEntries.findIndex(item => item.id === id);
    if (entryIndex === -1) return alert('未找到该反馈');
    const entry = feedbackEntries[entryIndex];
    if (!(isAdmin || isSuper || entry.user === currentUser.name)) return alert('你没有权限删除该反馈');
    if (!confirm('确认删除这条意见吗？删除后无法恢复。')) return;
    feedbackEntries.splice(entryIndex, 1);
    saveAll();
    renderFeedbackPage();
}

function editFeedback(id) {
    if (!currentUser) return alert('请先登录');
    const entry = feedbackEntries.find(item => item.id === id);
    if (!entry) return alert('未找到该反馈');
    if (!(isAdmin || isSuper || entry.user === currentUser.name)) return alert('你没有权限编辑该反馈');
    const newContent = prompt('编辑你的意见内容：', entry.content);
    if (newContent === null) return;
    const trimmed = String(newContent).trim();
    if (!trimmed) return alert('意见内容不能为空');
    entry.content = trimmed;
    entry.ts = Date.now();
    saveAll();
    renderFeedbackPage();
}

function toggleFeedbackStatus(id) {
    if (!currentUser || !(isAdmin || isSuper)) return alert('仅管理员和大管理可操作状态');
    const entry = feedbackEntries.find(item => item.id === id);
    if (!entry) return alert('未找到该反馈');
    entry.status = entry.status === '已解决' ? '未解决' : '已解决';
    saveAll();
    renderFeedbackPage();
}

// 处理我的主页按钮点击：添加效果后打开教师主页
function handleTeacherSelf() {
    setButtonActive('teacherSelfBtn');
    openMyTeacherProfile();
}

// 处理改密码按钮点击：添加效果后打开密码修改弹窗
function handlePassModal() {
    setButtonActive('passBtn');
    openPassModal();
}

// 处理管理员管理按钮点击：添加效果后打开管理员管理弹窗
function handleAdminManage() {
    setButtonActive('adminManageBtn');
    openAdminManageModal();
}

// 处理刷新按钮点击：添加效果后刷新当前页面内容
function handleRefresh() {
    setButtonActive('refreshBtn');
    refreshCurrentPage();
}

// 处理退出按钮点击：添加效果后重新加载页面回到登录界面
function handleLogout() {
    setButtonActive('logoutBtn');
    // 仅清除当前登录的账号信息
    localStorage.removeItem("rememberedUser");
    localStorage.removeItem("rememberedPass");
    localStorage.removeItem("rememberedRole");
    sessionStorage.removeItem("mimi_current_user");
    setTimeout(() => {
        location.reload();
    }, 300);
}
