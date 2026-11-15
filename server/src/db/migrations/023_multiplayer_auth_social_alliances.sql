-- 023_multiplayer_auth_social_alliances.sql
-- Milestone 1.8: Shared Multiplayer Galaxy, Strict Auth, Squadrons (<=12),
-- Peer-to-Peer Alliances with Granular Per-Ally & Per-Colony Grants, Chat, P2P Trade & Duels

-- 1. Account Auth & Presence Extensions
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS password_hash TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS role VARCHAR(32) NOT NULL DEFAULT 'CAPTAIN',
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS online_status VARCHAR(16) NOT NULL DEFAULT 'OFFLINE';

-- 2. System Settings (persisted HMAC signing secret across server restarts)
CREATE TABLE IF NOT EXISTS system_settings (
  key VARCHAR(64) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Authenticated Bearer Sessions
CREATE TABLE IF NOT EXISTS auth_sessions (
  id VARCHAR(80) PRIMARY KEY,
  account_id VARCHAR(64) NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  token_hash VARCHAR(128) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_account ON auth_sessions(account_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_token_hash ON auth_sessions(token_hash);

-- 4. Persisted Live Comms Channels (GALAXY / SECTOR / SQUAD / ALLIES / WHISPER)
CREATE TABLE IF NOT EXISTS chat_messages (
  id VARCHAR(80) PRIMARY KEY,
  channel_type VARCHAR(24) NOT NULL,
  channel_id VARCHAR(80) DEFAULT NULL,
  sender_id VARCHAR(64) NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  sender_callsign VARCHAR(64) NOT NULL,
  target_account_id VARCHAR(64) DEFAULT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_channel ON chat_messages(channel_type, channel_id, created_at DESC);

-- 5. Co-op Squadrons (Parties up to 12 captains)
CREATE TABLE IF NOT EXISTS squadrons (
  id VARCHAR(80) PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  leader_id VARCHAR(64) NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS squadron_members (
  squadron_id VARCHAR(80) NOT NULL REFERENCES squadrons(id) ON DELETE CASCADE,
  account_id VARCHAR(64) PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  role VARCHAR(24) NOT NULL DEFAULT 'MEMBER', -- 'LEADER' | 'MEMBER'
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS squadron_invites (
  id VARCHAR(80) PRIMARY KEY,
  squadron_id VARCHAR(80) NOT NULL REFERENCES squadrons(id) ON DELETE CASCADE,
  inviter_id VARCHAR(64) NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  target_account_id VARCHAR(64) NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  status VARCHAR(24) NOT NULL DEFAULT 'PENDING', -- 'PENDING' | 'ACCEPTED' | 'DECLINED'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Strictly Peer-to-Peer Bilateral Alliances (No Guild Tags / Central Organizations)
CREATE TABLE IF NOT EXISTS alliance_pacts (
  id VARCHAR(80) PRIMARY KEY,
  captain_a_id VARCHAR(64) NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  captain_b_id VARCHAR(64) NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  initiated_by VARCHAR(64) NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  status VARCHAR(24) NOT NULL DEFAULT 'PENDING', -- 'PENDING' | 'ACTIVE' | 'ENDED'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (captain_a_id < captain_b_id),
  UNIQUE (captain_a_id, captain_b_id)
);

CREATE TABLE IF NOT EXISTS alliance_peer_grants (
  pact_id VARCHAR(80) NOT NULL REFERENCES alliance_pacts(id) ON DELETE CASCADE,
  grantor_account_id VARCHAR(64) NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  grantee_account_id VARCHAR(64) NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  friendly_fire_shield BOOLEAN NOT NULL DEFAULT TRUE,
  can_share_intel BOOLEAN NOT NULL DEFAULT TRUE,
  can_view_all_colonies BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (pact_id, grantor_account_id, grantee_account_id)
);

CREATE TABLE IF NOT EXISTS alliance_colony_grants (
  id VARCHAR(80) PRIMARY KEY,
  colony_id VARCHAR(64) NOT NULL REFERENCES colonies(id) ON DELETE CASCADE,
  grantee_account_id VARCHAR(64) NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  granted_by_account_id VARCHAR(64) NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  can_inspect_grid BOOLEAN NOT NULL DEFAULT FALSE,
  can_harvest_silo BOOLEAN NOT NULL DEFAULT FALSE,
  can_build_outpost BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (colony_id, grantee_account_id)
);

-- 7. Atomic P2P Escrow Trades (Credits, Cargo, Procedural Gear & Crew Contracts)
CREATE TABLE IF NOT EXISTS player_trades (
  id VARCHAR(80) PRIMARY KEY,
  initiator_id VARCHAR(64) NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  partner_id VARCHAR(64) NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
  initiator_offer JSONB NOT NULL DEFAULT '{"credits":0,"cargo":[],"inventoryIds":[],"crewIds":[]}'::jsonb,
  partner_offer JSONB NOT NULL DEFAULT '{"credits":0,"cargo":[],"inventoryIds":[],"crewIds":[]}'::jsonb,
  initiator_locked BOOLEAN NOT NULL DEFAULT FALSE,
  partner_locked BOOLEAN NOT NULL DEFAULT FALSE,
  initiator_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  partner_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Consensual Duels (Anywhere, stops at <= 15% hull with auto-repair)
CREATE TABLE IF NOT EXISTS player_duels (
  id VARCHAR(80) PRIMARY KEY,
  sector_id INT NOT NULL,
  challenger_id VARCHAR(64) NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  defender_id VARCHAR(64) NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  wager_credits BIGINT NOT NULL DEFAULT 0 CHECK (wager_credits >= 0),
  status VARCHAR(24) NOT NULL DEFAULT 'PENDING', -- 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'DECLINED' | 'FORFEITED'
  winner_id VARCHAR(64) DEFAULT NULL REFERENCES accounts(id) ON DELETE SET NULL,
  loser_id VARCHAR(64) DEFAULT NULL REFERENCES accounts(id) ON DELETE SET NULL,
  challenger_pre_hull INT NOT NULL DEFAULT 100,
  defender_pre_hull INT NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ DEFAULT NULL
);

