import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { S3Storage } from "coze-coding-dev-sdk";
import multer from "multer";
import { execSync } from "child_process";

// 动态获取环境变量（coze dev 不自动注入，需要从 coze_workload_identity 获取）
function loadEnvVars() {
  try {
    const output = execSync(
      `python3 -c "
from coze_workload_identity import Client
client = Client()
env_vars = client.get_project_env_vars()
for v in env_vars:
    print(f'{v.key}={v.value}')
"`,
      { encoding: "utf-8" }
    );
    for (const line of output.trim().split("\n")) {
      const [key, ...valParts] = line.split("=");
      const value = valParts.join("=");
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch (e) {
    console.warn("Failed to load env vars from coze_workload_identity:", e.message);
  }
}
loadEnvVars();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.DEPLOY_RUN_PORT || 5000;

// 中间件
app.use(cors());
app.use(express.json());

// 静态文件服务 - 指向 mimi_university_new1 目录
app.use(express.static(path.join(__dirname, "mimi_university_new1")));

// Supabase 客户端
const supabaseUrl = process.env.COZE_SUPABASE_URL || "https://fcenabrbftpqeeuufbdr.supabase.co";
const supabaseKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
if (!supabaseKey) {
  console.error("Missing Supabase key");
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

// 对象存储客户端
const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: "",
  secretKey: "",
  bucketName: process.env.COZE_BUCKET_NAME,
  region: "cn-beijing",
});

// Multer 配置 - 内存存储，用于图片上传
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ==================== 认证 API ====================

// 统一认证接口
app.post("/api/auth", async (req, res) => {
  try {
    const { action, username, password } = req.body;
    
    if (action === "login") {
      if (!username || !password) {
        return res.status(400).json({ success: false, error: "请输入用户名和密码" });
      }

      const { data: user, error } = await supabase
        .from("users")
        .select("*")
        .eq("username", username)
        .single();

      if (error || !user) {
        return res.status(401).json({ success: false, error: "用户名或密码错误" });
      }

      if (user.password_hash !== password) {
        return res.status(401).json({ success: false, error: "用户名或密码错误" });
      }

      // 更新登录时间
      await supabase
        .from("users")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", user.id);

      res.json({ 
        success: true, 
        user: {
          id: user.id,
          username: user.username,
          weibo_name: user.weibo_name,
          weibo_uid: user.weibo_uid,
          avatar_url: user.avatar_url,
          chaohua_level: user.chaohua_level,
          is_admin: user.is_admin
        }
      });
    } else {
      res.status(400).json({ success: false, error: "未知操作" });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== 用户 API ====================

// 创建用户（注册）
app.post("/api/users", async (req, res) => {
  try {
    const { weibo_uid, weibo_name, avatar_url, chaohua_level, username, password } = req.body;
    if (!weibo_uid) return res.status(400).json({ error: "缺少微博UID" });
    if (!username || !password) return res.status(400).json({ error: "缺少用户名或密码" });

    // 检查用户名是否已存在
    const { data: existingUser } = await supabase
      .from("users")
      .select("*")
      .eq("username", username)
      .single();

    if (existingUser) {
      return res.status(400).json({ error: "用户名已存在" });
    }

    // 检查微博UID是否已注册
    const { data: existingWeibo } = await supabase
      .from("users")
      .select("*")
      .eq("weibo_uid", String(weibo_uid))
      .single();

    if (existingWeibo) {
      return res.status(400).json({ error: "该微博UID已注册" });
    }

    // 创建新用户
    const { data, error } = await supabase
      .from("users")
      .insert({
        weibo_uid: String(weibo_uid),
        weibo_name: weibo_name || username,
        avatar_url: avatar_url || "",
        id: String(weibo_uid),
        chaohua_level: chaohua_level || 0,
        is_admin: false,
        username: username,
        password_hash: password, // 简单存储，生产环境应加密
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ user: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 用户名密码登录
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "请输入用户名和密码" });
    }

    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("username", username)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: "用户名或密码错误" });
    }

    if (user.password_hash !== password) {
      return res.status(401).json({ error: "用户名或密码错误" });
    }

    // 更新登录时间
    await supabase
      .from("users")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", user.id);

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取用户信息（支持 weibo_uid 查询）
app.get("/api/users/:id", async (req, res) => {
  try {
    // 先按 id 查，查不到再按 weibo_uid 查
    let { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", req.params.id)
      .limit(1);

    if (!data || data.length === 0) {
      ({ data, error } = await supabase
        .from("users")
        .select("*")
        .eq("weibo_uid", req.params.id)
        .limit(1));
    }

    if (!data || data.length === 0) return res.status(404).json({ error: "用户不存在", detail: error?.message });
    res.json({ success: true, user: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== 小作坊商品 API ====================

// 获取商品列表
app.get("/api/workshop/products", async (req, res) => {
  try {
    const { status, seller_id } = req.query;
    let query = supabase.from("workshop_products").select("*").order("created_at", { ascending: false });

    if (status) query = query.eq("status", status);
    if (seller_id) query = query.eq("seller_id", seller_id);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    // 为每个商品的图片 key 生成签名 URL
    const productsWithUrls = await Promise.all(
      (data || []).map(async (product) => {
        if (product.image_key) {
          const image_url = await storage.generatePresignedUrl({ key: product.image_key, expireTime: 3600 }).catch(() => null);
          return { ...product, image_url };
        }
        return { ...product, image_url: null };
      })
    );

    res.json({ success: true, products: productsWithUrls });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取单个商品
app.get("/api/workshop/products/:id", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("workshop_products")
      .select("*")
      .eq("id", req.params.id)
      .single();
    if (error) return res.status(404).json({ error: "商品不存在" });

    let image_url = null;
    if (data.image_key) {
      image_url = await storage.generatePresignedUrl({ key: data.image_key, expireTime: 3600 }).catch(() => null);
    }

    res.json({ success: true, product: { ...data, image_url } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 创建商品
app.post("/api/workshop/products", async (req, res) => {
  try {
    const { title, description, price, stock, seller_id, image_key, category } = req.body;
    if (!title || !seller_id) return res.status(400).json({ error: "缺少商品名称或团长ID" });

    const { data, error } = await supabase
      .from("workshop_products")
      .insert({
        title,
        description: description || "",
        price: price || "",
        stock: stock || 0,
        seller_id,
        image_key: image_key || null,
        category: category || "其他",
        status: "active",
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, product: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 更新商品
app.put("/api/workshop/products/:id", async (req, res) => {
  try {
    const { title, description, price, stock, image_key, category, status } = req.body;
    const updates = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (price !== undefined) updates.price = price;
    if (stock !== undefined) updates.stock = stock;
    if (image_key !== undefined) updates.image_key = image_key;
    if (category !== undefined) updates.category = category;
    if (status !== undefined) updates.status = status;

    const { data, error } = await supabase
      .from("workshop_products")
      .update(updates)
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, product: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 删除商品
app.delete("/api/workshop/products/:id", async (req, res) => {
  try {
    const { error } = await supabase
      .from("workshop_products")
      .delete()
      .eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== 图片上传 API ====================

// 上传图片
app.post("/api/upload", upload.array("images", 9), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "没有上传文件" });
    }

    const keys = [];
    for (const file of req.files) {
      const ext = path.extname(file.originalname) || ".jpg";
      const fileName = `workshop/${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
      const key = await storage.uploadFile({
        fileContent: file.buffer,
        fileName,
        contentType: file.mimetype,
      });
      keys.push(key);
    }

    res.json({ success: true, keys });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取图片签名 URL
app.post("/api/image-url", async (req, res) => {
  try {
    const { keys } = req.body;
    if (!keys || !Array.isArray(keys)) return res.status(400).json({ error: "缺少图片keys" });

    const urls = await Promise.all(
      keys.map((key) =>
        storage.generatePresignedUrl({ key, expireTime: 3600 }).catch(() => null)
      )
    );
    res.json({ success: true, urls: urls.filter(Boolean) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== 团长申请 API ====================

// 提交团长申请
app.post("/api/leader-applications", async (req, res) => {
  try {
    const { user_id, weibo_url, reason } = req.body;
    if (!user_id) return res.status(400).json({ error: "缺少用户ID" });

    const { data, error } = await supabase
      .from("leader_applications")
      .insert({
        user_id,
        weibo_url: weibo_url || "",
        reason: reason || "",
        status: "pending",
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, application: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取团长申请列表（管理员）
app.get("/api/leader-applications", async (req, res) => {
  try {
    const { status } = req.query;
    let query = supabase.from("leader_applications").select("*").order("created_at", { ascending: false });
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, applications: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 审核团长申请
app.put("/api/leader-applications/:id", async (req, res) => {
  try {
    const { status, admin_note } = req.body;
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ error: "无效的审核状态" });
    }

    const { data, error } = await supabase
      .from("leader_applications")
      .update({ status, admin_note: admin_note || "" })
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    // 如果审核通过，更新用户角色为团长
    if (status === "approved" && data.user_id) {
      await supabase.from("users").update({ role: "leader" }).eq("id", data.user_id);
    }

    res.json({ success: true, application: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== 微博 Cookie 管理 ====================
// 运行时存储 Cookie（重启服务后需要重新设置）
let runtimeWeiboCookie = "";

// ============================================================
// 管理后台：设置微博Cookie（暂不可用，保留接口）
// ============================================================
app.post("/api/admin/weibo-cookie", (req, res) => {
  const { cookie } = req.body;
  if (!cookie) return res.status(400).json({ error: "Cookie 不能为空" });
  runtimeWeiboCookie = cookie;
  console.log("[微博Cookie] 已更新");
  res.json({ success: true, message: "微博 Cookie 已更新" });
});

app.get("/api/admin/weibo-cookie-status", (req, res) => {
  res.json({ hasCookie: !!(runtimeWeiboCookie || process.env.WEIBO_SUB_COOKIE) });
});

// ==================== 浏览器端验证代理（用户在自己浏览器中调用） ====================
app.post("/api/verify-weibo-browser", async (req, res) => {
  const { uid, code } = req.body;
  if (!uid || !/^\d+$/.test(uid)) {
    return res.status(400).json({ error: "无效的UID" });
  }

  const result = { uid, bioMatch: false, isCPFan: false, chaohuaLevel: 0, weiboName: "", avatarUrl: "", code };

  try {
    // 获取用户信息
    const infoResp = await fetch(`https://weibo.com/ajax/profile/info?uid=${uid}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120", "Referer": "https://weibo.com/" }
    });
    const infoData = await infoResp.json();
    if (infoData.ok === 1 && infoData.data && infoData.data.user) {
      const user = infoData.data.user;
      result.weiboName = user.screen_name || "";
      result.avatarUrl = user.avatar_hd || user.avatar_large || "";
      const bio = user.description || "";
      result.bioMatch = bio.includes(code);

      // 检查超话
      try {
        const chResp = await fetch(`https://weibo.com/ajax/profile/topicContent?tabid=231583&uid=${uid}`, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120", "Referer": "https://weibo.com/" }
        });
        const chData = await chResp.json();
        if (chData.data && chData.data.list) {
          for (const item of chData.data.list) {
            if (item.containerid && item.containerid.includes("1008085cf0862440cd3b74d986d8f0618870e0")) {
              result.isCPFan = true;
              result.chaohuaLevel = item.level || 0;
              break;
            }
          }
        }
      } catch (e) { console.error("超话检查失败:", e.message); }
    }
  } catch (e) { console.error("用户信息获取失败:", e.message); }

  res.json(result);
});

// ==================== 提交浏览器验证结果 ====================
app.post("/api/verify-weibo-result", async (req, res) => {
  const { uid, verifyData } = req.body;
  if (!uid || !verifyData) {
    return res.status(400).json({ error: "参数缺失" });
  }

  // 验证数据完整性
  const code = localStorage_getCode(uid);
  if (code && verifyData.code !== code) {
    return res.json({ success: false, reason: "验证码不匹配" });
  }

  if (!verifyData.bioMatch) {
    return res.json({ success: false, reason: "简介验证码不匹配，请确认已将验证码写入微博简介" });
  }
  if (!verifyData.isCPFan) {
    return res.json({ success: false, reason: "未加入栩你渝生超话" });
  }
  if (verifyData.chaohuaLevel < 7) {
    return res.json({ success: false, reason: "超话等级不足7级（当前：" + (verifyData.chaohuaLevel || 0) + "级）" });
  }

  // 验证通过，将结果写入数据库
  try {
    await supabase.from("users").upsert({
      id: uid,
      weibo_uid: uid,
      weibo_name: verifyData.weiboName || "",
      avatar_url: verifyData.avatarUrl || "",
      chaohua_level: verifyData.chaohuaLevel || 0,
      is_admin: false
    });
  } catch (e) { console.error("保存用户失败:", e); }

  res.json({ success: true });
});

// 简单的验证码存储（生产环境应存数据库）
const codeStore = {};
function localStorage_getCode(uid) { return codeStore[uid]; }

// ==================== 微博验证 API（服务器端，需要Cookie） ====================
app.post("/api/verify-weibo", async (req, res) => {
  const { uid, expectedCode } = req.body;

  if (!uid || !/^\d+$/.test(uid)) {
    return res.status(400).json({ error: "请输入正确的微博UID" });
  }
  if (!expectedCode) {
    return res.status(400).json({ error: "请先获取验证码" });
  }

  try {
    // 爬取微博用户主页获取简介
    const weiboSubCookie = runtimeWeiboCookie || process.env.WEIBO_SUB_COOKIE || "";
    let weiboName = "";
    let avatarUrl = "";
    let bio = "";
    let isCPFan = false;
    let chaohuaLevel = 0;

    // 方法1：通过微博 AJAX 接口获取用户信息
    try {
      const ajaxUrl = `https://weibo.com/ajax/profile/info?uid=${uid}`;
      const ajaxResp = await fetch(ajaxUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/json, text/plain, */*",
          "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
          Cookie: `SUB=${weiboSubCookie}`,
          Referer: `https://weibo.com/u/${uid}`,
          "X-Requested-With": "XMLHttpRequest",
        },
        signal: AbortSignal.timeout(10000),
      });

      if (ajaxResp.ok) {
        const contentType = ajaxResp.headers.get("content-type") || "";
        const rawText = await ajaxResp.text();
        console.log("[微博验证] AJAX接口 status:", ajaxResp.status, "content-type:", contentType, "body前200字:", rawText.substring(0, 200));
        if (contentType.includes("json") || rawText.startsWith("{")) {
          const ajaxData = JSON.parse(rawText);
          if (ajaxData.data && ajaxData.data.user) {
            const user = ajaxData.data.user;
            weiboName = user.screen_name || "";
            avatarUrl = user.avatar_hd || user.avatar_large || "";
            bio = user.description || "";
            console.log("[微博验证] 用户信息获取成功:", weiboName, "简介:", bio);
          }
        }
      } else {
        console.log("[微博验证] AJAX接口返回非200:", ajaxResp.status);
      }
    } catch (e) {
      console.error("[微博验证] AJAX接口获取失败:", e.message);
    }

    // 方法2：如果方法1没拿到，尝试移动端 API
    if (!bio && !weiboName) {
      try {
        const apiUrl = `https://m.weibo.cn/api/container/getIndex?type=uid&value=${uid}`;
        const apiResp = await fetch(apiUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
            Accept: "application/json, text/plain, */*",
            "Accept-Language": "zh-CN,zh;q=0.9",
            Cookie: `SUB=${weiboSubCookie}`,
            Referer: `https://m.weibo.cn/u/${uid}`,
          },
          signal: AbortSignal.timeout(10000),
        });

        if (apiResp.ok) {
          const rawText = await apiResp.text();
          console.log("[微博验证] 移动端API status:", apiResp.status, "body前200字:", rawText.substring(0, 200));
          if (rawText.startsWith("{")) {
            const apiData = JSON.parse(rawText);
            const userInfo = apiData?.data?.userInfo;
            if (userInfo) {
              weiboName = userInfo.screen_name || "";
              avatarUrl = userInfo.profile_image_url || "";
              bio = userInfo.description || "";
              console.log("[微博验证] 移动端API获取成功:", weiboName, "简介:", bio);
            }
          }
        } else {
          console.log("[微博验证] 移动端API返回非200:", apiResp.status);
        }
      } catch (e) {
        console.error("[微博验证] 移动端API获取失败:", e.message);
      }
    }

    // 方法2：如果方法1没拿到，尝试PC端页面解析
    if (!bio && !weiboName) {
      try {
        const weiboUrl = `https://weibo.com/u/${uid}`;
        const profileResp = await fetch(weiboUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            Cookie: `SUB=${weiboSubCookie}`,
          },
          redirect: "follow",
          signal: AbortSignal.timeout(10000),
        });

        if (profileResp.ok) {
          const html = await profileResp.text();
          // 从 $render_data 提取
          const renderDataMatch = html.match(/\$render_data\s*=\s*\[([^\]]+)\]/);
          if (renderDataMatch) {
            try {
              const decoded = decodeURIComponent(renderDataMatch[1]);
              const jsonData = JSON.parse(decoded);
              const userInfo = jsonData?.user;
              if (userInfo) {
                weiboName = weiboName || userInfo.screen_name || "";
                avatarUrl = avatarUrl || userInfo.profile_image_url || "";
                bio = bio || userInfo.description || "";
              }
            } catch (e) { /* 解析失败 */ }
          }
          if (!bio) {
            const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
            if (descMatch) bio = descMatch[1];
          }
          if (!weiboName) {
            const nameMatch = html.match(/<title>([^<]*)的微博<\/title>/);
            if (nameMatch) weiboName = nameMatch[1];
          }
        }
      } catch (e) {
        console.error("微博PC端页面获取失败:", e.message);
      }
    }

    // 检查简介中是否包含验证码
    const bioMatch = bio.toUpperCase().includes(expectedCode.toUpperCase());

    // 检查超话等级 - 通过PC端 API
    const chaohuaId = "1008085cf0862440cd3b74d986d8f0618870e0";
    try {
      // 方法1：PC端查用户是否关注该超话
      const chaohuaApiUrl = `https://weibo.com/ajax/profile/topicContent?tabid=1008085cf0862440cd3b74d986d8f0618870e0&uid=${uid}`;
      console.log("[微博验证] 尝试PC端超话API:", chaohuaApiUrl);
      const chaohuaResp = await fetch(chaohuaApiUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120",
          Accept: "application/json, text/plain, */*",
          Cookie: `SUB=${weiboSubCookie}`,
          Referer: `https://weibo.com/p/${chaohuaId}`,
        },
        signal: AbortSignal.timeout(10000),
      });

      if (chaohuaResp.ok) {
        const rawText = await chaohuaResp.text();
        console.log("[微博验证] 超话API status:", chaohuaResp.status, "body前300字:", rawText.substring(0, 300));
        if (rawText.startsWith("{")) {
          const chaohuaData = JSON.parse(rawText);
          // 检查是否返回了有效数据
          if (chaohuaData?.ok === 1 || chaohuaData?.data) {
            isCPFan = true;
            // 尝试提取等级
            const level = chaohuaData?.data?.level || chaohuaData?.data?.badge_level;
            if (level) chaohuaLevel = parseInt(level);
          }
        }
      }

      // 方法2：如果方法1没拿到，用移动端API查用户超话列表
      if (!isCPFan && weiboSubCookie) {
        try {
          const userChaohuaUrl = `https://m.weibo.cn/api/container/getIndex?containerid=100505${uid}_-_chaohua`;
          console.log("[微博验证] 尝试移动端用户超话列表:", userChaohuaUrl);
          const ucResp = await fetch(userChaohuaUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
              Accept: "application/json, text/plain, */*",
              Cookie: `SUB=${weiboSubCookie}`,
              Referer: `https://m.weibo.cn/u/${uid}`,
            },
            signal: AbortSignal.timeout(8000),
          });
          if (ucResp.ok) {
            const ucText = await ucResp.text();
            if (ucText.startsWith("{")) {
              const ucData = JSON.parse(ucText);
              const cards = ucData?.data?.cards || [];
              for (const card of cards) {
                const cardGroup = card?.card_group || [];
                for (const item of cardGroup) {
                  const titleSub = item?.title_sub || "";
                  const itemId = item?.scheme?.match(/100808([a-f0-9]+)/)?.[0] || "";
                  // 匹配超话名或ID
                  if (titleSub.includes("栩你渝生") || itemId === chaohuaId) {
                    isCPFan = true;
                    const desc = item?.desc || "";
                    const lvMatch = desc.match(/(\d+)/);
                    if (lvMatch) chaohuaLevel = parseInt(lvMatch[1]);
                    break;
                  }
                }
                if (isCPFan) break;
              }
            }
          }
        } catch (e3) {
          console.log("[微博验证] 移动端超话列表获取失败:", e3.message);
        }
      }

      // 方法3：直接查超话成员页（PC端）
      if (!isCPFan) {
        try {
          const memberUrl = `https://weibo.com/p/${chaohuaId}/super_followers?uid=${uid}`;
          console.log("[微博验证] 尝试PC端超话成员页:", memberUrl);
          const memberResp = await fetch(memberUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120",
              Accept: "application/json, text/plain, */*",
              "X-Requested-With": "XMLHttpRequest",
              Cookie: `SUB=${weiboSubCookie}`,
              Referer: `https://weibo.com/p/${chaohuaId}`,
            },
            signal: AbortSignal.timeout(8000),
          });
          if (memberResp.ok) {
            const memberText = await memberResp.text();
            console.log("[微博验证] 成员页前200字:", memberText.substring(0, 200));
            if (memberText.includes(uid)) {
              isCPFan = true;
            }
          }
        } catch (e4) {
          console.log("[微博验证] PC端成员页获取失败:", e4.message);
        }
      }
    } catch (e) {
      console.error("超话检查失败:", e.message);
    }

    res.json({
      bioMatch,
      isCPFan,
      chaohuaLevel,
      weiboName,
      avatarUrl,
    });
  } catch (err) {
    console.error("微博验证失败:", err.message);
    res.status(500).json({
      bioMatch: false,
      isCPFan: false,
      chaohuaLevel: 0,
      weiboName: "",
      avatarUrl: "",
      error: err.message,
    });
  }
});

// SPA 兜底：所有未匹配的非 API 路由返回 index.html
app.get("{*path}", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(__dirname, "mimi_university_new1", "index.html"));
});

app.listen(PORT, () => {
  console.log(`MiMi-Cosmos server running on port ${PORT}`);
});
