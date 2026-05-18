const WS_STORAGE_KEY = "mimi_workshop_v1";
const WS_WANT_FLAGS = "mimi_workshop_want_flags_v1";
const MAIN_STORAGE_KEY = "mimi_university_data_v2";

let wsData = null;
let wsUser = null;
let wsIsAdmin = false;
let wsCarouselTimer = null;
let wsCarouselIndex = 0;
let wsListDraft = { step: 1, image: "", contactImage: "", qaConfirmed: false };
let wsCurrentProductId = null;
let wsFilterGroupId = "all";
let wsFilterMajor = "";
let wsFilterMinor = "";
let wsCatExpanded = {};

function closeM(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
}

function wsEscape(s) {
    return String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function wsDefaultData() {
    return {
        disclaimer: "【占位】米米宇宙免责说明\n\n1. 本平台仅提供制品展示与开团信息汇总，不参与交易、收款与物流。\n2. 团长与购买者之间的沟通、付款、售后由双方自行负责。\n3. 制品图片与描述由团长上传，平台不对内容真实性作担保。\n4. 更多条款待补充……\n\n请仔细阅读以上内容。",
        applyDocUrl: "#placeholder-word-doc",
        applyEmail: "leader-apply@placeholder.com",
        categories: [
            { id: "cat_doll", name: "娃娃", subs: ["10cm娃", "15cm娃", "20cm娃"] },
            { id: "cat_acc", name: "饰品", subs: ["发饰", "挂件", "其他"] }
        ],
        groups: [],
        leaders: [],
        products: [],
        applications: [],
        carouselFeatured: []
    };
}

function wsLoad() {
    try {
        const raw = localStorage.getItem(WS_STORAGE_KEY);
        wsData = raw ? JSON.parse(raw) : wsDefaultData();
    } catch {
        wsData = wsDefaultData();
    }
    if (!wsData.categories?.length) wsData.categories = wsDefaultData().categories;
    if (!wsData.disclaimer) wsData.disclaimer = wsDefaultData().disclaimer;
}

function wsSave() {
    localStorage.setItem(WS_STORAGE_KEY, JSON.stringify(wsData));
}

function wsDefaultUserDB() {
    return {
        admin: { uid: "UID001", pass: "admin123", type: "admin", email: "a@m.com" },
        super: { uid: "UID000", pass: "super123", type: "super", email: "s@m.com" }
    };
}

function wsLoadUserDB() {
    try {
        const raw = localStorage.getItem(MAIN_STORAGE_KEY);
        if (!raw) return wsDefaultUserDB();
        const db = JSON.parse(raw).userDB;
        return db && Object.keys(db).length ? db : wsDefaultUserDB();
    } catch {
        return wsDefaultUserDB();
    }
}

function wsGetSession() {
    try {
        const raw = sessionStorage.getItem("mimi_current_user");
        if (!raw) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function wsSetSession(user) {
    sessionStorage.setItem("mimi_current_user", JSON.stringify(user));
}

function wsIsLeader() {
    if (!wsUser) return false;
    const l = wsData.leaders.find((x) => x.user === wsUser.name && x.active !== false);
    if (!l) return false;
    if (l.expiresAt && Date.now() > l.expiresAt) return false;
    return true;
}

function wsLeaderRecord() {
    return wsData.leaders.find((x) => x.user === wsUser?.name && x.active !== false);
}

function wsLeaderGroups() {
    const rec = wsLeaderRecord();
    if (!rec) return [];
    return (rec.groupIds || [])
        .map((id) => wsData.groups.find((g) => g.id === id))
        .filter(Boolean);
}

function wsFormatDate(ts) {
    if (!ts) return "未设置";
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function wsVisibleProducts() {
    const now = Date.now();
    return wsData.products.filter((p) => {
        if (p.status === "offline") return false;
        const g = wsData.groups.find((x) => x.id === p.groupId);
        if (!g || !g.active) return false;
        if (g.startAt && now < g.startAt) return false;
        if (g.endAt && now > g.endAt) return false;
        if (p.listedUntil && now > p.listedUntil) return false;
        return true;
    });
}

function wsProductWantCount(p) {
    return p.wantCount || 0;
}

function wsTopWantProducts(n = 3) {
    return [...wsVisibleProducts()]
        .sort((a, b) => wsProductWantCount(b) - wsProductWantCount(a))
        .slice(0, n);
}

function wsCarouselItems() {
    const visible = wsVisibleProducts();
    const hot = wsTopWantProducts(5).map((p) => ({ type: "hot", product: p }));
    const featured = (wsData.carouselFeatured || [])
        .map((id) => visible.find((p) => p.id === id))
        .filter(Boolean)
        .map((p) => ({ type: "featured", product: p }));
    const map = new Map();
    [...featured, ...hot].forEach((item) => {
        if (item.product && !map.has(item.product.id)) map.set(item.product.id, item);
    });
    return Array.from(map.values());
}

function wsReadFileAsDataURL(input, cb) {
    if (!input.files?.[0]) return;
    const r = new FileReader();
    r.onload = (e) => cb(e.target.result);
    r.readAsDataURL(input.files[0]);
}

/* ========== 登录 ========== */
function wsHandleLogin() {
    const u = document.getElementById("wsLUser").value.trim();
    const p = document.getElementById("wsLPass").value;
    const r = document.getElementById("wsLRole").value;
    const userDB = wsLoadUserDB();
    if (!userDB[u] || userDB[u].type !== r || userDB[u].pass !== p) {
        alert("账号或密码错误（请使用米米宇宙同一账号）");
        return;
    }
    wsUser = { name: u, type: r, uid: userDB[u].uid };
    wsIsAdmin = r === "admin" || r === "super";
    wsSetSession(wsUser);
    document.getElementById("wsAuthPage").style.display = "none";
    document.getElementById("wsMainPage").classList.add("active");
    wsAfterLogin();
}

function wsAfterLogin() {
    const disp = document.getElementById("wsUserDisp");
    if (disp) disp.textContent = `${wsUser.name} (${wsUser.uid})`;
    wsUpdateToolbar();
    wsShowDisclaimer();
}

function wsTryAutoLogin() {
    wsUser = wsGetSession();
    if (!wsUser) return;
    const userDB = wsLoadUserDB();
    if (!userDB[wsUser.name]) {
        sessionStorage.removeItem("mimi_current_user");
        wsUser = null;
        return;
    }
    wsIsAdmin = wsUser.type === "admin" || wsUser.type === "super";
    const authPage = document.getElementById("wsAuthPage");
    const mainPage = document.getElementById("wsMainPage");
    if (!authPage && !mainPage) return;
    if (authPage) authPage.style.display = "none";
    if (mainPage) mainPage.classList.add("active");
    wsAfterLogin();
}

/** 内嵌主站：与课程表等平行 */
function wsSyncFromMain() {
    if (typeof currentUser !== "undefined" && currentUser) {
        wsUser = { name: currentUser.name, type: currentUser.type, uid: currentUser.uid };
        wsIsAdmin =
            (typeof isAdmin !== "undefined" && isAdmin) ||
            (typeof isSuper !== "undefined" && isSuper) ||
            currentUser.type === "admin" ||
            currentUser.type === "super";
    }
}

function wsUpdateToolbar() {
    const listBtn = document.getElementById("wsListBtn");
    const adminBtn = document.getElementById("wsAdminBtn");
    if (listBtn) listBtn.style.display = wsIsLeader() ? "inline-block" : "none";
    if (adminBtn) adminBtn.style.display = wsIsAdmin ? "inline-block" : "none";
}

function wsEnterPage() {
    if (typeof currentUser === "undefined" || !currentUser) {
        alert("请先登录米米宇宙");
        if (typeof changePage === "function") changePage("S");
        return;
    }
    wsSyncFromMain();
    wsUpdateToolbar();
    wsShowDisclaimer();
}

function wsLeavePage() {
    clearInterval(wsCarouselTimer);
    wsCarouselTimer = null;
}

/* ========== 免责弹窗 ========== */
function wsShowDisclaimer() {
    const body = document.getElementById("wsDisclaimerBody");
    const btn = document.getElementById("wsDisclaimerOk");
    body.textContent = wsData.disclaimer;
    body.onscroll = wsCheckDisclaimerScroll;
    btn.disabled = true;
    btn.classList.remove("btn-ui-primary");
    btn.classList.add("btn-ui-secondary");
    document.getElementById("wsDisclaimerHint").textContent = "请滚动至底部阅读全文";
    document.getElementById("wsDisclaimerHint").classList.remove("ready");
    document.getElementById("modalWsDisclaimer").style.display = "flex";
    setTimeout(wsCheckDisclaimerScroll, 100);
}

function wsCheckDisclaimerScroll() {
    const body = document.getElementById("wsDisclaimerBody");
    const hint = document.getElementById("wsDisclaimerHint");
    const btn = document.getElementById("wsDisclaimerOk");
    const atBottom = body.scrollTop + body.clientHeight >= body.scrollHeight - 8;
    if (atBottom) {
        hint.textContent = "已阅读完毕，可点击确定进入";
        hint.classList.add("ready");
        btn.disabled = false;
        btn.classList.remove("btn-ui-secondary");
        btn.classList.add("btn-ui-primary");
    }
}

function wsCloseDisclaimer() {
    closeM("modalWsDisclaimer");
    wsRenderAll();
}

/* ========== 渲染 ========== */
function wsRenderAll() {
    wsRenderCarousel();
    wsRenderWantBar();
    wsRenderCategoryTree();
    wsRenderGroupTabs();
    wsRenderProductGrid();
}

function wsRenderCarousel() {
    const items = wsCarouselItems();
    const card = document.getElementById("wsNoticeCard");
    const img = document.getElementById("wsNoticeImg");
    const tagEl = document.getElementById("wsNoticeTag");
    const nameEl = document.getElementById("wsNoticeName");
    const dots = document.getElementById("wsCarouselDots");
    if (!card || !img || !tagEl || !nameEl) return;
    if (!items.length) {
        img.src = "";
        img.style.display = "none";
        tagEl.textContent = "通知";
        nameEl.textContent = "暂无推荐";
        card.onclick = null;
        if (dots) dots.innerHTML = "";
        return;
    }
    if (wsCarouselIndex >= items.length) wsCarouselIndex = 0;
    const item = items[wsCarouselIndex];
    const p = item.product;
    img.style.display = "block";
    img.src = p.image || "";
    tagEl.textContent = item.type === "featured" ? "主推" : "热门";
    nameEl.textContent = p.name || "";
    card.onclick = () => wsOpenProduct(p.id);
    if (dots) {
        dots.innerHTML = items.map((_, i) => `<span class="ws-carousel-dot ${i === wsCarouselIndex ? "active" : ""}"></span>`).join("");
    }
    clearInterval(wsCarouselTimer);
    wsCarouselTimer = setInterval(() => {
        wsCarouselIndex = (wsCarouselIndex + 1) % items.length;
        wsRenderCarousel();
    }, 5000);
}

function wsRenderWantBar() {
    const bar = document.getElementById("wsWantBar");
    const top = wsTopWantProducts(3);
    if (!top.length) {
        bar.style.display = "none";
        return;
    }
    bar.style.display = "block";
    bar.innerHTML = `<b>🔥 想要榜 TOP3：</b>` + top.map((p) =>
        `<span class="ws-want-chip" onclick="wsOpenProduct('${p.id}')">${wsEscape(p.name)} (${wsProductWantCount(p)})</span>`
    ).join("");
}

function wsRenderGroupTabs() {
    const wrap = document.getElementById("wsGroupTabs");
    const groups = wsData.groups.filter((g) => g.active !== false);
    let html = `<span class="ws-group-tab ${wsFilterGroupId === "all" ? "active" : ""}" onclick="wsSetGroupFilter('all')">全部</span>`;
    groups.forEach((g) => {
        html += `<span class="ws-group-tab ${wsFilterGroupId === g.id ? "active" : ""}" onclick="wsSetGroupFilter('${g.id}')">${wsEscape(g.name)}</span>`;
    });
    wrap.innerHTML = html;
}

function wsSetGroupFilter(id) {
    wsFilterGroupId = id;
    wsRenderGroupTabs();
    wsRenderProductGrid();
}

function wsRenderProductGrid() {
    const grid = document.getElementById("wsProductGrid");
    let list = wsVisibleProducts();
    if (wsFilterGroupId !== "all") list = list.filter((p) => p.groupId === wsFilterGroupId);
    if (wsFilterMajor) list = list.filter((p) => p.majorCat === wsFilterMajor);
    if (wsFilterMinor) list = list.filter((p) => p.minorCat === wsFilterMinor);
    if (!list.length) {
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:#999;padding:40px;">暂无制品展示</div>`;
        return;
    }
    grid.innerHTML = list.map((p) => {
        const cls = p.status === "gray" ? "grayed" : "";
        return `<div class="ws-product-card ${cls}" onclick="wsOpenProduct('${p.id}')">
            <span class="ws-want-badge">想要 ${wsProductWantCount(p)}</span>
            <img class="ws-product-img" src="${p.image || ""}" alt="">
            <div class="ws-product-body">
                <div class="ws-product-name">${wsEscape(p.name)}</div>
                <div class="ws-product-meta">${wsEscape(p.majorCat)} · ${wsEscape(p.minorCat)}</div>
            </div>
        </div>`;
    }).join("");
}

function wsSelectCat(major, minor) {
    wsFilterMajor = major || "";
    wsFilterMinor = minor || "";
    wsRenderCategoryTree();
    wsRenderProductGrid();
}

function wsToggleCatMajor(catId) {
    const cat = wsData.categories.find((c) => c.id === catId);
    if (!cat) return;
    const subs = cat.subs || [];
    if (!subs.length) {
        wsSelectCat(cat.name, "");
        return;
    }
    wsCatExpanded[catId] = !wsCatExpanded[catId];
    wsRenderCategoryTree();
}

function wsRenderCategoryTree() {
    const wrap = document.getElementById("wsCatTree");
    if (!wrap) return;
    let html = `<div class="ws-cat-item ${!wsFilterMajor && !wsFilterMinor ? "active" : ""}" onclick="wsSelectCat('','')">全部分类</div>`;
    (wsData.categories || []).forEach((cat) => {
        const subs = cat.subs || [];
        const expanded = !!wsCatExpanded[cat.id];
        const majorActive = wsFilterMajor === cat.name && !wsFilterMinor;
        html += `<div class="ws-cat-major ${majorActive ? "active" : ""}" onclick="wsToggleCatMajor('${cat.id}')">
            <span>${wsEscape(cat.name)}</span>
            ${subs.length ? `<span class="ws-cat-arrow ${expanded ? "open" : ""}">▼</span>` : ""}
        </div>`;
        if (subs.length && expanded) {
            html += `<div class="ws-cat-subs">`;
            html += `<div class="ws-cat-sub ${wsFilterMajor === cat.name && !wsFilterMinor ? "active" : ""}" onclick="event.stopPropagation();wsSelectCat('${wsEscape(cat.name)}','')">全部${wsEscape(cat.name)}</div>`;
            subs.forEach((sub) => {
                const subActive = wsFilterMajor === cat.name && wsFilterMinor === sub;
                html += `<div class="ws-cat-sub ${subActive ? "active" : ""}" onclick="event.stopPropagation();wsSelectCat('${wsEscape(cat.name)}','${wsEscape(sub)}')">${wsEscape(sub)}</div>`;
            });
            html += `</div>`;
        }
    });
    wrap.innerHTML = html;
}

/* ========== 制品详情 ========== */
function wsOpenProduct(id) {
    const p = wsData.products.find((x) => x.id === id);
    if (!p) return;
    wsCurrentProductId = id;
    const g = wsData.groups.find((x) => x.id === p.groupId);
    document.getElementById("wsDetailTitle").textContent = p.name;
    document.getElementById("wsDetailImg").src = p.image || "";
    document.getElementById("wsDetailDesc").textContent = p.desc || "暂无介绍";
    document.getElementById("wsDetailGroup").textContent = g ? `所属团：${g.name}` : "";
    const wantFlags = JSON.parse(localStorage.getItem(WS_WANT_FLAGS) || "{}");
    const wanted = wsUser && wantFlags[`${wsUser.name}_${p.id}`];
    document.getElementById("wsDetailWantBtn").textContent = `${wanted ? "💖" : "🤍"} 想要 (${wsProductWantCount(p)})`;

    const qaBlock = document.getElementById("wsDetailQaBlock");
    const contactBlock = document.getElementById("wsDetailContact");
    contactBlock.style.display = "none";
    contactBlock.innerHTML = "";
    if (p.hasQuestion) {
        qaBlock.style.display = "block";
        document.getElementById("wsDetailQuestion").textContent = p.question || "";
        document.getElementById("wsDetailAnswerInp").value = "";
        document.getElementById("wsDetailAnswerErr").textContent = "";
    } else {
        qaBlock.style.display = "none";
        wsShowContact(p);
    }

    const related = wsData.products.filter((x) => x.groupId === p.groupId && x.id !== p.id && x.status !== "offline");
    document.getElementById("wsDetailRelated").innerHTML = related.length
        ? `<b>同团制品</b><div class="ws-related-row">${related.map((r) =>
            `<div class="ws-related-item" onclick="wsOpenProduct('${r.id}')"><img src="${r.image || ""}"><div>${wsEscape(r.name)}</div></div>`
        ).join("")}</div>`
        : "";

    document.getElementById("modalWsProduct").style.display = "flex";
}

function wsShowContact(p) {
    const block = document.getElementById("wsDetailContact");
    block.style.display = "block";
    if (p.contactImage) {
        block.innerHTML = `<b>联系方式</b><br><img src="${p.contactImage}" style="max-width:100%;margin-top:8px;border-radius:8px;">`;
    } else {
        block.innerHTML = `<p style="color:#999;font-size:12px;">团长未上传联系二维码</p>`;
    }
}

function wsCheckDetailAnswer() {
    const p = wsData.products.find((x) => x.id === wsCurrentProductId);
    if (!p || !p.hasQuestion) return;
    const ans = document.getElementById("wsDetailAnswerInp").value.trim();
    const err = document.getElementById("wsDetailAnswerErr");
    if (ans !== (p.answer || "").trim()) {
        err.textContent = "答案不正确，请重试";
        return;
    }
    err.textContent = "";
    wsShowContact(p);
}

function wsToggleWant() {
    const p = wsData.products.find((x) => x.id === wsCurrentProductId);
    if (!p || !wsUser) return alert("请先登录");
    const flags = JSON.parse(localStorage.getItem(WS_WANT_FLAGS) || "{}");
    const key = `${wsUser.name}_${p.id}`;
    if (flags[key]) {
        p.wantCount = Math.max(0, (p.wantCount || 1) - 1);
        delete flags[key];
    } else {
        p.wantCount = (p.wantCount || 0) + 1;
        flags[key] = true;
    }
    localStorage.setItem(WS_WANT_FLAGS, JSON.stringify(flags));
    wsSave();
    document.getElementById("wsDetailWantBtn").textContent = `💖 想要 (${wsProductWantCount(p)})`;
    wsRenderWantBar();
    wsRenderCarousel();
    wsRenderProductGrid();
}

/* ========== 团长申请 ========== */
function wsOpenLeaderApply() {
    document.getElementById("wsApplyDoc").href = wsData.applyDocUrl || "#";
    document.getElementById("wsApplyDoc").textContent = "📄 团长申请说明文档（占位）";
    document.getElementById("wsApplyEmail").textContent = `联系邮箱（占位）：${wsData.applyEmail || "待设置"}`;
    document.getElementById("wsApplyNote").value = "";
    document.getElementById("modalWsLeaderApply").style.display = "flex";
}

function wsSubmitLeaderApply() {
    const note = document.getElementById("wsApplyNote").value.trim();
    if (!note) return alert("请填写申请说明（含拟开团名等）");
    wsData.applications.push({
        id: "app_" + Date.now(),
        user: wsUser.name,
        note,
        ts: Date.now(),
        status: "pending"
    });
    wsSave();
    alert("申请已提交，请等待管理员审核");
    closeM("modalWsLeaderApply");
}

/* ========== 上架流程 ========== */
function wsOpenListModal() {
    if (!wsIsLeader()) return alert("您还不是团长");
    const groups = wsLeaderGroups().filter((g) => g.active !== false);
    if (!groups.length) return alert("您暂无可用团，请联系管理员创建");
    wsListDraft = { step: 1, image: "", contactImage: "", qaConfirmed: false };
    document.getElementById("wsListStep1").classList.add("active");
    document.getElementById("wsListStep2").classList.remove("active");
    document.querySelectorAll(".ws-field-error").forEach((el) => el.classList.remove("ws-field-error"));
    document.querySelectorAll(".ws-error-msg").forEach((el) => (el.textContent = ""));

    const gSel = document.getElementById("wsListGroup");
    gSel.innerHTML = groups.map((g) => `<option value="${g.id}">${wsEscape(g.name)}</option>`).join("");
    wsOnListGroupChange();

    const majorSel = document.getElementById("wsListMajor");
    majorSel.innerHTML = wsData.categories.map((c) => `<option value="${wsEscape(c.name)}">${wsEscape(c.name)}</option>`).join("");
    wsOnListMajorChange();

    document.getElementById("wsListName").value = "";
    document.getElementById("wsListDesc").value = "";
    document.getElementById("wsListHasQa").checked = false;
    document.getElementById("wsListQuestion").value = "";
    document.getElementById("wsListAnswer").value = "";
    document.getElementById("wsListQaBlock").style.display = "none";
    document.getElementById("wsListQaConfirmRow").style.display = "none";
    document.getElementById("modalWsList").style.display = "flex";
}

function wsOnListGroupChange() {
    const gid = document.getElementById("wsListGroup").value;
    const g = wsData.groups.find((x) => x.id === gid);
    const hint = document.getElementById("wsListExpireHint");
    if (!g) {
        hint.textContent = "";
        return;
    }
    const count = wsData.products.filter((p) => p.groupId === gid && p.status !== "offline").length;
    hint.innerHTML = `已识别团名：<b>${wsEscape(g.name)}</b><br>上架截止：${wsFormatDate(g.endAt)}<br>本团已上架 ${count} / ${g.maxProducts || "∞"} 个制品`;
}

function wsOnListMajorChange() {
    const major = document.getElementById("wsListMajor").value;
    const cat = wsData.categories.find((c) => c.name === major);
    const minorSel = document.getElementById("wsListMinor");
    minorSel.innerHTML = (cat?.subs || []).map((s) => `<option value="${wsEscape(s)}">${wsEscape(s)}</option>`).join("");
}

function wsToggleListQa() {
    const on = document.getElementById("wsListHasQa").checked;
    document.getElementById("wsListQaBlock").style.display = on ? "block" : "none";
    document.getElementById("wsListQaConfirmRow").style.display = on ? "block" : "none";
    wsListDraft.qaConfirmed = false;
}

function wsConfirmQa() {
    const q = document.getElementById("wsListQuestion").value.trim();
    const a = document.getElementById("wsListAnswer").value.trim();
    if (!q || !a) return alert("请先填写问题与答案");
    wsListDraft.qaConfirmed = true;
    alert("问题与答案已确认");
}

function wsListNextStep() {
    const errs = [];
    const setErr = (id, msg) => {
        const el = document.getElementById(id);
        if (el) el.classList.add("ws-field-error");
        errs.push(msg);
    };
    document.querySelectorAll("#wsListStep1 .ws-field-error").forEach((e) => e.classList.remove("ws-field-error"));

    const gid = document.getElementById("wsListGroup").value;
    const name = document.getElementById("wsListName").value.trim();
    const g = wsData.groups.find((x) => x.id === gid);
    if (!name) setErr("wsListName", "制品名");
    if (!wsListDraft.image) setErr("wsListImageWrap", "制品图片");
    if (!gid) errs.push("团名");

    const count = wsData.products.filter((p) => p.groupId === gid && p.status !== "offline").length;
    if (g?.maxProducts && count >= g.maxProducts) {
        alert(`该团最多上架 ${g.maxProducts} 个制品，已达上限`);
        return;
    }

    if (errs.length) {
        alert("请完成标红项：" + [...new Set(errs)].join("、"));
        return;
    }

    document.getElementById("wsListStep1").classList.remove("active");
    document.getElementById("wsListStep2").classList.add("active");
}

function wsListPrevStep() {
    document.getElementById("wsListStep2").classList.remove("active");
    document.getElementById("wsListStep1").classList.add("active");
}

function wsSubmitList() {
    const errs = [];
    const hasQa = document.getElementById("wsListHasQa").checked;
    if (!wsListDraft.contactImage) errs.push("联系方式图片");
    if (hasQa) {
        if (!document.getElementById("wsListQuestion").value.trim()) errs.push("问题");
        if (!document.getElementById("wsListAnswer").value.trim()) errs.push("答案");
        if (!wsListDraft.qaConfirmed) errs.push("确认问题与答案（需点击确定）");
    }
    if (errs.length) {
        alert("未完成项（请检查标红）：\n" + errs.join("\n"));
        return;
    }

    const gid = document.getElementById("wsListGroup").value;
    const g = wsData.groups.find((x) => x.id === gid);
    const p = {
        id: "p_" + Date.now(),
        groupId: gid,
        name: document.getElementById("wsListName").value.trim(),
        desc: document.getElementById("wsListDesc").value.trim(),
        majorCat: document.getElementById("wsListMajor").value,
        minorCat: document.getElementById("wsListMinor").value,
        image: wsListDraft.image,
        contactImage: wsListDraft.contactImage,
        hasQuestion: hasQa,
        question: hasQa ? document.getElementById("wsListQuestion").value.trim() : "",
        answer: hasQa ? document.getElementById("wsListAnswer").value.trim() : "",
        wantCount: 0,
        status: "active",
        listedUntil: g?.endAt || null,
        leaderUser: wsUser.name,
        createdAt: Date.now()
    };
    wsData.products.push(p);
    wsSave();
    alert("上架成功！");
    closeM("modalWsList");
    wsRenderAll();
}

/* ========== 管理后台 ========== */
function wsOpenAdmin() {
    if (!wsIsAdmin) return;
    wsRenderAdmin();
    document.getElementById("modalWsAdmin").style.display = "flex";
}

function wsRenderAdmin() {
    const apps = document.getElementById("wsAdminApps");
    apps.innerHTML = (wsData.applications || []).filter((a) => a.status === "pending").map((a) =>
        `<div class="ws-list-row"><span>${wsEscape(a.user)}：${wsEscape(a.note)}</span>
        <button class="btn-ui-secondary" onclick="wsApproveLeader('${a.id}')">批准为团长</button></div>`
    ).join("") || "<div style='color:#999;'>暂无待审核申请</div>";

    const leaders = document.getElementById("wsAdminLeaders");
    leaders.innerHTML = wsData.leaders.map((l) =>
        `<div class="ws-list-row"><span>${wsEscape(l.user)} · 到期 ${wsFormatDate(l.expiresAt)} · 团 ${(l.groupIds||[]).length}/2</span>
        <button class="btn-ui-tag-del" onclick="wsRevokeLeader('${l.user}')">取消资格</button></div>`
    ).join("") || "<div style='color:#999;'>暂无团长</div>";

    const groups = document.getElementById("wsAdminGroups");
    groups.innerHTML = wsData.groups.map((g) =>
        `<div class="ws-list-row"><span><b>${wsEscape(g.name)}</b> · ${wsFormatDate(g.startAt)}~${wsFormatDate(g.endAt)} · 上限${g.maxProducts}个 · 团长${wsEscape(g.leaderUser)}</span>
        <span><button class="btn-ui-secondary" onclick="wsToggleGroup('${g.id}')">${g.active ? "停用" : "启用"}</button></span></div>`
    ).join("") || "<div style='color:#999;'>暂无团</div>";

    const products = document.getElementById("wsAdminProducts");
    products.innerHTML = wsData.products.map((p) =>
        `<div class="ws-list-row"><span>${wsEscape(p.name)} (${wsEscape(p.status)})</span>
        <span>
            <button class="btn-ui-secondary" onclick="wsSetProductStatus('${p.id}','active')">上架</button>
            <button class="btn-ui-secondary" onclick="wsSetProductStatus('${p.id}','gray')">变灰</button>
            <button class="btn-ui-tag-del" onclick="wsSetProductStatus('${p.id}','offline')">下架</button>
            <button class="btn-ui-secondary" onclick="wsToggleFeatured('${p.id}')">${(wsData.carouselFeatured||[]).includes(p.id)?"取消主推":"主推"}</button>
        </span></div>`
    ).join("") || "<div style='color:#999;'>暂无制品</div>";

    const cats = document.getElementById("wsAdminCats");
    cats.innerHTML = wsData.categories.map((c, i) =>
        `<div class="ws-list-row"><span>${wsEscape(c.name)}：${(c.subs||[]).join("、")}</span>
        <button class="btn-ui-tag-del" onclick="wsRemoveCategory(${i})">删除</button></div>`
    ).join("");
}

function wsApproveLeader(appId) {
    const app = wsData.applications.find((a) => a.id === appId);
    if (!app) return;
    const days = parseInt(prompt("团长有效期（天）", "30"), 10) || 30;
    let rec = wsData.leaders.find((l) => l.user === app.user);
    if (!rec) {
        rec = { user: app.user, groupIds: [], expiresAt: Date.now() + days * 86400000, active: true };
        wsData.leaders.push(rec);
    } else {
        rec.expiresAt = Date.now() + days * 86400000;
        rec.active = true;
    }
    app.status = "approved";
    wsSave();
    wsRenderAdmin();
    alert("已批准团长资格");
}

function wsRevokeLeader(user) {
    const rec = wsData.leaders.find((l) => l.user === user);
    if (rec) rec.active = false;
    wsSave();
    wsRenderAdmin();
}

function wsAdminAddGroup() {
    const leader = document.getElementById("wsAdminGroupLeader").value.trim();
    const name = document.getElementById("wsAdminGroupName").value.trim();
    const start = document.getElementById("wsAdminGroupStart").value;
    const end = document.getElementById("wsAdminGroupEnd").value;
    const max = parseInt(document.getElementById("wsAdminGroupMax").value, 10) || 5;
    if (!leader || !name || !start || !end) return alert("请填写完整");
    const lrec = wsData.leaders.find((l) => l.user === leader && l.active !== false);
    if (!lrec) return alert("该用户不是团长，请先批准");
    if ((lrec.groupIds || []).length >= 2) return alert("该团长已有2个团");
    const id = "g_" + Date.now();
    wsData.groups.push({
        id,
        name,
        leaderUser: leader,
        startAt: new Date(start).getTime(),
        endAt: new Date(end + "T23:59:59").getTime(),
        maxProducts: max,
        active: true
    });
    lrec.groupIds = lrec.groupIds || [];
    lrec.groupIds.push(id);
    wsSave();
    wsRenderAdmin();
    alert("团已创建");
}

function wsToggleGroup(gid) {
    const g = wsData.groups.find((x) => x.id === gid);
    if (g) g.active = !g.active;
    wsSave();
    wsRenderAdmin();
}

function wsSetProductStatus(pid, status) {
    const p = wsData.products.find((x) => x.id === pid);
    if (p) p.status = status;
    wsSave();
    wsRenderAdmin();
    wsRenderAll();
}

function wsToggleFeatured(pid) {
    wsData.carouselFeatured = wsData.carouselFeatured || [];
    const i = wsData.carouselFeatured.indexOf(pid);
    if (i >= 0) wsData.carouselFeatured.splice(i, 1);
    else wsData.carouselFeatured.push(pid);
    wsSave();
    wsRenderAdmin();
    wsRenderCarousel();
}

function wsAdminAddCategory() {
    const name = document.getElementById("wsAdminCatName").value.trim();
    const subs = document.getElementById("wsAdminCatSubs").value.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
    if (!name) return;
    wsData.categories.push({ id: "cat_" + Date.now(), name, subs });
    wsSave();
    wsRenderCategoryTree();
    wsRenderAdmin();
}

function wsRemoveCategory(i) {
    wsData.categories.splice(i, 1);
    wsSave();
    wsRenderCategoryTree();
    wsRenderAdmin();
}

function wsInit() {
    wsLoad();
    wsRenderCategoryTree();
    wsTryAutoLogin();
}

document.addEventListener("DOMContentLoaded", wsInit);
