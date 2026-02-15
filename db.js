const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'world-end.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
    }
});

function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function all(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

async function initializeDB() {
    console.log('Initializing SQLite database...');

    await run(`CREATE TABLE IF NOT EXISTS countries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        iso_code TEXT UNIQUE NOT NULL,
        continent TEXT,
        region TEXT,
        current_risk_level INTEGER DEFAULT 0,
        last_updated DATETIME
    )`);

    await run(`CREATE TABLE IF NOT EXISTS conflicts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        country_id INTEGER,
        title TEXT NOT NULL,
        description TEXT,
        severity INTEGER DEFAULT 1,
        conflict_type TEXT,
        start_date DATETIME,
        status TEXT DEFAULT 'active',
        source_url TEXT,
        ai_analysis TEXT,
        risk_score INTEGER DEFAULT 0,
        FOREIGN KEY (country_id) REFERENCES countries (id)
    )`);

    await run(`CREATE TABLE IF NOT EXISTS global_analysis (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        overall_risk_level INTEGER DEFAULT 0,
        active_conflicts_count INTEGER DEFAULT 0,
        high_risk_countries_count INTEGER DEFAULT 0,
        news_summary TEXT,
        ai_reasoning TEXT,
        key_events TEXT, -- JSON string
        trend_direction TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    await run(`CREATE TABLE IF NOT EXISTS regional_summaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        region TEXT NOT NULL,
        risk_level INTEGER DEFAULT 0,
        active_conflicts INTEGER DEFAULT 0,
        summary TEXT,
        key_countries TEXT, -- JSON string
        date DATETIME
    )`);

    console.log('✓ Tables initialized');

    // Seed initial data if empty
    const countryCount = await get('SELECT COUNT(*) as count FROM countries');
    if (countryCount.count === 0) {
        await seedInitialData();
    }
}

async function seedInitialData() {
    console.log('Seeding initial data...');
    const countries = [
        { name: 'United States', iso_code: 'USA', continent: 'North America', region: 'Northern America', current_risk_level: 25 },
        { name: 'China', iso_code: 'CHN', continent: 'Asia', region: 'Eastern Asia', current_risk_level: 35 },
        { name: 'Russia', iso_code: 'RUS', continent: 'Europe', region: 'Eastern Europe', current_risk_level: 75 },
        { name: 'India', iso_code: 'IND', continent: 'Asia', region: 'Southern Asia', current_risk_level: 45 },
        { name: 'United Kingdom', iso_code: 'GBR', continent: 'Europe', region: 'Northern Europe', current_risk_level: 20 },
        { name: 'France', iso_code: 'FRA', continent: 'Europe', region: 'Western Europe', current_risk_level: 30 },
        { name: 'Germany', iso_code: 'DEU', continent: 'Europe', region: 'Western Europe', current_risk_level: 15 },
        { name: 'Japan', iso_code: 'JPN', continent: 'Asia', region: 'Eastern Asia', current_risk_level: 20 },
        { name: 'Brazil', iso_code: 'BRA', continent: 'South America', region: 'South America', current_risk_level: 40 },
        { name: 'Canada', iso_code: 'CAN', continent: 'North America', region: 'Northern America', current_risk_level: 10 },
        { name: 'Ukraine', iso_code: 'UKR', continent: 'Europe', region: 'Eastern Europe', current_risk_level: 90 },
        { name: 'Israel', iso_code: 'ISR', continent: 'Asia', region: 'Western Asia', current_risk_level: 85 },
        { name: 'Afghanistan', iso_code: 'AFG', continent: 'Asia', region: 'Southern Asia', current_risk_level: 95 },
        { name: 'North Korea', iso_code: 'PRK', continent: 'Asia', region: 'Eastern Asia', current_risk_level: 85 }
    ];

    for (const country of countries) {
        await run(
            'INSERT INTO countries (name, iso_code, continent, region, current_risk_level, last_updated) VALUES (?, ?, ?, ?, ?, ?)',
            [country.name, country.iso_code, country.continent, country.region, country.current_risk_level, new Date().toISOString()]
        );
    }

    await run(
        'INSERT INTO global_analysis (overall_risk_level, active_conflicts_count, high_risk_countries_count, news_summary, ai_reasoning, key_events, trend_direction) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [68, 15, 8, 'Global tensions remain elevated with ongoing conflicts in Eastern Europe and Middle East.', 'Risk assessment based on active military conflicts...', JSON.stringify(['Ukraine conflict continuation', 'Middle East tensions']), 'stable']
    );

    console.log('✓ Initial data seeded successfully');
}

module.exports = {
    initializeDB,
    run,
    get,
    all,
    db
};
