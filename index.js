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
const server = http.createServer(app);
const io = socketIo(server);

// Rate limiting middleware
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
        error: 'Too many requests from this IP, please try again later.'
    }
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

async function getNews(){
    const response = await axios.get('https://newsapi.org/v2/top-headlines', {
        params: {
            apiKey: process.env.NEWS_API_KEY,
            language: 'en',
            sortBy: 'publishedAt',
        }
    });
    if(lastNews == response.data){
        return false;
    }
    lastNews = response.data;
    let toText = "";
    for(let i = 0; i < response.data.articles.length; i++){
        toText += `${response.data.articles[i].title}\n${response.data.articles[i].description}\n${response.data.articles[i].content}\n\n`;
    }
    return toText;
}

async function initializeDB() {
    connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    await connection.query(`CREATE TABLE IF NOT EXISTS history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        news TEXT,
        worldend INT,
        reasoning TEXT,
        date DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    const UPDATE_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours in milliseconds
    setInterval(main, UPDATE_INTERVAL);

    main();
    server.listen(3000, () => {
        console.log('Server is running on port 3000');
        console.log('API documentation available at /docs');
    });
}

async function saveWorldEnd(worldend, news, reasoning){
    // Convert worldend to a number and ensure it's within valid range
    const worldendValue = parseFloat(worldend);
    if (isNaN(worldendValue)) {
        throw new Error('Invalid worldend value');
    }
    // Round to 2 decimal places to avoid any floating point issues
    const normalizedWorldend = Math.min(Math.max(Math.round(worldendValue * 100) / 100, 0), 100);
    
    await connection.query(`INSERT INTO history (worldend, news, reasoning) VALUES (?, ?, ?)`, 
        [normalizedWorldend, news, reasoning]);
}

async function getWorldEnd(){
    //get last 10 decisions
    const [rows] = await connection.query(`SELECT * FROM history ORDER BY date DESC LIMIT 10`);
    return rows;
}

// API endpoints
app.get('/api/latest', async (req, res) => {
    try {
        const [rows] = await connection.query(
            'SELECT * FROM history ORDER BY date DESC LIMIT 1'
        );
        res.json(rows[0] || { error: 'No data available' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/history', async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 10, 100);
        const [rows] = await connection.query(
            'SELECT * FROM history ORDER BY date DESC LIMIT ?',
            [limit]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
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
    const news = await getNews();
    const worldend = await calculateWorldEnd(news);
}

initializeDB();


