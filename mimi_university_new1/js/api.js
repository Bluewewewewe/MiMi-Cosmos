/**
 * MiMi-Cosmos API 适配层
 * 将 localStorage 操作逐步替换为后端 API 调用
 */

const API_BASE = window.location.origin;

/* ========== 通用请求 ========== */
async function apiGet(path) {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
    return res.json();
}

async function apiPost(path, body) {
    const res = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
    return res.json();
}

async function apiPut(path, body) {
    const res = await fetch(`${API_BASE}${path}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
    return res.json();
}

async function apiDelete(path) {
    const res = await fetch(`${API_BASE}${path}`, { method: "DELETE" });
    if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
    return res.json();
}

/* ========== 图片上传 ========== */
async function apiUploadImage(file) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/api/upload`, {
        method: "POST",
        body: formData,
    });
    if (!res.ok) throw new Error("Upload failed");
    const data = await res.json();
    return data.url; // 返回图片的公开访问 URL
}

/* ========== 用户相关 ========== */
async function apiGetUser(uid) {
    return apiGet(`/api/users/${uid}`);
}

async function apiCreateUser(userData) {
    return apiPost("/api/users", userData);
}

async function apiUpdateUser(uid, userData) {
    return apiPut(`/api/users/${uid}`, userData);
}

/* ========== 小作坊商品 ========== */
async function apiGetProducts(filters = {}) {
    const params = new URLSearchParams();
    if (filters.category) params.set("category", filters.category);
    if (filters.seller_id) params.set("seller_id", filters.seller_id);
    const qs = params.toString();
    return apiGet(`/api/workshop/products${qs ? "?" + qs : ""}`);
}

async function apiGetProduct(id) {
    return apiGet(`/api/workshop/products/${id}`);
}

async function apiCreateProduct(productData) {
    return apiPost("/api/workshop/products", productData);
}

async function apiUpdateProduct(id, productData) {
    return apiPut(`/api/workshop/products/${id}`, productData);
}

async function apiDeleteProduct(id) {
    return apiDelete(`/api/workshop/products/${id}`);
}

/* ========== 团长申请 ========== */
async function apiApplyLeader(applicationData) {
    return apiPost("/api/leader-applications", applicationData);
}

async function apiGetLeaderApplications() {
    return apiGet("/api/leader-applications");
}

async function apiUpdateLeaderApplication(id, status) {
    return apiPut(`/api/leader-applications/${id}`, { status });
}
