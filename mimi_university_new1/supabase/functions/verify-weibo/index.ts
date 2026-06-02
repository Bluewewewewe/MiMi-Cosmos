// Supabase Edge Function: 验证微博用户主页（简介验证码 + 超话等级）
// Deno runtime

const WEIBO_COOKIE = Deno.env.get("WEIBO_COOKIE") || "";

Deno.serve(async (req: Request) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
      },
    });
  }

  try {
    const { uid, expectedCode } = await req.json();
    if (!uid || !expectedCode) {
      return jsonResponse({ error: "缺少uid或expectedCode" }, 400);
    }

    // 访问微博移动版API获取用户信息
    const weiboUrl = `https://m.weibo.cn/api/container/getIndex?containerid=100505${uid}`;
    const headers: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
      Accept: "application/json",
    };
    if (WEIBO_COOKIE) {
      headers["Cookie"] = WEIBO_COOKIE;
    }

    const resp = await fetch(weiboUrl, { headers });
    const data = await resp.json();

    // 解析用户信息
    const userInfo = data?.data?.userInfo;
    if (!userInfo) {
      // 尝试从HTML页面解析
      return await verifyFromHtml(uid, expectedCode);
    }

    // 简介验证
    const bio: string = userInfo.description || "";
    const bioMatch = bio.includes(expectedCode);

    // 解析超话信息
    let chaohuaLevel = 0;
    let isCPFan = false;

    // 尝试从用户数据中获取超话列表
    const cards = data?.data?.cards || [];
    for (const card of cards) {
      if (card.card_group) {
        for (const item of card.card_group) {
          const title = item?.title_sub || item?.desc || "";
          if (title.includes("栩你渝生")) {
            isCPFan = true;
            // 尝试提取等级
            const levelMatch = (item?.desc || "").match(/Lv\.?(\d+)/i);
            if (levelMatch) chaohuaLevel = parseInt(levelMatch[1]);
          }
        }
      }
      // 直接检查card title
      if ((card.title_sub || "").includes("栩你渝生")) {
        isCPFan = true;
      }
    }

    return jsonResponse({
      bioMatch,
      chaohuaLevel,
      isCPFan,
      weiboName: userInfo.screen_name || "",
      avatarUrl: userInfo.profile_image_url || "",
    });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});

// 备选：从HTML页面解析
async function verifyFromHtml(
  uid: string,
  expectedCode: string
): Promise<Response> {
  const url = `https://m.weibo.cn/u/${uid}`;
  const headers: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
  };
  if (WEIBO_COOKIE) {
    headers["Cookie"] = WEIBO_COOKIE;
  }

  const resp = await fetch(url, { headers });
  const html = await resp.text();

  // 从HTML中提取简介
  const bioMatch2 = html.match(/简介[：:]?\s*([^<"\n]+)/);
  const bio = bioMatch2 ? bioMatch2[1].trim() : "";
  const bioMatch = bio.includes(expectedCode);

  // 从HTML中提取超话信息（简化版）
  const isCPFan = html.includes("栩你渝生");
  let chaohuaLevel = 0;
  const levelMatch = html.match(/栩你渝生[^}]*?Lv\.?(\d+)/i);
  if (levelMatch) chaohuaLevel = parseInt(levelMatch[1]);

  return jsonResponse({
    bioMatch,
    chaohuaLevel,
    isCPFan,
    weiboName: "",
    avatarUrl: "",
    source: "html",
  });
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
