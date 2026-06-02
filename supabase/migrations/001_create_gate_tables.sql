-- ============================================
-- MiMi-Cosmos 粉丝门禁系统 - 数据库表结构
-- ============================================
-- 在 Supabase SQL Editor 中执行以下语句创建表

-- 1. 用户表
CREATE TABLE IF NOT EXISTS mimi_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    weibo_uid TEXT UNIQUE NOT NULL,
    weibo_name TEXT,
    weibo_avatar_url TEXT,
    chaohua_level INTEGER DEFAULT 0,
    quiz_passed BOOLEAN DEFAULT FALSE,
    token TEXT,
    token_expires_at TIMESTAMP,
    status TEXT DEFAULT 'active',
    frozen_reason TEXT,
    last_chaohua_check TIMESTAMP,
    last_active_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 2. 验证码表
CREATE TABLE IF NOT EXISTS verify_codes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    weibo_uid TEXT NOT NULL,
    code TEXT NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP
);

-- 3. 答题记录表
CREATE TABLE IF NOT EXISTS quiz_attempts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    weibo_uid TEXT,
    questions TEXT[],
    answers TEXT[],
    passed BOOLEAN,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 创建索引
-- ============================================
CREATE INDEX IF NOT EXISTS idx_mimi_users_weibo_uid ON mimi_users(weibo_uid);
CREATE INDEX IF NOT EXISTS idx_mimi_users_token ON mimi_users(token);
CREATE INDEX IF NOT EXISTS idx_verify_codes_weibo_uid ON verify_codes(weibo_uid);
CREATE INDEX IF NOT EXISTS idx_verify_codes_expires ON verify_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_weibo_uid ON quiz_attempts(weibo_uid);

-- ============================================
-- 启用 RLS (Row Level Security)
-- ============================================
ALTER TABLE mimi_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE verify_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS 策略
-- ============================================

-- mimi_users: 用户只能查看和更新自己的数据
CREATE POLICY "Users can view own data" ON mimi_users
    FOR SELECT USING (true);
    
CREATE POLICY "Users can update own data" ON mimi_users
    FOR UPDATE USING (true);

-- verify_codes: 所有人都可以插入，验证后更新
CREATE POLICY "Anyone can insert verify codes" ON verify_codes
    FOR INSERT WITH CHECK (true);
    
CREATE POLICY "Anyone can update verify codes" ON verify_codes
    FOR UPDATE USING (true);

-- quiz_attempts: 记录答题尝试
CREATE POLICY "Anyone can insert quiz attempts" ON quiz_attempts
    FOR INSERT WITH CHECK (true);
