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
        disclaimer: `<div class="disclaimer-doc">
<h3>法律免责声明</h3>
<p class="disclaimer-basis">本声明依据《中华人民共和国民法典》、《中华人民共和国电子商务法》、《信息网络传播权保护条例》及相关司法解释制定，具有法律约束力。</p>

<div class="disclaimer-section">
<h4>一、服务性质界定</h4>
<ol>
<li>本平台仅为开团信息免费汇总、展示、传播的<strong>中立信息存储空间服务提供者</strong>，不从事商品销售、拼团组织、收款结算、物流配送、售后服务等任何交易行为，不构成电商经营者、销售方、担保方或居间方。</li>
<li>平台不主动审核、核验、担保任何团长身份、资质、授权、履约能力、信誉状况；不审核、不担保任何开团商品的来源、质量、数量、真伪、合规性、安全性、价格合理性、售后保障等信息。</li>
<li>平台不参与分润、不保管交易资金、不介入交易磋商与履行，与团长、用户之间不存在合伙、委托、代理、雇佣等关系。</li>
</ol>
</div>

<div class="disclaimer-section">
<h4>二、信息真实性与合法性免责</h4>
<ol>
<li>平台展示的开团标题、商品描述、规格、价格、库存、发货周期、团长联系方式、参团规则等全部内容，均由团长自行发布、上传、提供，平台未修改、未编辑、未增删核心交易信息。</li>
<li>平台对前述信息的真实性、准确性、完整性、合法性、时效性<strong>不作任何明示或默示保证</strong>，不承担任何虚假宣传、误导消费、侵权违约等相关责任。</li>
<li>用户应自行审慎核实团长身份、商品授权、质检报告、售后政策、退款规则等全部交易要素，自愿判断并承担交易风险。</li>
</ol>
</div>

<div class="disclaimer-section">
<h4>三、交易责任与风险承担</h4>
<ol>
<li>用户基于本平台信息自愿参与拼团、支付款项、达成交易，均视为<strong>自主决策、自担风险</strong>，与本平台无任何法律关联。</li>
<li>因开团交易产生的一切纠纷与损失，包括但不限于：货不对板、质量瑕疵、漏发错发、延迟发货、虚假发货、拒绝售后、退款不能、团长失联跑路、资金损失、人身财产损害、知识产权侵权等，均由用户与团长自行协商解决、自行承担责任。</li>
<li>本平台不承担任何法律责任、违约赔偿责任、侵权责任、连带责任、补充赔偿责任、垫付责任或兜底责任，亦无义务介入调解、举证、维权或赔偿等。</li>
</ol>
</div>

<div class="disclaimer-section">
<h4>四、平台权利与义务边界</h4>
<ol>
<li>平台仅在收到权利人有效侵权通知并提供初步证据后，依法对涉嫌侵权信息采取删除、屏蔽、断开链接等必要措施，此举不代表平台承认过错或承担责任，仅为履行法定义务。</li>
<li>平台有权自行判断并删除违法、违规、侵权、投诉较多或不适宜展示的信息，但无事先审查及持续监控义务，不因此产生担保或注意义务。</li>
<li>平台不提供交易资金托管、担保交易、履约保证等金融或信用服务，用户与团长的资金往来、交付安排均由双方自行负责。</li>
</ol>
</div>

<div class="disclaimer-section">
<h4>五、责任限制与免责</h4>
<ol>
<li>在法律允许的最大范围内，平台明示排除所有明示或默示保证，包括但不限于适销性、特定用途适用性、无权利瑕疵、无安全缺陷等。</li>
<li>平台不对任何直接、间接、偶然、特殊、后续或惩罚性损失承担责任，包括但不限于利润损失、商誉损失、数据损失、机会损失等，即使平台已被告知该等损失的可能性。</li>
<li>因不可抗力、第三方行为、用户自身过错、团长过错导致的一切不利后果，均与本平台无关。</li>
</ol>
</div>

<div class="disclaimer-section">
<h4>六、用户使用与同意条款</h4>
<ol>
<li>凡浏览、查阅、复制、转发、参与本平台任何开团信息，即视为已阅读、充分理解并<strong>不可撤销同意</strong>本免责声明全部条款，自愿接受约束。</li>
<li>用户如不同意本声明，应立即停止使用本平台，并删除相关信息。</li>
<li>本声明可依法更新，一经公示即生效；用户继续使用视为接受更新后版本。</li>
</ol>
</div>

<div class="disclaimer-notice">
<p><strong>重要法律提示：</strong>拼团交易存在资金安全、商品质量、履约保障等多重风险，请谨慎甄别、理性参与、保障自身合法权益。</p>
</div>
</div>`,
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
        carouselFeatured: [],
        carouselConfig: { customCount: 0, customIds: [], banners: {} },
        nextProductCode: 10001
    };
}

