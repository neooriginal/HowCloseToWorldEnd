const { Client, Databases, ID, Permission, Role } = require('node-appwrite');

// Appwrite configuration
const client = new Client();

// Set up client with better error handling
function initializeClient() {
    try {
        const endpoint = process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
        const projectId = process.env.APPWRITE_PROJECT_ID;
        const apiKey = process.env.APPWRITE_API_KEY;

        if (!projectId || !apiKey) {
            throw new Error('Missing required environment variables: APPWRITE_PROJECT_ID and APPWRITE_API_KEY must be set');
        }

        console.log(`Connecting to Appwrite at: ${endpoint}`);
        console.log(`Project ID: ${projectId}`);

        client
            .setEndpoint(endpoint)
            .setProject(projectId)
            .setKey(apiKey);

        return client;
    } catch (error) {
        console.error('Client initialization failed:', error.message);
        throw error;
    }
}

const databases = new Databases(client);

const DATABASE_ID = 'world-conflict-tracker';
const COLLECTIONS = {
    COUNTRIES: 'countries',
    CONFLICTS: 'conflicts', 
    GLOBAL_ANALYSIS: 'global-analysis',
    REGIONAL_SUMMARIES: 'regional-summaries'
};

async function testConnection() {
    console.log('Testing Appwrite connection...');
    try {
        // Test basic database access
        const result = await databases.list();
        console.log('✅ Connection successful!');
        return true;
    } catch (error) {
        console.error('❌ Connection failed:', error.message);
        
        if (error.message.includes('Project with the requested ID could not be found')) {
            console.log('\n🔍 Troubleshooting:');
            console.log('1. Check your project ID in your Appwrite console');
            console.log('2. Verify your endpoint URL is correct');
            console.log('3. Make sure the project exists on your Appwrite server');
        } else if (error.message.includes('Invalid API key')) {
            console.log('\n🔍 API Key troubleshooting:');
            console.log('1. Verify your API key is correct');
            console.log('2. Check API key permissions include databases.read and databases.write');
            console.log('3. Ensure you\'re using a server API key');
        }
        
        throw error;
    }
}

