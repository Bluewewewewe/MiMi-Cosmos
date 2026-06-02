-- 迷迷宇宙粉丝门禁系统 - 数据库表结构
-- 在Supabase SQL Editor中执行

-- 用户表
CREATE TABLE IF NOT EXISTS mimi_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  weibo_uid TEXT UNIQUE NOT NULL,
  weibo_name TEXT,
  weibo_avatar_url TEXT,
  chaohua_level INTEGER DEFAULT 0,
  quiz_passed BOOLEAN DEFAULT FALSE,
  token TEXT,
  token_expires_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active',
  frozen_reason TEXT,
  last_chaohua_check TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW()
);

-- 验证码记录表
CREATE TABLE IF NOT EXISTS verify_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  weibo_uid TEXT NOT NULL,
  code TEXT NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- 答题记录表
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  weibo_uid TEXT,
  questions TEXT[],
  answers TEXT[],
  passed BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 启用RLS
ALTER TABLE mimi_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE verify_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;

-- 允许匿名插入用户（注册）
CREATE POLICY "Allow anonymous insert" ON mimi_users FOR INSERT WITH CHECK (true);
-- 允许匿名查询自己的记录
CREATE POLICY "Allow anonymous select" ON mimi_users FOR SELECT USING (true);
-- 允许匿名更新（token续期）
CREATE POLICY "Allow anonymous update" ON mimi_users FOR UPDATE USING (true);
-- 验证码表
CREATE POLICY "Allow anonymous insert codes" ON verify_codes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous select codes" ON verify_codes FOR SELECT USING (true);
-- 答题记录表
CREATE POLICY "Allow anonymous insert attempts" ON quiz_attempts FOR INSERT WITH CHECK (true);

-- 索引
CREATE INDEX IF NOT EXISTS idx_mimi_users_uid ON mimi_users(weibo_uid);
CREATE INDEX IF NOT EXISTS idx_mimi_users_status ON mimi_users(status);
CREATE INDEX IF NOT EXISTS idx_verify_codes_uid ON verify_codes(weibo_uid);