const WS_CAROUSEL_MAX = 5;

function wsFormatCodeFromNum(n) {
    return "WS-" + String(n).padStart(5, "0");
}

function wsEnsureProductCodes() {
    if (!wsData) return;
    if (typeof wsData.nextProductCode !== "number" || wsData.nextProductCode < 10001) {
        let max = 10000;
        (wsData.products || []).forEach((p) => {
            if (p.codeNum && p.codeNum > max) max = p.codeNum;
        });
        wsData.nextProductCode = max + 1;
    }
    (wsData.products || []).forEach((p) => {
        if (!p.codeNum) {
            p.codeNum = wsData.nextProductCode++;
            p.code = wsFormatCodeFromNum(p.codeNum);
        } else if (!p.code) {
            p.code = wsFormatCodeFromNum(p.codeNum);
        }
    });
}

function wsAllocateProductCode() {
    wsEnsureProductCodes();
    const codeNum = wsData.nextProductCode++;
    return { codeNum, code: wsFormatCodeFromNum(codeNum) };
}

function wsCanSeeProductCode() {
    wsSyncFromMain();
    return wsIsAdmin || wsIsLeader();
}

function wsProductCodeHtml(p) {
    if (!wsCanSeeProductCode() || !p?.code) return "";
    return `<span class="ws-product-code">${wsEscape(p.code)}</span>`;
}

function wsFindProductByCode(input) {
    wsEnsureProductCodes();
    const raw = String(input || "").trim().toUpperCase();
    if (!raw) return null;
    const num = parseInt(raw.replace(/^WS-?/i, ""), 10);
    if (!num || Number.isNaN(num)) return null;
    return wsData.products.find((p) => p.codeNum === num) || null;
}

function wsEnsureCarouselConfig() {
    if (!wsData) return;
    const legacy = Array.isArray(wsData.carouselFeatured) ? wsData.carouselFeatured : [];
    if (!wsData.carouselConfig || typeof wsData.carouselConfig !== "object") {
        wsData.carouselConfig = {
            customCount: legacy.length ? Math.min(WS_CAROUSEL_MAX, legacy.length) : 0,
            customIds: legacy.slice(0, WS_CAROUSEL_MAX)
        };
    }
    const cfg = wsData.carouselConfig;
    if (typeof cfg.customCount !== "number") {
        if (cfg.mode === "custom") {
            cfg.customCount = Math.min(WS_CAROUSEL_MAX, (cfg.customIds || []).length || WS_CAROUSEL_MAX);
        } else if (cfg.mode === "want_rank") {
            cfg.customCount = 0;
        } else {
            cfg.customCount = Math.min(WS_CAROUSEL_MAX, (cfg.customIds || []).length);
        }
    }
    cfg.customCount = Math.max(0, Math.min(WS_CAROUSEL_MAX, Math.round(cfg.customCount)));
    cfg.customIds = (cfg.customIds || [])
        .filter((id, i, arr) => id && arr.indexOf(id) === i)
        .slice(0, cfg.customCount);
    delete cfg.mode;
    if (!cfg.banners || typeof cfg.banners !== "object") cfg.banners = {};
    wsData.carouselFeatured = [...cfg.customIds];
}

function wsCarouselBannerSrc(productId) {
    wsEnsureCarouselConfig();
    const banners = wsData.carouselConfig.banners || {};
    if (productId && banners[productId]) return banners[productId];
    const p = wsData.products.find((x) => x.id === productId);
    return (p && p.image) || "";
}

