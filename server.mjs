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
const supabaseUrl = process.env.COZE_SUPABASE_URL;
const supabaseKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error("Missing COZE_SUPABASE_URL or COZE_SUPABASE_SERVICE_ROLE_KEY");
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

// ==================== 用户 API ====================

// 创建用户
app.post("/api/users", async (req, res) => {
  try {
    const { weibo_uid, weibo_name, avatar_url, chaohua_level } = req.body;
    if (!weibo_uid) return res.status(400).json({ error: "缺少微博UID" });

    // 查找已有用户
    const { data: existing } = await supabase
      .from("users")
      .select("*")
      .eq("weibo_uid", String(weibo_uid))
      .single();

    if (existing) {
      // 更新登录时间
      await supabase
        .from("users")
        .update({ updated_at: new Date().toISOString(), weibo_name: weibo_name || existing.weibo_name })
        .eq("id", existing.id);
      return res.json({ user: existing });
    }

    // 创建新用户
    const { data, error } = await supabase
      .from("users")
      .insert({
        weibo_uid: String(weibo_uid),
        weibo_name: weibo_name || `用户${weibo_uid}`,
        avatar_url: avatar_url || "",
        id: String(weibo_uid),
        chaohua_level: chaohua_level || 0,
        is_admin: false,
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ user: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 用户登录
app.post("/api/users/login", async (req, res) => {
  try {
    const { weibo_uid, weibo_name, avatar_url, chaohua_level } = req.body;
    if (!weibo_uid) return res.status(400).json({ error: "缺少微博UID" });

    const { data: existing } = await supabase
      .from("users")
      .select("*")
      .eq("weibo_uid", String(weibo_uid))
      .single();

    if (existing) {
      const { data } = await supabase
        .from("users")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .select()
        .single();
      return res.json({ success: true, user: data });
    }

    const { data, error } = await supabase
      .from("users")
      .insert({
        id: String(weibo_uid),
        weibo_uid: String(weibo_uid),
        weibo_name: weibo_name || "米米同学",
        avatar_url: avatar_url || "",
        chaohua_level: chaohua_level || 0,
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, user: data });
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

// ==================== 微博验证 API ====================
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
    const weiboSubCookie = process.env.WEIBO_SUB_COOKIE || "_2A25HJecSDeRhGe9O71sW9ijEzzWIHXVkW2barDV8PUJbkNAYLU_akW1NdNCJh4OrnUD91cvFXT4ZihGg2QSUBQmS";
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

    // 检查超话等级 - 通过移动端 API
    const chaohuaId = "1008085cf0862440cd3b74d986d8f0618870e0";
    try {
      // 查用户是否关注了该超话及等级
      const chaohuaApiUrl = `https://m.weibo.cn/api/container/getIndex?containerid=1008085cf0862440cd3b74d986d8f0618870e0_-_followers&page_type=pageuser&luicode=10000011&lfid=${uid}`;
      const chaohuaResp = await fetch(chaohuaApiUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
          Accept: "application/json, text/plain, */*",
          Cookie: `SUB=${weiboSubCookie}`,
          Referer: `https://m.weibo.cn/p/${chaohuaId}`,
        },
        signal: AbortSignal.timeout(10000),
      });

      if (chaohuaResp.ok) {
        const chaohuaData = await chaohuaResp.json();
        const cards = chaohuaData?.data?.cards || [];
        for (const card of cards) {
          const userCard = card?.user;
          if (userCard && String(userCard.id) === String(uid)) {
            isCPFan = true;
            // 尝试从 card_group 提取等级
            const levelBadge = card?.desc || "";
            const levelMatch = levelBadge.match(/(\d+)/);
            if (levelMatch) chaohuaLevel = parseInt(levelMatch[1]);
            break;
          }
        }
        // 如果第一页没找到，也标记为可能关注（可能在后面的页）
        if (!isCPFan && cards.length > 0) {
          // 尝试直接查用户超话关系
          try {
            const checkUrl = `https://m.weibo.cn/api/container/getIndex?containerid=1008085cf0862440cd3b74d986d8f0618870e0_-_member_${uid}`;
            const checkResp = await fetch(checkUrl, {
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
                Cookie: `SUB=${weiboSubCookie}`,
              },
              signal: AbortSignal.timeout(8000),
            });
            if (checkResp.ok) {
              const checkData = await checkResp.json();
              if (checkData?.data) {
                isCPFan = true;
                const lvl = checkData.data.level || checkData.data.badge_level;
                if (lvl) chaohuaLevel = parseInt(lvl);
              }
            }
          } catch (e2) { /* 忽略 */ }
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
