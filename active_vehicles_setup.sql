-- ═══════════════════════════════════════════════════════════════════
-- ClearPath — active_vehicles table for real-time vehicle tracking
-- Run this SQL in Supabase SQL Editor BEFORE testing Parts 3–4
-- ═══════════════════════════════════════════════════════════════════

-- 1. Create the active_vehicles table
CREATE TABLE IF NOT EXISTS active_vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispatch_id UUID REFERENCES dispatches(id) ON DELETE CASCADE,
    car_id TEXT NOT NULL,
    lat FLOAT NOT NULL,
    lng FLOAT NOT NULL,
    on_route BOOLEAN DEFAULT false,
    is_nearest BOOLEAN DEFAULT false,
    has_cleared BOOLEAN DEFAULT false,
    last_updated TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable real-time on active_vehicles (idempotent check)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'active_vehicles'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE active_vehicles;
    END IF;
END $$;

-- 3. Disable Row Level Security (for demo purposes)
ALTER TABLE active_vehicles DISABLE ROW LEVEL SECURITY;

-- 4. Grant access to anon and authenticated roles
GRANT ALL ON TABLE active_vehicles TO anon;
GRANT ALL ON TABLE active_vehicles TO authenticated;
