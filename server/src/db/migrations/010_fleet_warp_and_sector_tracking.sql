-- 010_fleet_warp_and_sector_tracking.sql
-- Milestone 0.8 Day 36: Fleet Warp Synchronization & Sector Tracking

ALTER TABLE player_fleet ADD COLUMN IF NOT EXISTS current_sector_id INT DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_player_fleet_sector ON player_fleet(account_id, current_sector_id);

