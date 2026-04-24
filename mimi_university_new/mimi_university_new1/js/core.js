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

function saveAll() {
    const payload = { userDB, teachers, allWeeks, reactions, followCounts, inviteCodes, teacherCategories, rankReasons, userSchedules, lastLoginAt, config, chatMessages };
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
    }
}

function changePage(p) {
    currentPage = p; // 更新当前页面标识
    document.getElementById("pageS").style.display = p === "S" ? "block" : "none";
    document.getElementById("pageT").style.display = p === "T" ? "block" : "none";
    document.getElementById("pageR").style.display = p === "R" ? "block" : "none";
    document.getElementById("navS").className = p === "S" ? "active" : "";
    document.getElementById("navT").className = p === "T" ? "active" : "";
    document.getElementById("navR").className = p === "R" ? "active" : "";
    if (p === "T") renderTeachers();
    if (p === "R") renderRanks(currentRankMode || "week");
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
    setTimeout(() => {
        location.reload();
    }, 300);
}
