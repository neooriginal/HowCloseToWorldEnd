-- Supabase initialization script
-- Run this in your Supabase SQL editor to set up the database

-- Create history table
CREATE TABLE IF NOT EXISTS history (
    id SERIAL PRIMARY KEY,
    news TEXT,
    worldend INTEGER,
    reasoning TEXT,
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on date for better query performance
CREATE INDEX IF NOT EXISTS idx_history_date ON history(date);

-- Create daily_summaries table
CREATE TABLE IF NOT EXISTS daily_summaries (
    id SERIAL PRIMARY KEY,
    date DATE UNIQUE,
    key_events TEXT,
    overall_impact TEXT,
    average_worldend DECIMAL(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on date for better query performance
CREATE INDEX IF NOT EXISTS idx_daily_summaries_date ON daily_summaries(date);

-- Enable Row Level Security (RLS) for better security
ALTER TABLE history ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_summaries ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access (adjust as needed for your security requirements)
CREATE POLICY "Allow public read access on history" ON history
    FOR SELECT USING (true);

CREATE POLICY "Allow public read access on daily_summaries" ON daily_summaries
    FOR SELECT USING (true);

-- Create policies for insert/update (you may want to restrict this to authenticated users)
CREATE POLICY "Allow public insert on history" ON history
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public insert on daily_summaries" ON daily_summaries
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update on daily_summaries" ON daily_summaries
    FOR UPDATE USING (true); 