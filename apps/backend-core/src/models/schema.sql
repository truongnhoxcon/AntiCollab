-- Enable UUID extension if not already present (PostgreSQL < 13 fallback, built-in in >= 13)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table (Global accounts similar to Discord)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
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

-- Indexing for Optimization
-- Index to optimize querying message history filtered by server and channel (with order by created_at DESC)
CREATE INDEX IF NOT EXISTS idx_messages_server_channel ON messages(server_id, channel_id, created_at DESC);

-- Index to optimize fetching channels of a server
CREATE INDEX IF NOT EXISTS idx_channels_server ON channels(server_id);

-- Index to optimize finding what servers a user belongs to
CREATE INDEX IF NOT EXISTS idx_server_members_user ON server_members(user_id);