async function initializeAppwriteDatabase() {
    try {
        console.log('Initializing Appwrite database...');

        // Initialize client first
        initializeClient();

        // Test the connection
        await testConnection();

        // Create database
        let database;
        try {
            database = await databases.create(DATABASE_ID, 'World Conflict Tracker DB');
            console.log('✓ Database created');
        } catch (error) {
            if (error.code === 409) {
                console.log('✓ Database already exists');
                database = await databases.get(DATABASE_ID);
            } else {
                throw error;
            }
        }

        // Create collections with error handling and proper delays
        await createCountriesCollection();
        console.log('Waiting for countries collection to be ready...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        await createConflictsCollection();
        console.log('Waiting for conflicts collection to be ready...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        await createGlobalAnalysisCollection();
        console.log('Waiting for global analysis collection to be ready...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        await createRegionalSummariesCollection();
        console.log('Waiting for regional summaries collection to be ready...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        console.log('✓ Appwrite database initialization completed');
        return true;
    } catch (error) {
        console.error('Database initialization failed:', error.message);
        
        // Provide helpful error context
        if (error.message.includes('Project with the requested ID could not be found')) {
            console.log('\n💡 Quick fix options:');
            console.log('1. Double-check your APPWRITE_PROJECT_ID in .env');
            console.log('2. Try switching to Appwrite Cloud: APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1');
            console.log('3. Create a new project in your Appwrite instance');
        }
        
        throw error;
    }
}

async function createCountriesCollection() {
    try {
        await databases.createCollection(
            DATABASE_ID,
            COLLECTIONS.COUNTRIES,
            'Countries',
            [Permission.read(Role.any()), Permission.write(Role.any())],
            false,
            true
        );

        // Create attributes with delays to avoid rate limits
        await databases.createStringAttribute(DATABASE_ID, COLLECTIONS.COUNTRIES, 'name', 255, true);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await databases.createStringAttribute(DATABASE_ID, COLLECTIONS.COUNTRIES, 'iso_code', 3, true);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await databases.createStringAttribute(DATABASE_ID, COLLECTIONS.COUNTRIES, 'continent', 100, false);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await databases.createStringAttribute(DATABASE_ID, COLLECTIONS.COUNTRIES, 'region', 100, false);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await databases.createIntegerAttribute(DATABASE_ID, COLLECTIONS.COUNTRIES, 'current_risk_level', false, null, null, 0);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await databases.createDatetimeAttribute(DATABASE_ID, COLLECTIONS.COUNTRIES, 'last_updated', false);

        // Create indexes with delays
        await new Promise(resolve => setTimeout(resolve, 1000));
        await databases.createIndex(DATABASE_ID, COLLECTIONS.COUNTRIES, 'idx_iso_code', 'unique', ['iso_code']);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await databases.createIndex(DATABASE_ID, COLLECTIONS.COUNTRIES, 'idx_risk_level', 'key', ['current_risk_level']);

        console.log('✓ Countries collection created');
    } catch (error) {
        if (error.code !== 409) throw error;
        console.log('✓ Countries collection already exists');
    }
}

async function createConflictsCollection() {
    try {
        await databases.createCollection(
            DATABASE_ID,
            COLLECTIONS.CONFLICTS,
            'Conflicts',
            [Permission.read(Role.any()), Permission.write(Role.any())],
            false,
            true
        );

        // Create attributes with delays
        await databases.createStringAttribute(DATABASE_ID, COLLECTIONS.CONFLICTS, 'country_id', 36, true);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await databases.createStringAttribute(DATABASE_ID, COLLECTIONS.CONFLICTS, 'title', 500, true);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await databases.createStringAttribute(DATABASE_ID, COLLECTIONS.CONFLICTS, 'description', 5000, false);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await databases.createIntegerAttribute(DATABASE_ID, COLLECTIONS.CONFLICTS, 'severity', false, null, null, 1);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await databases.createEnumAttribute(DATABASE_ID, COLLECTIONS.CONFLICTS, 'conflict_type', ['war', 'political_unrest', 'economic', 'natural_disaster', 'terrorist', 'cyber', 'diplomatic'], false);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await databases.createDatetimeAttribute(DATABASE_ID, COLLECTIONS.CONFLICTS, 'start_date', false);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await databases.createEnumAttribute(DATABASE_ID, COLLECTIONS.CONFLICTS, 'status', ['active', 'resolved', 'escalating', 'de-escalating'], false, 'active');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await databases.createUrlAttribute(DATABASE_ID, COLLECTIONS.CONFLICTS, 'source_url', false);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await databases.createStringAttribute(DATABASE_ID, COLLECTIONS.CONFLICTS, 'ai_analysis', 5000, false);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await databases.createIntegerAttribute(DATABASE_ID, COLLECTIONS.CONFLICTS, 'risk_score', false, null, null, 0);

        // Create indexes
        await new Promise(resolve => setTimeout(resolve, 1000));
        await databases.createIndex(DATABASE_ID, COLLECTIONS.CONFLICTS, 'idx_country_id', 'key', ['country_id']);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await databases.createIndex(DATABASE_ID, COLLECTIONS.CONFLICTS, 'idx_severity', 'key', ['severity']);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await databases.createIndex(DATABASE_ID, COLLECTIONS.CONFLICTS, 'idx_status', 'key', ['status']);

        console.log('✓ Conflicts collection created');
    } catch (error) {
        if (error.code !== 409) throw error;
        console.log('✓ Conflicts collection already exists');
    }
}

async function createGlobalAnalysisCollection() {
    try {
        await databases.createCollection(
            DATABASE_ID,
            COLLECTIONS.GLOBAL_ANALYSIS,
            'Global Analysis',
            [Permission.read(Role.any()), Permission.write(Role.any())],
            false,
            true
        );

        // Create attributes with delays
        await databases.createIntegerAttribute(DATABASE_ID, COLLECTIONS.GLOBAL_ANALYSIS, 'overall_risk_level', false, null, null, 0);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await databases.createIntegerAttribute(DATABASE_ID, COLLECTIONS.GLOBAL_ANALYSIS, 'active_conflicts_count', false, null, null, 0);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await databases.createIntegerAttribute(DATABASE_ID, COLLECTIONS.GLOBAL_ANALYSIS, 'high_risk_countries_count', false, null, null, 0);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await databases.createStringAttribute(DATABASE_ID, COLLECTIONS.GLOBAL_ANALYSIS, 'news_summary', 5000, false);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await databases.createStringAttribute(DATABASE_ID, COLLECTIONS.GLOBAL_ANALYSIS, 'ai_reasoning', 5000, false);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await databases.createStringAttribute(DATABASE_ID, COLLECTIONS.GLOBAL_ANALYSIS, 'key_events', 5000, false, null, true);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await databases.createEnumAttribute(DATABASE_ID, COLLECTIONS.GLOBAL_ANALYSIS, 'trend_direction', ['increasing', 'decreasing', 'stable'], false);

        console.log('✓ Global Analysis collection created');
    } catch (error) {
        if (error.code !== 409) throw error;
        console.log('✓ Global Analysis collection already exists');
    }
}

async function createRegionalSummariesCollection() {
    try {
        await databases.createCollection(
            DATABASE_ID,
            COLLECTIONS.REGIONAL_SUMMARIES,
            'Regional Summaries',
            [Permission.read(Role.any()), Permission.write(Role.any())],
            false,
            true
        );

        // Create attributes with delays
        await databases.createStringAttribute(DATABASE_ID, COLLECTIONS.REGIONAL_SUMMARIES, 'region', 100, true);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await databases.createIntegerAttribute(DATABASE_ID, COLLECTIONS.REGIONAL_SUMMARIES, 'risk_level', false, null, null, 0);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await databases.createIntegerAttribute(DATABASE_ID, COLLECTIONS.REGIONAL_SUMMARIES, 'active_conflicts', false, null, null, 0);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await databases.createStringAttribute(DATABASE_ID, COLLECTIONS.REGIONAL_SUMMARIES, 'summary', 5000, false);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await databases.createStringAttribute(DATABASE_ID, COLLECTIONS.REGIONAL_SUMMARIES, 'key_countries', 1000, false, null, true);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await databases.createDatetimeAttribute(DATABASE_ID, COLLECTIONS.REGIONAL_SUMMARIES, 'date', false);

        // Create indexes
        await new Promise(resolve => setTimeout(resolve, 1000));
        await databases.createIndex(DATABASE_ID, COLLECTIONS.REGIONAL_SUMMARIES, 'idx_region', 'key', ['region']);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await databases.createIndex(DATABASE_ID, COLLECTIONS.REGIONAL_SUMMARIES, 'idx_date', 'key', ['date']);

        console.log('✓ Regional Summaries collection created');
    } catch (error) {
        if (error.code !== 409) throw error;
        console.log('✓ Regional Summaries collection already exists');
    }
}

async function seedInitialData() {
    try {
        console.log('Seeding initial data...');

        // Check if countries already exist
        const existingCountries = await databases.listDocuments(DATABASE_ID, COLLECTIONS.COUNTRIES);
        if (existingCountries.total > 0) {
            console.log('✓ Initial data already exists');
            return;
        }

        // Initial countries data
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
            await databases.createDocument(
                DATABASE_ID,
                COLLECTIONS.COUNTRIES,
                ID.unique(),
                {
                    ...country,
                    last_updated: new Date().toISOString()
                }
            );
            // Small delay to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Add initial global analysis
        await databases.createDocument(
            DATABASE_ID,
            COLLECTIONS.GLOBAL_ANALYSIS,
            ID.unique(),
            {
                overall_risk_level: 68,
                active_conflicts_count: 15,
                high_risk_countries_count: 8,
                news_summary: 'Global tensions remain elevated with ongoing conflicts in Eastern Europe and Middle East. Several regions show concerning stability trends.',
                ai_reasoning: 'Risk assessment based on active military conflicts, political instability, economic sanctions, and regional security concerns.',
                key_events: ['Ukraine conflict continuation', 'Middle East tensions', 'Nuclear program developments'],
                trend_direction: 'stable'
            }
        );

        console.log('✓ Initial data seeded successfully');
    } catch (error) {
        console.error('Error seeding data:', error.message);
    }
}

module.exports = {
    initializeAppwriteDatabase,
    seedInitialData,
    client,
    databases,
    DATABASE_ID,
    COLLECTIONS
}; 