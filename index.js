const openai_lib = require('openai');
const axios = require('axios');
const express = require('express');
const dotenv = require('dotenv');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const { initializeDB, run, get, all, db } = require('./db');

dotenv.config();

const app = express();
// Enable trust proxy - this is required when behind a reverse proxy like Nginx
app.set('trust proxy', 1);

const server = http.createServer(app);
const io = socketIo(server);

// Rate limiting middleware
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: {
        error: 'Too many requests from this IP, please try again later.'
    },
    // Ensure consistent rate limiting in production
    trustProxy: true
});

// API documentation
const swaggerDocument = {
    openapi: '3.0.0',
    info: {
        title: 'Global Conflict Tracker API',
        version: '1.0.0',
        description: 'API for accessing global conflict data and country risk levels',
    },
    servers: [
        {
            url: 'https://worldend.neoserver.dev/api',
            description: 'Production server',
        }
    ],
    paths: {
        '/countries': {
            get: {
                summary: 'Get all countries with their risk levels',
                responses: {
                    '200': {
                        description: 'Countries data with risk levels',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            name: { type: 'string' },
                                            iso_code: { type: 'string' },
                                            continent: { type: 'string' },
                                            region: { type: 'string' },
                                            current_risk_level: { type: 'number' },
                                            last_updated: { type: 'string', format: 'date-time' }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        '/conflicts': {
            get: {
                summary: 'Get active conflicts',
                responses: {
                    '200': {
                        description: 'Active conflicts data',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            title: { type: 'string' },
                                            description: { type: 'string' },
                                            severity: { type: 'number' },
                                            conflict_type: { type: 'string' },
                                            country_name: { type: 'string' },
                                            iso_code: { type: 'string' },
                                            risk_score: { type: 'number' }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        '/global-analysis': {
            get: {
                summary: 'Get latest global analysis',
                responses: {
                    '200': {
                        description: 'Latest global conflict analysis',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        overall_risk_level: { type: 'number' },
                                        active_conflicts_count: { type: 'number' },
                                        high_risk_countries_count: { type: 'number' },
                                        news_summary: { type: 'string' },
                                        ai_reasoning: { type: 'string' },
                                        key_events: { type: 'array', items: { type: 'string' } },
                                        trend_direction: { type: 'string' },
                                        created_at: { type: 'string', format: 'date-time' }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        '/news': {
            get: {
                summary: 'Get categorized news for intelligence sections',
                responses: {
                    '200': {
                        description: 'Categorized news articles for intelligence display',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        breaking: {
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    title: { type: 'string' },
                                                    description: { type: 'string' },
                                                    source: { type: 'object' },
                                                    publishedAt: { type: 'string' }
                                                }
                                            }
                                        },
                                        geopolitical: {
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    title: { type: 'string' },
                                                    description: { type: 'string' },
                                                    source: { type: 'object' },
                                                    publishedAt: { type: 'string' }
                                                }
                                            }
                                        },
                                        security: {
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    title: { type: 'string' },
                                                    description: { type: 'string' },
                                                    source: { type: 'object' },
                                                    publishedAt: { type: 'string' }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
};

// Serve API documentation
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Apply rate limiting to API routes
app.use('/api', apiLimiter);

// Add no-cache headers middleware
app.use((req, res, next) => {
    // Add headers to prevent caching
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store'
    });
    next();
});

app.use(express.static(path.join(__dirname, 'public')));

const openai = new openai_lib({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
});

// Track last successful AI update
let lastAIUpdate = null;
const MIN_AI_INTERVAL = 30 * 60 * 1000; // 30 minutes minimum between AI calls

async function getNews() {
    try {
        if (!process.env.NEWS_API_KEY) {
            console.log('No News API key found');
            return null;
        }

        const response = await fetch(`https://newsapi.org/v2/top-headlines?category=general&pageSize=50&apiKey=${process.env.NEWS_API_KEY}`);

        if (!response.ok) {
            console.log('News API request failed');
            return null;
        }

        const data = await response.json();

        if (!data.articles || data.articles.length === 0) {
            console.log('No articles found');
            return null;
        }

        // Better filtering for high-quality conflict news
        const relevantArticles = data.articles.filter(article => {
            if (!article.title || !article.description) return false;

            const text = (article.title + ' ' + article.description).toLowerCase();

            // High priority conflict keywords
            const highPriorityKeywords = [
                'war', 'warfare', 'conflict', 'invasion', 'attack', 'bombing', 'missile',
                'sanctions', 'military', 'troops', 'forces', 'violence', 'terrorism',
                'ceasefire', 'peace talks', 'diplomatic crisis', 'nuclear', 'weapons'
            ];

            // Medium priority keywords
            const mediumPriorityKeywords = [
                'tension', 'crisis', 'protest', 'election', 'coup', 'government',
                'security', 'threat', 'intelligence', 'cyber attack', 'embargo'
            ];

            // Exclude sports, entertainment, etc.
            const excludeKeywords = [
                'sport', 'football', 'basketball', 'movie', 'celebrity', 'music',
                'weather', 'stock market', 'earnings', 'technology review'
            ];

            const hasExcluded = excludeKeywords.some(keyword => text.includes(keyword));
            if (hasExcluded) return false;

            const hasHighPriority = highPriorityKeywords.some(keyword => text.includes(keyword));
            const hasMediumPriority = mediumPriorityKeywords.some(keyword => text.includes(keyword));

            return hasHighPriority || hasMediumPriority;
        });

        console.log(`Filtered ${relevantArticles.length} relevant articles from ${data.articles.length} total`);
        return relevantArticles.length > 0 ? relevantArticles : null;
    } catch (error) {
        console.error('Error fetching news:', error.message);
        return null;
    }
}

async function init() {
    try {
        await initializeDB();
        console.log('SQLite database initialized');
    } catch (error) {
        console.error('Failed to initialize SQLite database:', error.message);
    }
}

async function analyzeGlobalConflicts(newsArticles) {
    try {
        const currentDate = new Date().toISOString().split('T')[0];
        const currentTime = new Date().toLocaleString();

        const prompt = `Today is ${currentDate} at ${currentTime}. You are analyzing breaking news to assess global conflict risks. Base your analysis STRICTLY on the provided news articles and current global context.

Recent breaking news:
${newsArticles.map(article => `Title: ${article.title}\nDescription: ${article.description || 'No description'}\nPublished: ${article.publishedAt || 'Recent'}\n---`).join('\n')}

CRITICAL INSTRUCTIONS:
- Analyze ONLY based on the news provided above and current global events as of ${currentDate}
- Risk levels should reflect the actual intensity and immediacy of threats mentioned in these articles
- Countries with active conflicts or breaking tensions should have higher risk levels (70-90)
- Countries with diplomatic tensions or economic issues should have moderate levels (40-70)  
- Stable countries with no major issues should have lower levels (10-40)
- The overall risk should reflect the aggregate of all current threats, not historical averages
- Be responsive to breaking news - if major events are happening, reflect higher risk levels
- Trend direction should reflect whether recent events are escalating or de-escalating

Return ONLY valid JSON:
{
  "overall_risk_level": number (0-100, based on current threat intensity from news),
  "countries": [
    {
      "name": "exact country name", 
      "iso_code": "3-letter ISO code",
      "risk_level": number (0-100, based on current situation),
      "conflicts": [
        {
          "title": "specific current conflict/issue",
          "description": "current situation based on news", 
          "severity": number (1-10, current intensity),
          "type": "war|political_unrest|economic|natural_disaster|terrorist|cyber|diplomatic",
          "risk_score": number (0-100, immediate threat level)
        }
      ]
    }
  ],
  "key_events": ["current major event 1", "current major event 2", "current major event 3"],
  "trend_direction": "increasing|decreasing|stable", 
  "news_summary": "2-3 sentence summary of current global threats from these articles",
  "ai_reasoning": "explanation of current risk assessment based on breaking news"
}

Focus on countries mentioned in the news articles. For major powers (US, China, Russia, etc.) always include current assessment even if not directly mentioned. Ensure risk levels reflect current reality - if there are active wars, those countries should have very high risk levels (80-95). If tensions are escalating, show increasing trend.`;

        const completion = await openai.chat.completions.create({
            model: "openai/gpt-4o",
            response_format: { type: "json_object" },
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            max_tokens: 4000
        });

        let responseContent = completion.choices[0].message.content.trim();

        // Extract JSON from response if it contains extra text
        const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            responseContent = jsonMatch[0];
        }

        const result = JSON.parse(responseContent);
        lastAIUpdate = Date.now();
        return result;
    } catch (error) {
        console.error('Error in AI analysis:', error.message);
        return null;
    }
}

async function saveGlobalAnalysis(analysis) {
    try {
        await run(
            'INSERT INTO global_analysis (overall_risk_level, active_conflicts_count, high_risk_countries_count, news_summary, ai_reasoning, key_events, trend_direction) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
                analysis.overall_risk_level,
                analysis.countries.reduce((total, country) => total + country.conflicts.length, 0),
                analysis.countries.filter(c => c.risk_level > 60).length,
                analysis.news_summary,
                analysis.ai_reasoning,
                JSON.stringify(analysis.key_events),
                analysis.trend_direction
            ]
        );
        return true;
    } catch (error) {
        console.error('Error saving global analysis:', error.message);
        return null;
    }
}

async function updateCountriesAndConflicts(analysis) {
    try {
        for (const countryData of analysis.countries) {
            // Find existing country by iso_code
            const country = await get('SELECT id FROM countries WHERE iso_code = ?', [countryData.iso_code]);

            let countryId;
            if (country) {
                countryId = country.id;
                await run(
                    'UPDATE countries SET current_risk_level = ?, last_updated = ? WHERE id = ?',
                    [countryData.risk_level, new Date().toISOString(), countryId]
                );
            } else {
                const result = await run(
                    'INSERT INTO countries (name, iso_code, current_risk_level, last_updated) VALUES (?, ?, ?, ?)',
                    [countryData.name, countryData.iso_code, countryData.risk_level, new Date().toISOString()]
                );
                countryId = result.lastID;
            }

            if (countryData.conflicts) {
                // Delete existing active conflicts for this country
                await run('DELETE FROM conflicts WHERE country_id = ? AND status = ?', [countryId, 'active']);

                // Add new conflicts
                for (const conflict of countryData.conflicts) {
                    await run(
                        'INSERT INTO conflicts (country_id, title, description, severity, conflict_type, risk_score, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [
                            countryId,
                            conflict.title,
                            conflict.description,
                            conflict.severity,
                            conflict.type,
                            conflict.risk_score,
                            'active'
                        ]
                    );
                }
            }
        }
    } catch (error) {
        console.error('Error updating countries and conflicts:', error.message);
    }
}

// API endpoints
app.get('/api/countries', async (req, res) => {
    try {
        const countries = await all('SELECT * FROM countries ORDER BY current_risk_level DESC');
        res.json(countries);
    } catch (error) {
        console.error('Error fetching countries:', error.message);
        res.status(500).json({ error: 'Failed to fetch countries' });
    }
});

app.get('/api/conflicts', async (req, res) => {
    try {
        const conflicts = await all(`
            SELECT c.*, co.name as country_name, co.iso_code 
            FROM conflicts c 
            JOIN countries co ON c.country_id = co.id 
            WHERE c.status = 'active' 
            ORDER BY c.severity DESC
        `);
        res.json(conflicts);
    } catch (error) {
        console.error('Error fetching conflicts:', error.message);
        res.status(500).json({ error: 'Failed to fetch conflicts' });
    }
});

app.get('/api/global-analysis', async (req, res) => {
    try {
        const analysis = await get('SELECT * FROM global_analysis ORDER BY created_at DESC LIMIT 1');

        if (!analysis) {
            return res.status(404).json({ error: 'No global analysis found' });
        }

        // Parse JSON fields
        if (analysis.key_events) {
            analysis.key_events = JSON.parse(analysis.key_events);
        }

        res.json(analysis);
    } catch (error) {
        console.error('Error fetching global analysis:', error.message);
        res.status(500).json({ error: 'Failed to fetch global analysis' });
    }
});

app.get('/api/historical-analysis', async (req, res) => {
    try {
        const period = req.query.period || '24h';
        let timeFilter;

        switch (period) {
            case '24h':
                timeFilter = new Date(Date.now() - 24 * 60 * 60 * 1000);
                break;
            case '7d':
                timeFilter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                break;
            case '30d':
                timeFilter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                break;
            case '1y':
                timeFilter = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
                break;
            default:
                timeFilter = new Date(Date.now() - 24 * 60 * 60 * 1000);
        }

        const analyses = await all(
            'SELECT overall_risk_level, created_at FROM global_analysis WHERE created_at >= ? ORDER BY created_at ASC',
            [timeFilter.toISOString()]
        );

        res.json(analyses.map(doc => ({
            overall_risk_level: doc.overall_risk_level,
            created_at: doc.created_at
        })));
    } catch (error) {
        console.error('Error fetching historical analysis:', error.message);
        res.status(500).json({ error: 'Failed to fetch historical analysis' });
    }
});

app.post('/api/trigger-analysis', async (req, res) => {
    try {
        console.log('Manual analysis trigger requested...');
        await performGlobalAnalysis();
        res.json({ success: true, message: 'Analysis triggered successfully' });
    } catch (error) {
        console.error('Error triggering analysis:', error.message);
        res.status(500).json({ error: 'Failed to trigger analysis' });
    }
});

// Add news endpoint for frontend
app.get('/api/news', async (req, res) => {
    try {
        const news = await getNews();

        if (!news || news.length === 0) {
            return res.json({
                breaking: [],
                geopolitical: [],
                security: []
            });
        }

        // Categorize news into different types
        const breaking = [];
        const geopolitical = [];
        const security = [];

        news.forEach(article => {
            const text = (article.title + ' ' + (article.description || '')).toLowerCase();

            // Breaking news keywords (urgent/immediate events)
            const breakingKeywords = ['breaking', 'urgent', 'attack', 'bombing', 'invasion', 'nuclear', 'emergency'];

            // Geopolitical keywords
            const geopoliticalKeywords = ['diplomatic', 'sanctions', 'trade', 'relations', 'treaty', 'summit', 'election', 'government'];

            // Security keywords
            const securityKeywords = ['security', 'terrorism', 'cyber', 'intelligence', 'threat', 'military', 'defense'];

            const hasBreaking = breakingKeywords.some(keyword => text.includes(keyword));
            const hasGeopolitical = geopoliticalKeywords.some(keyword => text.includes(keyword));
            const hasSecurity = securityKeywords.some(keyword => text.includes(keyword));

            // Assign to category based on priority
            if (hasBreaking && breaking.length < 5) {
                breaking.push(article);
            } else if (hasGeopolitical && geopolitical.length < 5) {
                geopolitical.push(article);
            } else if (hasSecurity && security.length < 5) {
                security.push(article);
            } else {
                // Distribute remaining articles evenly
                if (breaking.length <= geopolitical.length && breaking.length <= security.length && breaking.length < 5) {
                    breaking.push(article);
                } else if (geopolitical.length <= security.length && geopolitical.length < 5) {
                    geopolitical.push(article);
                } else if (security.length < 5) {
                    security.push(article);
                }
            }
        });

        res.json({
            breaking: breaking.slice(0, 5),
            geopolitical: geopolitical.slice(0, 5),
            security: security.slice(0, 5)
        });
    } catch (error) {
        console.error('Error fetching news for frontend:', error.message);
        res.status(500).json({ error: 'Failed to fetch news' });
    }
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('Client connected');

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

async function performGlobalAnalysis() {
    try {
        // Enforce minimum interval between AI calls
        if (lastAIUpdate && (Date.now() - lastAIUpdate) < MIN_AI_INTERVAL) {
            const remainingTime = Math.ceil((MIN_AI_INTERVAL - (Date.now() - lastAIUpdate)) / 60000);
            console.log(`AI analysis skipped - ${remainingTime} minutes remaining until next allowed call`);
            return;
        }

        console.log('Starting global conflict analysis...');
        const newsArticles = await getNews();

        if (!newsArticles || newsArticles.length === 0) {
            console.log('No current news available for analysis - skipping this cycle');
            return;
        }

        console.log(`Analyzing ${newsArticles.length} relevant news articles...`);
        const analysis = await analyzeGlobalConflicts(newsArticles);
        if (!analysis) {
            console.log('AI analysis failed');
            return;
        }

        await saveGlobalAnalysis(analysis);
        await updateCountriesAndConflicts(analysis);

        io.emit('analysisUpdate', {
            overall_risk_level: analysis.overall_risk_level,
            active_conflicts_count: analysis.countries.reduce((total, country) => total + country.conflicts.length, 0),
            high_risk_countries_count: analysis.countries.filter(c => c.risk_level > 60).length,
            timestamp: new Date().toISOString()
        });

        console.log(`Global analysis completed - Risk Level: ${analysis.overall_risk_level}%`);
    } catch (error) {
        console.error('Error in global analysis:', error.message);
    }
}

async function main() {
    await init();

    // Run analysis immediately on startup
    console.log('Running initial global analysis...');
    await performGlobalAnalysis();

    // Then run every 6 hours
    setInterval(performGlobalAnalysis, 6 * 60 * 60 * 1000);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    main().catch(console.error);
});


