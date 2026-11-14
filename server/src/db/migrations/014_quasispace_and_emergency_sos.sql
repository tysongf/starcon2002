-- 014_quasispace_and_emergency_sos.sql
-- Milestone 0.9 Day 40: Precursor Quasi-Space Slipstream & Emergency SOS Transponder

-- 1. Add Quasi-Space navigation state to ships table
ALTER TABLE ships
  ADD COLUMN IF NOT EXISTS is_in_quasispace BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS quasispace_x REAL DEFAULT 150.0,
  ADD COLUMN IF NOT EXISTS quasispace_y REAL DEFAULT 150.0;

-- 2. Quasi-Space Precursor Portals Table
CREATE TABLE IF NOT EXISTS quasispace_portals (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  quasispace_x REAL NOT NULL,
  quasispace_y REAL NOT NULL,
  target_hyperspace_x REAL NOT NULL,
  target_hyperspace_y REAL NOT NULL,
  target_sector_id INTEGER REFERENCES sectors(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for spatial portal queries
CREATE INDEX IF NOT EXISTS idx_quasispace_portals_coords 
  ON quasispace_portals(quasispace_x, quasispace_y);

-- 3. Seed Canonical Precursor Portal Gateway Network
INSERT INTO quasispace_portals (id, name, quasispace_x, quasispace_y, target_hyperspace_x, target_hyperspace_y, target_sector_id, description)
VALUES
  ('portal_alpha_sol', 'Portal Alpha (Sol-Perimeter Nexus)', 150.0, 150.0, 500.0, 500.0, 1, 'Precursor exit meridian connecting to the Sol Alliance core sovereign airspace.'),
  ('portal_beta_vault', 'Portal Beta (Precursor Vault)', 145.0, 275.0, 480.0, 920.0, 53, 'Ancient gateway opening near the deep southern Precursor Vault of Zeta Draconis.'),
  ('portal_gamma_vaelic', 'Portal Gamma (Vaelic Hegemony Core)', 108.0, 102.0, 360.0, 340.0, 4, 'Covert precursor rift breaching deep behind Imperial Hegemony border defenses.'),
  ('portal_delta_kryll', 'Portal Delta (Kryll Freebooter Rim)', 204.0, 171.0, 680.0, 570.0, 6, 'Exit portal situated in the lawless asteroid cluster of the Kryll scrap syndicate.'),
  ('portal_epsilon_lithos', 'Portal Epsilon (Lithos Sovereign Spire)', 195.0, 120.0, 650.0, 400.0, 8, 'Resonant crystalline aperture aligned with the silicon spires of the Lithos Axiom.'),
  ('portal_zeta_phorid', 'Portal Zeta (Phorid Swarm Cluster)', 120.0, 189.0, 400.0, 630.0, 7, 'Subspace rift exiting into the bio-organic aerosol cloud of the Phorid Swarm.'),
  ('portal_eta_sirius', 'Portal Eta (Sirius Binary Crossroads)', 156.0, 144.0, 520.0, 480.0, 2, 'Transit node exiting near Sirius Binary at the edge of the Void Expanse.'),
  ('portal_theta_rim', 'Portal Theta (Deep Void Fringe)', 250.0, 250.0, 830.0, 830.0, 49, 'Remote gateway projecting vessels into the unexplored far rim of the galactic plane.')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  quasispace_x = EXCLUDED.quasispace_x,
  quasispace_y = EXCLUDED.quasispace_y,
  target_hyperspace_x = EXCLUDED.target_hyperspace_x,
  target_hyperspace_y = EXCLUDED.target_hyperspace_y,
  target_sector_id = EXCLUDED.target_sector_id,
  description = EXCLUDED.description;

