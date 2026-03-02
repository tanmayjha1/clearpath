-- =============================================
-- ClearPath Supabase Setup SQL
-- Run this in the Supabase SQL Editor
-- =============================================

-- 1. Create dispatches table
CREATE TABLE IF NOT EXISTS dispatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved')),
  origin_label TEXT NOT NULL,
  origin_lat FLOAT NOT NULL,
  origin_lng FLOAT NOT NULL,
  destination_label TEXT NOT NULL,
  destination_lat FLOAT NOT NULL,
  destination_lng FLOAT NOT NULL,
  road_name TEXT NOT NULL,
  driver_lane TEXT NOT NULL DEFAULT 'right',
  trip_duration_seconds INT NOT NULL DEFAULT 180,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create vehicles table
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  lat FLOAT NOT NULL,
  lng FLOAT NOT NULL,
  on_route BOOLEAN NOT NULL DEFAULT false,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Seed vehicles table with 3 civilian cars
INSERT INTO vehicles (label, lat, lng, on_route)
VALUES
  ('Car A', 1.2920, 103.8150, false),
  ('Car B', 1.2860, 103.8250, false),
  ('Car C', 1.3100, 103.8400, false);

-- 4. Enable Row Level Security (allow all for now — tighten in production)
ALTER TABLE dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read/write for demo (restrict in production)
CREATE POLICY "Allow all on dispatches" ON dispatches
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all on vehicles" ON vehicles
  FOR ALL USING (true) WITH CHECK (true);

-- 5. Enable real-time on dispatches table
ALTER PUBLICATION supabase_realtime ADD TABLE dispatches;
