-- Enable UUID extension if not already present (PostgreSQL < 13 fallback, built-in in >= 13)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table (Global accounts similar to Discord)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Servers / Workspaces Table
CREATE TABLE IF NOT EXISTS servers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    owner_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Server Members Table (Mapping Users to Servers with Roles)
CREATE TABLE IF NOT EXISTS server_members (
    server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'member', -- 'owner', 'admin', 'member'
    PRIMARY KEY (server_id, user_id)
);

-- 4. Channels Table (Text or Voice channels within a Server)
CREATE TABLE IF NOT EXISTS channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL DEFAULT 'text', -- 'text', 'voice'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Messages Table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
    server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Friends Table
CREATE TABLE IF NOT EXISTS friends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    friend_id UUID REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'accepted', -- 'accepted', 'pending', 'blocked'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, friend_id)
);

-- 7. Direct Messages (DM List) Table
CREATE TABLE IF NOT EXISTS user_dms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    dm_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, dm_user_id)
);

-- 8. Activities Table
CREATE TABLE IF NOT EXISTS activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) DEFAULT 'playing', -- 'playing', 'listening', 'streaming'
    details VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexing for Optimization
-- Index to optimize querying message history filtered by server and channel (with order by created_at DESC)
CREATE INDEX IF NOT EXISTS idx_messages_server_channel ON messages(server_id, channel_id, created_at DESC);

-- Index to optimize fetching channels of a server
CREATE INDEX IF NOT EXISTS idx_channels_server ON channels(server_id);

-- Index to optimize finding what servers a user belongs to
CREATE INDEX IF NOT EXISTS idx_server_members_user ON server_members(user_id);

-- Seed Default Users for friends list (similar to DUMMY_FRIENDS)
INSERT INTO users (id, username, email, password_hash) VALUES
('11111111-1111-1111-1111-111111111111', 'Alex Mercer', 'alex@antigroup.com', '$2a$10$fakehash1'),
('22222222-2222-2222-2222-222222222222', 'Sarah Connor', 'sarah@antigroup.com', '$2a$10$fakehash2'),
('33333333-3333-3333-3333-333333333333', 'Bruce Wayne', 'bruce@antigroup.com', '$2a$10$fakehash3'),
('44444444-4444-4444-4444-444444444444', 'Peter Parker', 'peter@antigroup.com', '$2a$10$fakehash4'),
('55555555-5555-5555-5555-555555555555', 'Viet Nguyen', 'viet@antigroup.com', '$2a$10$fakehash5')
ON CONFLICT (id) DO NOTHING;

-- Seed Default Activities for these users
INSERT INTO activities (id, user_id, name, type, details) VALUES
('a1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'League of Legends', 'playing', 'In a match - 24m'),
('a2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Spotify', 'listening', 'The Terminator Theme'),
('a3333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', 'VS Code', 'playing', 'Debugging Batcomputer'),
('a4444444-4444-4444-4444-444444444444', '44444444-4444-4444-4444-444444444444', 'Daily Bugle App', 'playing', 'Reading News')
ON CONFLICT (id) DO NOTHING;

-- Add server profile columns to server_members table
ALTER TABLE server_members ADD COLUMN IF NOT EXISTS nickname VARCHAR(50);
ALTER TABLE server_members ADD COLUMN IF NOT EXISTS avatar VARCHAR(255);
ALTER TABLE server_members ADD COLUMN IF NOT EXISTS about_me VARCHAR(190);

-- Add user profile columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS about_me VARCHAR(190);
ALTER TABLE users ADD COLUMN IF NOT EXISTS banner_color VARCHAR(30) DEFAULT '#5865F2';
ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_status VARCHAR(100);

-- Ensure password_hash can be null for Google OAuth users
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
