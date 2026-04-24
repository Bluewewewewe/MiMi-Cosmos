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

    // BUG修改记录再次登录无需填写密码：填充记住的登录凭据
    document.getElementById("lUser").value = localStorage.getItem("rememberedUser") || "";
    document.getElementById("lPass").value = localStorage.getItem("rememberedPass") || "";
    document.getElementById("lRole").value = localStorage.getItem("rememberedRole") || "student";
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

initApp();