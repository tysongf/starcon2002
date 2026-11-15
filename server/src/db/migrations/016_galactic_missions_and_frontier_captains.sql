-- 016_galactic_missions_and_frontier_captains.sql
-- Milestone 1.1: Galactic Mission Board & Procedural Frontier Alien Captains

CREATE TABLE IF NOT EXISTS galactic_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id VARCHAR(64) NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  board_sector_id INT NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  source_type VARCHAR(24) NOT NULL DEFAULT 'BOARD', -- 'BOARD' | 'CAPTAIN_RUMOR' | 'STORY_CHAIN'
  mission_type VARCHAR(32) NOT NULL, -- 'XENOBIOLOGY_SURVEY' | 'PLANET_RECON' | 'WRECK_RECOVERY' | 'SYNDICATE_BOUNTY'
  issuer_faction_id VARCHAR(32) NOT NULL, -- 'FACTION_SOL' | 'FACTION_HEGEMONY' | 'FACTION_PHORID' | 'FACTION_KRYLL' | 'FACTION_LITHOS'
  giver_name VARCHAR(128) NOT NULL,
  title VARCHAR(160) NOT NULL,
  briefing TEXT NOT NULL,

  -- Target anchoring across the 60-sector / 196-planet universe
  target_sector_id INT NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  target_planet_id VARCHAR(64) REFERENCES planets(id) ON DELETE SET NULL,
  target_metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  progress_json JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Multi-step Story Chain tracking
  chain_id UUID DEFAULT NULL,
  chain_stage INT NOT NULL DEFAULT 1,
  chain_total_stages INT NOT NULL DEFAULT 1,
  story_branch VARCHAR(32) DEFAULT NULL,

  -- Urgency & Expiration
  is_urgent BOOLEAN NOT NULL DEFAULT FALSE,
  urgent_expires_at TIMESTAMPTZ DEFAULT NULL,
  board_expires_at TIMESTAMPTZ NOT NULL,

  -- Payout & Procedural Ship Module Rewards
  reward_credits INT NOT NULL DEFAULT 0,
  reward_standing INT NOT NULL DEFAULT 5,
  reward_module_rarity VARCHAR(16) DEFAULT NULL,
  reward_module_category VARCHAR(32) DEFAULT NULL,
  claimed_reward_json JSONB DEFAULT NULL,

  status VARCHAR(24) NOT NULL DEFAULT 'OFFERED', -- 'OFFERED' | 'ACTIVE' | 'READY_TO_CLAIM' | 'COMPLETED' | 'EXPIRED' | 'ABANDONED'
  accepted_at TIMESTAMPTZ DEFAULT NULL,
  completed_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_galactic_missions_account_status
  ON galactic_missions(account_id, status);

CREATE INDEX IF NOT EXISTS idx_galactic_missions_board
  ON galactic_missions(account_id, board_sector_id, status);

CREATE TABLE IF NOT EXISTS frontier_captain_encounters (
  account_id VARCHAR(64) NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  captain_key VARCHAR(96) NOT NULL,
  sector_id INT NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  faction_id VARCHAR(32) NOT NULL,
  current_node_id VARCHAR(64) NOT NULL DEFAULT 'GREETING',
  flags_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  rumor_mission_id UUID REFERENCES galactic_missions(id) ON DELETE SET NULL,
  history_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_hailed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, captain_key)
);

CREATE INDEX IF NOT EXISTS idx_frontier_captains_sector
  ON frontier_captain_encounters(account_id, sector_id);

