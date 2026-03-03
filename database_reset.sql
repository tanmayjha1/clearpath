-- ═══════════════════════════════════════════════════════════════════
-- ClearPath — FULL DATABASE RESET
-- Run this in Supabase SQL Editor to clean everything and start fresh
-- ═══════════════════════════════════════════════════════════════════

-- ─── STEP 1: Drop everything ──────────────────────────────────────
DROP TABLE IF EXISTS active_vehicles CASCADE;
DROP TABLE IF EXISTS vehicles CASCADE;
DROP TABLE IF EXISTS dispatches CASCADE;

-- ─── STEP 2: Create dispatches table ──────────────────────────────
CREATE TABLE dispatches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved')),
    origin_label TEXT NOT NULL,
    origin_lat FLOAT NOT NULL,
    origin_lng FLOAT NOT NULL,
    destination_label TEXT NOT NULL,
    destination_lat FLOAT NOT NULL,
    destination_lng FLOAT NOT NULL,
    road_name TEXT NOT NULL DEFAULT 'Route',
    driver_lane TEXT NOT NULL DEFAULT 'right',
    trip_duration_seconds INT NOT NULL DEFAULT 180,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── STEP 3: Create active_vehicles table ─────────────────────────
CREATE TABLE active_vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispatch_id UUID REFERENCES dispatches(id) ON DELETE CASCADE,
    car_id TEXT NOT NULL,
    lat FLOAT NOT NULL,
    lng FLOAT NOT NULL,
    on_route BOOLEAN DEFAULT false,
    is_nearest BOOLEAN DEFAULT false,
    last_updated TIMESTAMPTZ DEFAULT now()
);

-- ─── STEP 4: Disable RLS on both tables (demo mode) ──────────────
ALTER TABLE dispatches DISABLE ROW LEVEL SECURITY;
ALTER TABLE active_vehicles DISABLE ROW LEVEL SECURITY;

-- ─── STEP 5: Grant access ─────────────────────────────────────────
GRANT ALL ON TABLE dispatches TO anon;
GRANT ALL ON TABLE dispatches TO authenticated;
GRANT ALL ON TABLE active_vehicles TO anon;
GRANT ALL ON TABLE active_vehicles TO authenticated;

-- ─── STEP 6: Enable real-time ─────────────────────────────────────
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime DROP TABLE dispatches;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime DROP TABLE active_vehicles;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE dispatches;
ALTER PUBLICATION supabase_realtime ADD TABLE active_vehicles;

-- ─── DONE ─────────────────────────────────────────────────────────
-- Tables are clean and ready. No stale data, no old columns.