function wsCarouselWantSlots() {
    wsEnsureCarouselConfig();
    return WS_CAROUSEL_MAX - (wsData.carouselConfig.customCount || 0);
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
    wsEnsureCarouselConfig();
    wsEnsureProductCodes();
    // 异步从 API 拉取最新商品数据
    wsSyncProductsFromAPI();
}

async function wsSyncProductsFromAPI() {
    try {
        const data = await apiGetProducts();
        if (data.products && data.products.length > 0) {
            // 用 API 数据替换本地商品列表
            wsData.products = data.products.map(p => ({
                id: p.id,
                name: p.name,
                image: p.image_url || "",
                desc: p.description || "",
                price: p.price || "",
                groupId: p.group_id || "",
                category: p.category || "其他",
                subCategory: p.sub_category || "",
                hasQuestion: p.has_question || false,
                question: p.question || "",
                answer: p.answer || "",
                contactImage: p.contact_image_url || "",
                status: p.status || "online",
                wantCount: p.want_count || 0,
                code: p.code || "",
                leaderUid: p.leader_uid || "",
            }));
            wsSave();
            wsRenderProductGrid();
            wsRenderCarousel();
        }
    } catch (err) {
        console.warn("从API同步商品数据失败，使用本地数据:", err);
    }
}

function wsSave() {
    wsEnsureCarouselConfig();
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

function wsWantRankProducts(excludeIds, n) {
    const used = new Set(excludeIds || []);
    return [...wsVisibleProducts()]
        .filter((p) => !used.has(p.id))
        .sort((a, b) => wsProductWantCount(b) - wsProductWantCount(a))
        .slice(0, n);
}

function wsCarouselItems() {
    wsEnsureCarouselConfig();
    const cfg = wsData.carouselConfig;
    const customCount = cfg.customCount || 0;
    const customIds = (cfg.customIds || []).slice(0, customCount);
    const visMap = new Map(wsVisibleProducts().map((p) => [p.id, p]));
    const items = [];
    const used = new Set();

    customIds.forEach((id) => {
        const p = visMap.get(id);
        if (p && !used.has(p.id)) {
            items.push({ type: "featured", product: p });
            used.add(p.id);
        }
    });

    const wantSlots = WS_CAROUSEL_MAX - customCount;
    if (wantSlots > 0) {
        wsWantRankProducts(customIds, wantSlots).forEach((p) => {
            items.push({ type: "hot", product: p });
        });
    }

    return items;
}

function wsIsInCarouselCustom(pid) {
    wsEnsureCarouselConfig();
    return (wsData.carouselConfig.customIds || []).includes(pid);
}

function wsCarouselModeLabel() {
    wsEnsureCarouselConfig();
    const n = wsData.carouselConfig.customCount || 0;
    const w = WS_CAROUSEL_MAX - n;
    if (n === 0) return `想要榜×${w}`;
    if (w === 0) return `自定义×${n}`;
    return `${n}自定义+${w}想要榜`;
}

function wsReadFileAsDataURL(input, cb) {
    if (!input.files?.[0]) return;
    // 优先使用 API 上传到对象存储，失败则回退到 base64
    apiUploadImage(input.files[0])
        .then((url) => cb(url))
        .catch((err) => {
            console.warn("图片上传失败，回退到本地存储:", err);
            const r = new FileReader();
            r.onload = (e) => cb(e.target.result);
            r.readAsDataURL(input.files[0]);
        });
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
    wsShowDisclaimer(true);
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

/** 管理员：设置微博Cookie */
function wsAdminSetCookie() {
    const current = localStorage.getItem("mimi_weibo_sub_cookie") || "";
    const val = prompt("请粘贴微博 SUB Cookie 值（_2A25开头）：", current);
    if (val === null) return;
    if (val.trim()) {
        localStorage.setItem("mimi_weibo_sub_cookie", val.trim());
        alert("Cookie 已保存！立即生效。");
    } else {
        localStorage.removeItem("mimi_weibo_sub_cookie");
        alert("Cookie 已清除。");
    }
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
    wsSyncFromMain();
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
    wsLoad();
    wsSyncFromMain();
    wsUpdateToolbar();
    wsShowDisclaimer(true);
}

function wsLeavePage() {
    clearInterval(wsCarouselTimer);
    wsCarouselTimer = null;
}

/* ========== 免责弹窗 ========== */
function wsShowDisclaimer(forceShow) {
    if (!forceShow && sessionStorage.getItem("ws_disclaimer_ok")) {
        wsRenderAll();
        return;
    }
    const body = document.getElementById("wsDisclaimerBody");
    const btn = document.getElementById("wsDisclaimerOk");
    if (!body || !btn) {
        wsRenderAll();
        return;
    }
    body.innerHTML = wsData.disclaimer;
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
    sessionStorage.setItem("ws_disclaimer_ok", "1");
    closeM("modalWsDisclaimer");
    wsRenderAll();
}

function wsReShowDisclaimer() {
    wsShowDisclaimer(true);
}

/* ========== 渲染 ========== */
function wsRenderAll() {
    wsRenderCarousel();
    wsRenderCategoryTree();
    wsRenderGroupTabs();
    wsRenderProductGrid();
}

function wsUpdateFeaturedHint() {
    const hint = document.querySelector(".ws-featured-hint");
    if (!hint) return;
    wsEnsureCarouselConfig();
    const n = wsData.carouselConfig.customCount || 0;
    const w = WS_CAROUSEL_MAX - n;
    hint.textContent =
        n === 0
            ? `想要榜 TOP${w} · 自动更新 · 点击查看`
            : w === 0
                ? `管理员自定义 ${n} 个 · 点击查看`
                : `${n} 个自定义 + ${w} 个想要榜 · 点击查看`;
}

function wsRenderCarousel() {
    wsUpdateFeaturedHint();
    const items = wsCarouselItems();
    const card = document.getElementById("wsNoticeCard");
    const img = document.getElementById("wsNoticeImg");
    const tagEl = document.getElementById("wsNoticeTag");
    const nameEl = document.getElementById("wsNoticeName");
    const descEl = document.getElementById("wsNoticeDesc");
    const dots = document.getElementById("wsCarouselDots");
    if (!card || !img || !tagEl || !nameEl) return;
    if (!items.length) {
        img.src = "";
        img.style.display = "none";
        tagEl.textContent = "通知";
        nameEl.textContent = "暂无推荐";
        if (descEl) descEl.textContent = "上架商品后将在此展示";
        card.onclick = null;
        card.classList.remove("ws-notice-has-img");
        card.classList.add("ws-notice-empty");
        if (dots) dots.innerHTML = "";
        return;
    }
    card.classList.remove("ws-notice-empty");
    if (wsCarouselIndex >= items.length) wsCarouselIndex = 0;
    const item = items[wsCarouselIndex];
    const p = item.product;
    const bannerSrc = wsCarouselBannerSrc(p.id);
    img.style.display = bannerSrc ? "block" : "none";
    img.src = bannerSrc;
    card.classList.toggle("ws-notice-has-img", !!bannerSrc);
    tagEl.textContent = item.type === "featured" ? "精选" : "热门";
    nameEl.textContent = p.name || "";
    if (descEl) {
        const raw = (p.desc || "").trim();
        descEl.textContent = raw
            ? (raw.length > 72 ? raw.slice(0, 72) + "…" : raw)
            : "点击进入查看详情";
    }
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
            ${wsProductCodeHtml(p)}
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
    const codeHint = wsCanSeeProductCode() && p.code ? ` · 编号 ${p.code}` : "";
    document.getElementById("wsDetailGroup").textContent = (g ? `所属团：${g.name}` : "") + codeHint;
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
    wsRenderCarousel();
    wsRenderProductGrid();
}

/* ========== 团长申请 ========== */
function wsRenderLeaderApplyStatus() {
    const box = document.getElementById("wsLeaderApplyStatus");
    if (!box) return;
    wsSyncFromMain();
    if (wsIsLeader()) {
        box.innerHTML = `<div class="ws-apply-status ws-apply-status--ok">✅ 您已是团长，可使用「我要上架」发布商品。商品编号仅您与管理员可见。</div>`;
        return;
    }
    const pending = (wsData.applications || []).find((a) => a.user === wsUser?.name && a.status === "pending");
    const approved = (wsData.applications || []).find((a) => a.user === wsUser?.name && a.status === "approved");
    if (pending) {
        box.innerHTML = `<div class="ws-apply-status ws-apply-status--pending">⏳ 您已提交团长申请（${wsFormatDate(pending.ts)}），请等待管理员在「管理后台」审核。</div>`;
        return;
    }
    if (approved) {
        box.innerHTML = `<div class="ws-apply-status ws-apply-status--ok">✅ 申请已通过。若仍看不到「我要上架」，请刷新页面或联系管理员为您创建团。</div>`;
        return;
    }
    box.innerHTML = `<div class="ws-apply-status">填写说明后提交 → 管理员审核 → 开通团长 → 管理员为您「创建团」→ 即可「我要上架」。</div>`;
}

function wsOpenLeaderApply() {
    wsLoad();
    wsSyncFromMain();
    if (!wsUser && typeof currentUser !== "undefined" && currentUser) {
        wsUser = { name: currentUser.name, type: currentUser.type, uid: currentUser.uid };
    }
    if (!wsUser) return alert("请先登录");
    const doc = document.getElementById("wsApplyDoc");
    const email = document.getElementById("wsApplyEmail");
    const note = document.getElementById("wsApplyNote");
    const modal = document.getElementById("modalWsLeaderApply");
    if (!doc || !email || !note || !modal) return;
    doc.href = wsData.applyDocUrl || "#";
    doc.textContent = "📄 团长申请说明文档";
    email.textContent = `联系邮箱：${wsData.applyEmail || "待设置"}`;
    note.value = "";
    wsRenderLeaderApplyStatus();
    modal.style.display = "flex";
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
    wsRenderLeaderApplyStatus();
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
    const codeInfo = wsAllocateProductCode();
    const p = {
        id: "p_" + Date.now(),
        codeNum: codeInfo.codeNum,
        code: codeInfo.code,
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
    alert(`上架成功！\n商品编号：${p.code}\n（仅团长与管理员可见，用于精品推荐配置）`);
    closeM("modalWsList");
    wsRenderAll();
}

/* ========== 管理后台 ========== */
function wsOpenAdmin() {
    wsLoad();
    wsSyncFromMain();
    wsUpdateToolbar();
    if (!wsIsAdmin) return alert("仅管理员可进入管理后台");
    wsRenderAdmin();
    const modal = document.getElementById("modalWsAdmin");
    if (!modal) return;
    modal.style.display = "flex";
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
        `<div class="ws-list-row"><span><b>${wsEscape(p.code || "—")}</b> · ${wsEscape(p.name)} (${wsEscape(p.status)})</span>
        <span>
            <button class="btn-ui-secondary" onclick="wsSetProductStatus('${p.id}','active')">上架</button>
            <button class="btn-ui-secondary" onclick="wsSetProductStatus('${p.id}','gray')">变灰</button>
            <button class="btn-ui-tag-del" onclick="wsSetProductStatus('${p.id}','offline')">下架</button>
            <button class="btn-ui-secondary" onclick="wsToggleFeatured('${p.id}')">${wsIsInCarouselCustom(p.id) ? "取消推荐" : "加入推荐"}</button>
        </span></div>`
    ).join("") || "<div style='color:#999;'>暂无制品</div>";

    const cats = document.getElementById("wsAdminCats");
    cats.innerHTML = wsData.categories.map((c, i) =>
        `<div class="ws-list-row"><span>${wsEscape(c.name)}：${(c.subs||[]).join("、")}</span>
        <button class="btn-ui-tag-del" onclick="wsRemoveCategory(${i})">删除</button></div>`
    ).join("") || "";

    wsRenderAdminCarousel();
}

function wsSetCarouselCustomCount(count) {
    if (!wsIsAdmin) return;
    wsEnsureCarouselConfig();
    const cfg = wsData.carouselConfig;
    cfg.customCount = Math.max(0, Math.min(WS_CAROUSEL_MAX, count));
    cfg.customIds = (cfg.customIds || []).slice(0, cfg.customCount);
    wsSave();
    wsRenderAdminCarousel();
    wsRenderCarousel();
}

function wsRenderAdminCarousel() {
    wsEnsureCarouselConfig();
    const cfg = wsData.carouselConfig;
    const customCount = cfg.customCount || 0;
    const wantSlots = WS_CAROUSEL_MAX - customCount;
    const ids = cfg.customIds || [];
    const vis = wsVisibleProducts();

    const countSel = document.getElementById("wsAdminCarouselCustomCount");
    if (countSel) countSel.value = String(customCount);

    const wantLabel = document.getElementById("wsAdminCarouselWantCountLabel");
    if (wantLabel) {
        wantLabel.textContent =
            wantSlots > 0 ? `想要榜：${wantSlots} 个（自动）` : "（全部为自定义，无想要榜位）";
    }

    const customPanel = document.getElementById("wsAdminCarouselCustom");
    const wantPanel = document.getElementById("wsAdminCarouselWant");
    const addRow = document.getElementById("wsAdminCarouselAddRow");
    if (customPanel) customPanel.style.display = customCount > 0 ? "block" : "none";
    if (wantPanel) wantPanel.style.display = wantSlots > 0 ? "block" : "none";
    if (addRow) addRow.style.display = customCount > 0 ? "flex" : "none";

    const listEl = document.getElementById("wsAdminCarouselList");
    if (listEl) {
        if (customCount === 0) {
            listEl.innerHTML = `<div class="ws-admin-carousel-empty">将「自定义数量」设为 1～5 后可添加</div>`;
        } else if (!ids.length) {
            listEl.innerHTML = `<div class="ws-admin-carousel-empty">请添加自定义商品（0/${customCount}）</div>`;
        } else {
            listEl.innerHTML = ids.map((pid, idx) => {
                const p = wsData.products.find((x) => x.id === pid);
                const name = p ? wsEscape(p.name) : "（已下架）";
                const warn = p && !vis.find((v) => v.id === pid) ? " · 未在售" : "";
                const codeLabel = p?.code ? ` · ${wsEscape(p.code)}` : "";
                return `<div class="ws-admin-carousel-slot">
                    <span class="ws-admin-carousel-idx">${idx + 1}</span>
                    <span class="ws-admin-carousel-name">${name}${codeLabel}${warn}</span>
                    <span class="ws-admin-carousel-slot-actions">
                        <button type="button" class="btn-ui-secondary" ${idx === 0 ? "disabled" : ""} onclick="wsAdminCarouselMove('${pid}',-1)">↑</button>
                        <button type="button" class="btn-ui-secondary" ${idx >= ids.length - 1 ? "disabled" : ""} onclick="wsAdminCarouselMove('${pid}',1)">↓</button>
                        <button type="button" class="btn-ui-secondary" onclick="wsAdminCarouselSetBanner('${pid}')">推荐大图</button>
                        <button type="button" class="btn-ui-tag-del" onclick="wsAdminCarouselRemove('${pid}')">移除</button>
                    </span>
                </div>`;
            }).join("");
        }
    }

    const pick = document.getElementById("wsAdminCarouselPick");
    if (pick) {
        const options = vis
            .filter((p) => !ids.includes(p.id))
            .map((p) => `<option value="${p.id}">${wsEscape(p.code || "")} ${wsEscape(p.name)}（想要 ${wsProductWantCount(p)}）</option>`)
            .join("");
        pick.innerHTML =
            `<option value="">选择商品添加（${ids.length}/${customCount}）</option>` + options;
        pick.disabled = customCount === 0 || ids.length >= customCount;
    }

    const preview = document.getElementById("wsAdminCarouselWantPreview");
    if (preview) {
        if (wantSlots <= 0) {
            preview.innerHTML = `<div class="ws-admin-carousel-empty">当前无想要榜位</div>`;
        } else {
        const top = wsWantRankProducts(ids, wantSlots);
        preview.innerHTML = top.length
            ? top.map((p, i) =>
                `<div class="ws-admin-carousel-slot"><span class="ws-admin-carousel-idx">${customCount + i + 1}</span>
                <span class="ws-admin-carousel-name">${wsEscape(p.code || "")} ${wsEscape(p.name)}</span>
                <span class="ws-admin-carousel-want">想要 ${wsProductWantCount(p)}</span></div>`
            ).join("")
            : `<div class="ws-admin-carousel-empty">暂无在售商品或想要数据</div>`;
        }
    }
}

function wsAdminCarouselAddProduct(pid, fromCode) {
    if (!wsIsAdmin || !pid) return false;
    wsEnsureCarouselConfig();
    const cfg = wsData.carouselConfig;
    if ((cfg.customCount || 0) === 0) {
        alert("请先将「自定义数量」设为 1 或以上");
        return false;
    }
    const ids = cfg.customIds;
    if (ids.includes(pid)) {
        alert("该商品已在自定义列表中");
        return false;
    }
    if (ids.length >= cfg.customCount) {
        alert(`自定义位已满（${cfg.customCount} 个），请移除后再添加或增加自定义数量`);
        return false;
    }
    ids.push(pid);
    wsSave();
    wsRenderAdminCarousel();
    wsRenderCarousel();
    if (fromCode) {
        const inp = document.getElementById("wsAdminCarouselCodeInp");
        if (inp) inp.value = "";
    }
    return true;
}

function wsAdminCarouselAddByCode() {
    if (!wsIsAdmin) return;
    const inp = document.getElementById("wsAdminCarouselCodeInp");
    const raw = inp?.value?.trim();
    if (!raw) return alert("请输入商品编号，如 10001 或 WS-10001");
    const p = wsFindProductByCode(raw);
    if (!p) return alert("未找到该编号的商品，请确认已上架且编号正确");
    if (wsAdminCarouselAddProduct(p.id, true)) {
        alert(`已添加推荐：${p.code} ${p.name}`);
    }
}

function wsAdminCarouselAdd() {
    if (!wsIsAdmin) return;
    const pick = document.getElementById("wsAdminCarouselPick");
    const pid = pick?.value;
    if (!pid) return alert("请先选择商品");
    wsAdminCarouselAddProduct(pid, false);
}

function wsAdminCarouselRemove(pid) {
    if (!wsIsAdmin) return;
    wsEnsureCarouselConfig();
    wsData.carouselConfig.customIds = (wsData.carouselConfig.customIds || []).filter((id) => id !== pid);
    if (wsData.carouselConfig.banners && wsData.carouselConfig.banners[pid]) {
        delete wsData.carouselConfig.banners[pid];
    }
    wsSave();
    wsRenderAdminCarousel();
    wsRenderCarousel();
}

function wsAdminCarouselMove(pid, delta) {
    if (!wsIsAdmin) return;
    wsEnsureCarouselConfig();
    const ids = wsData.carouselConfig.customIds || [];
    const i = ids.indexOf(pid);
    if (i < 0) return;
    const j = i + delta;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    wsSave();
    wsRenderAdminCarousel();
    wsRenderCarousel();
}

function wsAdminCarouselSetBanner(pid) {
    if (!wsIsAdmin) return;
    wsEnsureCarouselConfig();
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
        if (!input.files?.[0]) return;
        apiUploadImage(input.files[0])
            .then((url) => {
                wsData.carouselConfig.banners = wsData.carouselConfig.banners || {};
                wsData.carouselConfig.banners[pid] = url;
                wsSave();
                wsRenderAdminCarousel();
                wsRenderCarousel();
                alert("推荐大图已设置");
            })
            .catch((err) => {
                console.warn("图片上传失败，回退到本地:", err);
                const r = new FileReader();
                r.onload = (e) => {
                    wsData.carouselConfig.banners = wsData.carouselConfig.banners || {};
                    wsData.carouselConfig.banners[pid] = e.target.result;
                    wsSave();
                    wsRenderAdminCarousel();
                    wsRenderCarousel();
                    alert("推荐大图已设置");
                };
                r.readAsDataURL(input.files[0]);
            });
    };
    input.click();
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
    if (status === "offline") {
        wsEnsureCarouselConfig();
        wsData.carouselConfig.customIds = (wsData.carouselConfig.customIds || []).filter((id) => id !== pid);
    }
    wsSave();
    wsRenderAdmin();
    wsRenderAll();
}

function wsToggleFeatured(pid) {
    wsEnsureCarouselConfig();
    const cfg = wsData.carouselConfig;
    const ids = cfg.customIds;
    const i = ids.indexOf(pid);
    if (i >= 0) {
        ids.splice(i, 1);
    } else {
        if ((cfg.customCount || 0) === 0) {
            if (!confirm("当前没有自定义位。是否设为 1 个自定义位并加入该商品？")) return;
            cfg.customCount = 1;
        }
        if (ids.length >= cfg.customCount) {
            alert(`自定义位已满（${cfg.customCount}/${WS_CAROUSEL_MAX}），请在管理后台调整数量或移除商品`);
            return;
        }
        ids.push(pid);
    }
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

/** 演示：加载示例团与商品（管理员测试用） */
function wsDemoSeedWorkshop() {
    if (!wsIsAdmin) return alert("仅管理员可用");
    wsLoad();
    wsEnsureProductCodes();
    const leaderName = wsUser?.name || "admin";
    let rec = wsData.leaders.find((l) => l.user === leaderName);
    if (!rec) {
        rec = { user: leaderName, groupIds: [], expiresAt: Date.now() + 30 * 86400000, active: true };
        wsData.leaders.push(rec);
    } else {
        rec.active = true;
        rec.expiresAt = Date.now() + 30 * 86400000;
    }
    let gid = rec.groupIds?.[0];
    let g = gid ? wsData.groups.find((x) => x.id === gid) : null;
    if (!g) {
        gid = "g_demo_" + Date.now();
        g = {
            id: gid,
            name: "演示团·米米好物",
            leaderUser: leaderName,
            startAt: Date.now() - 86400000,
            endAt: Date.now() + 30 * 86400000,
            maxProducts: 10,
            active: true
        };
        wsData.groups.push(g);
        rec.groupIds = rec.groupIds || [];
        rec.groupIds.push(gid);
    }
    const demos = [
        { name: "手工玉米挂件", desc: "演示商品 A", majorCat: "饰品", minorCat: "挂件", want: 12 },
        { name: "校园文创徽章", desc: "演示商品 B", majorCat: "饰品", minorCat: "其他", want: 8 },
        { name: "10cm 棉花娃娃", desc: "演示商品 C", majorCat: "娃娃", minorCat: "10cm娃", want: 5 }
    ];
    const added = [];
    demos.forEach((d) => {
        if (wsData.products.some((p) => p.name === d.name && p.groupId === gid)) return;
        const codeInfo = wsAllocateProductCode();
        wsData.products.push({
            id: "p_demo_" + Date.now() + "_" + codeInfo.codeNum,
            codeNum: codeInfo.codeNum,
            code: codeInfo.code,
            groupId: gid,
            name: d.name,
            desc: d.desc,
            majorCat: d.majorCat,
            minorCat: d.minorCat,
            image: "",
            contactImage: "",
            hasQuestion: false,
            wantCount: d.want,
            status: "active",
            listedUntil: g.endAt,
            leaderUser: leaderName,
            createdAt: Date.now()
        });
        added.push(codeInfo.code);
    });
    wsSave();
    wsUpdateToolbar();
    wsRenderAll();
    if (typeof wsRenderAdmin === "function" && document.getElementById("modalWsAdmin")?.style.display === "flex") {
        wsRenderAdmin();
    }
    alert(`演示数据已加载！\n团长：${leaderName}\n团名：${g.name}\n商品编号：${added.join("、") || "（已有商品未重复添加）"}\n\n可在管理后台用编号配置精品推荐。`);
}

/** 演示：当前登录账号直接成为团长（跳过审核） */
function wsDemoMakeCurrentUserLeader() {
    wsLoad();
    wsSyncFromMain();
    const name = wsUser?.name || currentUser?.name;
    if (!name) return alert("请先登录");
    if (!wsIsAdmin && !confirm("仅建议管理员用于测试。确定将当前账号设为团长？")) return;
    let rec = wsData.leaders.find((l) => l.user === name);
    if (!rec) {
        rec = { user: name, groupIds: [], expiresAt: Date.now() + 30 * 86400000, active: true };
        wsData.leaders.push(rec);
    } else {
        rec.active = true;
        rec.expiresAt = Date.now() + 30 * 86400000;
    }
    (wsData.applications || []).filter((a) => a.user === name && a.status === "pending").forEach((a) => {
        a.status = "approved";
    });
    wsSave();
    wsUpdateToolbar();
    alert(`已为「${name}」开通团长资格（30天）。\n请让管理员在后台「创建团」后，即可使用「我要上架」。\n或点击「加载演示数据」自动创建演示团与商品。`);
}

function wsInit() {
    wsLoad();
    wsRenderCategoryTree();
    wsTryAutoLogin();
}

document.addEventListener("DOMContentLoaded", wsInit);
