const openai_lib = require('openai');
const axios = require('axios');
const mysql = require('mysql2/promise');
const express = require('express');
const dotenv = require('dotenv');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

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

    setInterval(main, 1000 * 60 * 60 ); //every hour

    main();
    server.listen(3000, () => {
        console.log('Server is running on port 3000');
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

// Add new endpoint to get latest data
app.get('/api/latest', async (req, res) => {
    try {
        const history = await getWorldEnd();
        res.json(history);
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
        "worldend_probability": "percentage of how close the world is to extinguishing"
    }

    News:
    ${news.toString()}
    `
    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
    });
    const worldend = JSON.parse(response.choices[0].message.content);
    // Parse the probability as a number before saving
    const probability = parseFloat(worldend.worldend_probability.replace('%', ''));
    await saveWorldEnd(probability, worldend.news_summary, worldend.reasoning);
    
    // Emit the new data to all connected clients
    io.emit('update', {
        probability,
        news_summary: worldend.news_summary,
        reasoning: worldend.reasoning,
        timestamp: new Date()
    });
    
    return worldend;
}

initializeDB();

async function main(){
    const news = await getNews();
    const worldend = await calculateWorldEnd(news);
}


