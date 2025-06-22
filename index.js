const openai_lib = require('openai');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const express = require('express');
const dotenv = require('dotenv');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');

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
        title: 'World End Probability API',
        version: '1.0.0',
        description: 'API for accessing world end probability data and historical trends',
    },
    servers: [
        {
            url: 'https://worldend.neoserver.dev/api',
            description: 'Production server',
        }
    ],
    paths: {
        '/latest': {
            get: {
                summary: 'Get latest probability data',
                responses: {
                    '200': {
                        description: 'Latest probability data',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        worldend: {
                                            type: 'number',
                                            description: 'Current world end probability (0-100)',
                                        },
                                        news: {
                                            type: 'string',
                                            description: 'News summary',
                                        },
                                        reasoning: {
                                            type: 'string',
                                            description: 'AI reasoning for the probability',
                                        },
                                        date: {
                                            type: 'string',
                                            format: 'date-time',
                                            description: 'Timestamp of the calculation',
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        '/history': {
            get: {
                summary: 'Get historical probability data',
                parameters: [
                    {
                        name: 'limit',
                        in: 'query',
                        description: 'Number of records to return (max 100)',
                        required: false,
                        schema: {
                            type: 'integer',
                            default: 10,
                            maximum: 100
                        }
                    }
                ],
                responses: {
                    '200': {
                        description: 'Historical probability data',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            worldend: {
                                                type: 'number',
                                                description: 'World end probability (0-100)',
                                            },
                                            news: {
                                                type: 'string',
                                                description: 'News summary',
                                            },
                                            reasoning: {
                                                type: 'string',
                                                description: 'AI reasoning for the probability',
                                            },
                                            date: {
                                                type: 'string',
                                                format: 'date-time',
                                                description: 'Timestamp of the calculation',
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

let lastNews = undefined

const openai = new openai_lib({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
});

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// Track last successful AI update
let lastAIUpdate = null;
const MIN_AI_INTERVAL = 30 * 60 * 1000; // 30 minutes minimum between AI calls

async function getNews(){
    try {
        // Check if enough time has passed since last update
        if (lastAIUpdate && Date.now() - lastAIUpdate < MIN_AI_INTERVAL) {
            console.log('Skipping news fetch - too soon since last update');
            return false;
        }

        const response = await axios.get('https://newsapi.org/v2/top-headlines', {
            params: {
                apiKey: process.env.NEWS_API_KEY,
                language: 'en',
                sortBy: 'publishedAt',
            }
        });

        // Compare with last news to avoid unnecessary AI calls
        if (lastNews && JSON.stringify(lastNews) === JSON.stringify(response.data)) {
            console.log('Skipping AI update - no new news');
            return false;
        }

        lastNews = response.data;
        let toText = "";
        for (const article of response.data.articles) {
            if (article.title && (article.description || article.content)) {
                toText += `${article.title}\n${article.description || ''}\n${article.content || ''}\n\n`;
            }
        }
        return toText || false;
    } catch (error) {
        console.error('Error fetching news:', error);
        return false;
    }
}

async function initializeDB() {
    try {
        // Test Supabase connection
        const { data, error } = await supabase.from('history').select('id').limit(1);
        if (error && error.code !== 'PGRST116') { // PGRST116 is "table not found" which is ok during first setup
            throw error;
        }
        console.log('Supabase connection successful');

        const UPDATE_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours in milliseconds
        setInterval(main, UPDATE_INTERVAL);
        
        // Generate daily summary at midnight
        const now = new Date();
        const midnight = new Date(now);
        midnight.setHours(24, 0, 0, 0);
        const timeUntilMidnight = midnight - now;
        setTimeout(() => {
            generateDailySummary();
            // Then schedule it to run every 24 hours
            setInterval(generateDailySummary, 24 * 60 * 60 * 1000);
        }, timeUntilMidnight);

        server.listen(3000, () => {
            console.log('Server is running on port 3000');
            console.log('API documentation available at /docs');
        });
    } catch (error) {
        console.error('Database initialization failed:', error);
        process.exit(1);
    }
}

async function saveWorldEnd(worldend, news, reasoning) {
    try {
        // Convert worldend to a number and ensure it's within valid range
        const worldendValue = parseFloat(worldend);
        if (isNaN(worldendValue)) {
            throw new Error('Invalid worldend value');
        }
        // Round to 2 decimal places and ensure it's within bounds
        const normalizedWorldend = Math.min(Math.max(Math.round(worldendValue * 100) / 100, 0), 100);
        
        const { error } = await supabase
            .from('history')
            .insert([
                { 
                    worldend: normalizedWorldend, 
                    news, 
                    reasoning 
                }
            ]);
        
        if (error) {
            throw error;
        }
        
        // Update last AI update timestamp
        lastAIUpdate = Date.now();
    } catch (error) {
        console.error('Error saving world end data:', error);
        throw error;
    }
}

async function getWorldEnd() {
    try {
        const { data, error } = await supabase
            .from('history')
            .select('*')
            .order('date', { ascending: false })
            .limit(10);
        
        if (error) {
            throw error;
        }
        
        return data || [];
    } catch (error) {
        console.error('Error fetching world end data:', error);
        throw error;
    }
}

// API endpoints
app.get('/api/latest', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('history')
            .select('*')
            .order('date', { ascending: false })
            .limit(1);
        
        if (error) {
            throw error;
        }
        
        res.json(data[0] || { error: 'No data available' });
    } catch (error) {
        console.error('Error in /api/latest:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get("/widget", (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'widget.html'));
});

app.get('/api/history', async (req, res) => {
    try {
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);
        const { data, error } = await supabase
            .from('history')
            .select('*')
            .order('date', { ascending: false })
            .limit(limit);
        
        if (error) {
            throw error;
        }
        
        res.json(data || []);
    } catch (error) {
        console.error('Error in /api/history:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('New client connected');
    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

async function calculateWorldEnd(news){
    const history = await getWorldEnd();
    const prompt = `
    you will be given news articles. based on the articles, respond with a % of how close the world is to extinguishing (0% = world piece, 100% = all icmbs launched). be very critical and think about it.
    This can include climate, natural disasters, politics, space events, etc. only evaluate the news article if it happened right now (and not in the future / past)
    You shouldnt go over 75% if its not a big event or dangerous event. Calculate the percentage based on global events, local events or small events are not as important.
    IMPORANT: also note that previous events do not just go away and could still be relevant. use previous events and current events to calculate a more accurate percentage. try to keep it relatively constant and think about previous events and how permanent them are. usually you should only change the percentage by max 5%.
    ALSO, BE CONSISTENT. CHECK THE HISTORY AND BE CONSISTENT WITH THE EVALUATION CRITERIA.

    History of decisions:
    ${history.map(h => `${h.date}: ${h.worldend} - ${h.news}`).join("\n")}

    Respond in a JSON format:
    {
        "reasoning": "reasoning for the percentage",
        "news_summary": "summary of the news article",
        "worldend_probability": number between 0 and 100
    }

    News:
    ${news.toString()}
    `
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" }
        });
        
        const worldend = JSON.parse(response.choices[0].message.content);
        
        // Handle the probability value more robustly
        let probability;
        if (typeof worldend.worldend_probability === 'number') {
            probability = worldend.worldend_probability;
        } else if (typeof worldend.worldend_probability === 'string') {
            // Remove any % sign and convert to number
            probability = parseFloat(worldend.worldend_probability.replace(/[^0-9.]/g, ''));
        } else {
            throw new Error('Invalid probability format received from AI');
        }

        // Validate the probability is within bounds
        if (isNaN(probability) || probability < 0 || probability > 100) {
            throw new Error('Probability out of valid range (0-100)');
        }

        await saveWorldEnd(probability, worldend.news_summary, worldend.reasoning);
        
        // Emit the new data to all connected clients
        io.emit('update', {
            probability,
            news_summary: worldend.news_summary,
            reasoning: worldend.reasoning,
            timestamp: new Date()
        });
        
        return worldend;
    } catch (error) {
        console.error('Error in calculateWorldEnd:', error);
        // Return a safe fallback or rethrow depending on your needs
        throw error;
    }
}

async function main(){
    try {
        const news = await getNews();
        if (news) {
            const worldend = await calculateWorldEnd(news);
            console.log('AI update completed successfully');
        } else {
            console.log('Skipping AI update - no new data or too soon');
        }
    } catch (error) {
        console.error('Error in main loop:', error);
    }
}

async function generateDailySummary() {
    try {
        // Get yesterday's date
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        
        const todayStart = new Date(yesterday);
        todayStart.setDate(todayStart.getDate() + 1);
        
        // Get all events from yesterday
        const { data: events, error } = await supabase
            .from('history')
            .select('*')
            .gte('date', yesterday.toISOString())
            .lt('date', todayStart.toISOString())
            .order('date', { ascending: true });
        
        if (error) {
            throw error;
        }
        
        if (events.length === 0) {
            console.log('No events to summarize for yesterday');
            return;
        }
        
        // Calculate average worldend value
        const avgWorldend = events.reduce((acc, event) => acc + event.worldend, 0) / events.length;
        
        // Combine all news and reasoning for the day
        const allNews = events.map(e => e.news).join('\n');
        const allReasoning = events.map(e => e.reasoning).join('\n');
        
        // Generate summary using AI
        const prompt = `
            Based on the following news and reasoning from the past 24 hours, provide a concise daily summary.
            Focus on the most significant events and their global impact.
            
            News from the past 24 hours:
            ${allNews}
            
            Reasoning provided:
            ${allReasoning}
            
            Average world end probability: ${avgWorldend.toFixed(2)}%
            
            Respond in JSON format:
            {
                "key_events": "Bullet point list of the most important events",
                "overall_impact": "Analysis of the day's overall impact on global stability"
            }
        `;
        
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" }
        });
        
        const summary = JSON.parse(response.choices[0].message.content);
        
        // Save the daily summary (using upsert)
        const { error: upsertError } = await supabase
            .from('daily_summaries')
            .upsert([
                {
                    date: yesterday.toISOString().split('T')[0],
                    key_events: summary.key_events,
                    overall_impact: summary.overall_impact,
                    average_worldend: avgWorldend
                }
            ]);
        
        if (upsertError) {
            throw upsertError;
        }
        
        // Emit the new summary to all connected clients
        io.emit('daily_summary', {
            date: yesterday.toISOString().split('T')[0],
            key_events: summary.key_events,
            overall_impact: summary.overall_impact,
            average_worldend: avgWorldend
        });
        
        console.log('Daily summary generated successfully');
    } catch (error) {
        console.error('Error generating daily summary:', error);
    }
}

// Add new endpoint to get daily summaries
app.get('/api/daily-summary', async (req, res) => {
    try {
        const date = req.query.date ? new Date(req.query.date) : new Date();
        date.setHours(0, 0, 0, 0);
        
        const { data, error } = await supabase
            .from('daily_summaries')
            .select('*')
            .eq('date', date.toISOString().split('T')[0])
            .limit(1);
        
        if (error) {
            throw error;
        }
        
        if (data && data.length > 0) {
            res.json(data[0]);
        } else {
            res.status(404).json({ error: 'No summary available for this date' });
        }
    } catch (error) {
        console.error('Error in /api/daily-summary:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

initializeDB();


