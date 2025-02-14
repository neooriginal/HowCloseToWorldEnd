const openai_lib = require('openai');
const axios = require('axios');
const mysql = require('mysql2/promise');
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

app.use(express.static(path.join(__dirname, 'public')));
let connection = undefined;

let lastNews = undefined

const openai = new openai_lib({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
});

// Add connection pool instead of single connection for better scalability
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

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
        // Test database connection
        await pool.query('SELECT 1');
        console.log('Database connection successful');

        await pool.query(`CREATE TABLE IF NOT EXISTS history (
            id INT AUTO_INCREMENT PRIMARY KEY,
            news TEXT,
            worldend INT,
            reasoning TEXT,
            date DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_date (date)
        )`);

        const UPDATE_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours in milliseconds
        setInterval(main, UPDATE_INTERVAL);
        
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
        
        // Use prepared statement for SQL injection prevention
        await pool.query(
            'INSERT INTO history (worldend, news, reasoning) VALUES (?, ?, ?)', 
            [normalizedWorldend, news, reasoning]
        );
        
        // Update last AI update timestamp
        lastAIUpdate = Date.now();
    } catch (error) {
        console.error('Error saving world end data:', error);
        throw error;
    }
}

async function getWorldEnd() {
    try {
        // Use prepared statement with proper limit
        const [rows] = await pool.query(
            'SELECT * FROM history ORDER BY date DESC LIMIT ?',
            [10]
        );
        return rows;
    } catch (error) {
        console.error('Error fetching world end data:', error);
        throw error;
    }
}

// API endpoints with prepared statements
app.get('/api/latest', async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM history ORDER BY date DESC LIMIT 1'
        );
        res.json(rows[0] || { error: 'No data available' });
    } catch (error) {
        console.error('Error in /api/latest:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/history', async (req, res) => {
    try {
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);
        const [rows] = await pool.query(
            'SELECT * FROM history ORDER BY date DESC LIMIT ?',
            [limit]
        );
        res.json(rows);
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
    You shouldnt go over 75% if its not a big event or dangerous event.

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

initializeDB();


