-- Supabase initialization script
-- Run this in your Supabase SQL editor to set up the database

-- Drop existing tables if they exist
DROP TABLE IF EXISTS daily_summaries CASCADE;
DROP TABLE IF EXISTS history CASCADE;

-- Create countries table
CREATE TABLE IF NOT EXISTS countries (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    iso_code VARCHAR(3) NOT NULL UNIQUE,
    continent VARCHAR(100),
    region VARCHAR(100),
    current_risk_level INTEGER DEFAULT 0 CHECK (current_risk_level >= 0 AND current_risk_level <= 100),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create conflicts table
CREATE TABLE IF NOT EXISTS conflicts (
    id SERIAL PRIMARY KEY,
    country_id INTEGER REFERENCES countries(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    severity INTEGER CHECK (severity >= 1 AND severity <= 10),
    conflict_type VARCHAR(100), -- 'war', 'political_unrest', 'economic', 'natural_disaster', 'terrorist', etc.
    start_date DATE,
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'resolved', 'escalating', 'de-escalating'
    source_url TEXT,
    ai_analysis TEXT,
    risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create global_analysis table for overall world state
CREATE TABLE IF NOT EXISTS global_analysis (
    id SERIAL PRIMARY KEY,
    overall_risk_level INTEGER CHECK (overall_risk_level >= 0 AND overall_risk_level <= 100),
    active_conflicts_count INTEGER DEFAULT 0,
    high_risk_countries_count INTEGER DEFAULT 0,
    news_summary TEXT,
    ai_reasoning TEXT,
    key_events TEXT[],
    trend_direction VARCHAR(20), -- 'increasing', 'decreasing', 'stable'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create regional_summaries table
CREATE TABLE IF NOT EXISTS regional_summaries (
    id SERIAL PRIMARY KEY,
    region VARCHAR(100) NOT NULL,
    risk_level INTEGER CHECK (risk_level >= 0 AND risk_level <= 100),
    active_conflicts INTEGER DEFAULT 0,
    summary TEXT,
    key_countries TEXT[],
    date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(region, date)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_countries_risk_level ON countries(current_risk_level);
CREATE INDEX IF NOT EXISTS idx_countries_iso_code ON countries(iso_code);
CREATE INDEX IF NOT EXISTS idx_conflicts_country_id ON conflicts(country_id);
CREATE INDEX IF NOT EXISTS idx_conflicts_severity ON conflicts(severity);
CREATE INDEX IF NOT EXISTS idx_conflicts_status ON conflicts(status);
CREATE INDEX IF NOT EXISTS idx_conflicts_created_at ON conflicts(created_at);
CREATE INDEX IF NOT EXISTS idx_global_analysis_created_at ON global_analysis(created_at);
CREATE INDEX IF NOT EXISTS idx_regional_summaries_date ON regional_summaries(date);
CREATE INDEX IF NOT EXISTS idx_regional_summaries_region ON regional_summaries(region);

-- Enable Row Level Security (RLS) for better security
ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE regional_summaries ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access
CREATE POLICY "Allow public read access on countries" ON countries
    FOR SELECT USING (true);

CREATE POLICY "Allow public read access on conflicts" ON conflicts
    FOR SELECT USING (true);

CREATE POLICY "Allow public read access on global_analysis" ON global_analysis
    FOR SELECT USING (true);

CREATE POLICY "Allow public read access on regional_summaries" ON regional_summaries
    FOR SELECT USING (true);

-- Create policies for insert/update (you may want to restrict this to authenticated users)
CREATE POLICY "Allow public insert on countries" ON countries
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update on countries" ON countries
    FOR UPDATE USING (true);

CREATE POLICY "Allow public insert on conflicts" ON conflicts
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update on conflicts" ON conflicts
    FOR UPDATE USING (true);

CREATE POLICY "Allow public insert on global_analysis" ON global_analysis
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public insert on regional_summaries" ON regional_summaries
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update on regional_summaries" ON regional_summaries
    FOR UPDATE USING (true);

-- Insert initial country data (sample of major countries)
INSERT INTO countries (name, iso_code, continent, region, current_risk_level) VALUES
('United States', 'USA', 'North America', 'Northern America', 25),
('China', 'CHN', 'Asia', 'Eastern Asia', 35),
('Russia', 'RUS', 'Europe', 'Eastern Europe', 75),
('India', 'IND', 'Asia', 'Southern Asia', 45),
('United Kingdom', 'GBR', 'Europe', 'Northern Europe', 20),
('France', 'FRA', 'Europe', 'Western Europe', 30),
('Germany', 'DEU', 'Europe', 'Western Europe', 15),
('Japan', 'JPN', 'Asia', 'Eastern Asia', 20),
('Brazil', 'BRA', 'South America', 'South America', 40),
('Canada', 'CAN', 'North America', 'Northern America', 10),
('Australia', 'AUS', 'Oceania', 'Australia and New Zealand', 15),
('South Korea', 'KOR', 'Asia', 'Eastern Asia', 50),
('Italy', 'ITA', 'Europe', 'Southern Europe', 25),
('Spain', 'ESP', 'Europe', 'Southern Europe', 20),
('Mexico', 'MEX', 'North America', 'Central America', 55),
('Turkey', 'TUR', 'Asia', 'Western Asia', 65),
('Iran', 'IRN', 'Asia', 'Southern Asia', 80),
('Saudi Arabia', 'SAU', 'Asia', 'Western Asia', 60),
('Israel', 'ISR', 'Asia', 'Western Asia', 85),
('Pakistan', 'PAK', 'Asia', 'Southern Asia', 70),
('Afghanistan', 'AFG', 'Asia', 'Southern Asia', 95),
('Ukraine', 'UKR', 'Europe', 'Eastern Europe', 90),
('Iraq', 'IRQ', 'Asia', 'Western Asia', 85),
('Syria', 'SYR', 'Asia', 'Western Asia', 90),
('North Korea', 'PRK', 'Asia', 'Eastern Asia', 85),
('Venezuela', 'VEN', 'South America', 'South America', 75),
('Nigeria', 'NGA', 'Africa', 'Western Africa', 70),
('South Africa', 'ZAF', 'Africa', 'Southern Africa', 45),
('Egypt', 'EGY', 'Africa', 'Northern Africa', 60),
('Ethiopia', 'ETH', 'Africa', 'Eastern Africa', 65)
ON CONFLICT (iso_code) DO UPDATE SET
    current_risk_level = EXCLUDED.current_risk_level,
    last_updated = NOW();

-- Add some initial conflicts for demonstration
INSERT INTO conflicts (country_id, title, description, severity, conflict_type, risk_score, status) 
SELECT c.id, 'Ongoing Military Operations', 'Active military conflict affecting regional stability', 9, 'war', 90, 'active' 
FROM countries c WHERE c.iso_code = 'UKR'
UNION ALL
SELECT c.id, 'Regional Security Tensions', 'Ongoing tensions affecting Middle East stability', 8, 'political_unrest', 85, 'active'
FROM countries c WHERE c.iso_code = 'ISR'
UNION ALL  
SELECT c.id, 'Internal Political Crisis', 'Ongoing political instability and governance issues', 9, 'political_unrest', 95, 'active'
FROM countries c WHERE c.iso_code = 'AFG'
UNION ALL
SELECT c.id, 'Economic Sanctions Impact', 'International sanctions affecting economy and stability', 7, 'economic', 75, 'active'
FROM countries c WHERE c.iso_code = 'RUS'
UNION ALL
SELECT c.id, 'Regional Nuclear Concerns', 'Nuclear program developments affecting regional security', 8, 'diplomatic', 85, 'active'
FROM countries c WHERE c.iso_code = 'PRK';

-- Add initial global analysis
INSERT INTO global_analysis (overall_risk_level, active_conflicts_count, high_risk_countries_count, news_summary, ai_reasoning, key_events, trend_direction)
VALUES (
    68,
    15,
    8,
    'Global tensions remain elevated with ongoing conflicts in Eastern Europe and Middle East. Several regions show concerning stability trends.',
    'Risk assessment based on active military conflicts, political instability, economic sanctions, and regional security concerns. Higher risk countries show multiple overlapping threat factors.',
    ARRAY['Ukraine conflict continuation', 'Middle East tensions', 'Nuclear program developments', 'Economic sanctions impact', 'Regional political instability'],
    'stable'
); 