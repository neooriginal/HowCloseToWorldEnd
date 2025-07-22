# How Close To World End

A real-time global conflict tracker powered by AI analysis, news monitoring, and risk assessment.

## Features

- **Real-time Conflict Monitoring**: Live tracking of global conflicts and tensions
- **AI-Powered Analysis**: OpenAI-driven risk assessment and trend analysis  
- **Interactive World Map**: Visual representation of global risk levels
- **RESTful API**: Complete API for accessing conflict data
- **Real-time Updates**: WebSocket-based live updates
- **Historical Trends**: Track risk levels over time

## Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: Appwrite (NoSQL/Document-based)
- **AI**: OpenAI GPT-4 for analysis
- **Frontend**: Vanilla JavaScript, D3.js for visualizations
- **Real-time**: Socket.io
- **News**: NewsAPI integration
- **Deployment**: Docker

## Quick Start

### 1. Setup Appwrite Database

#### Create Appwrite Project
1. Go to [Appwrite Console](https://cloud.appwrite.io) (or use your self-hosted instance)
2. Create a new account or log in
3. Click "Create Project"
4. Enter a project name (e.g., "World Conflict Tracker")
5. Copy your **Project ID**

#### Generate API Key
1. In your project dashboard, go to **Settings > API Keys**
2. Click "Create API Key"
3. Name it "Server Key" 
4. Grant these permissions:
   - `databases.read` & `databases.write`
   - `collections.read` & `collections.write`
   - `attributes.read` & `attributes.write`
   - `documents.read` & `documents.write`
   - `indexes.read` & `indexes.write`
5. Copy your **API Key** (keep secure!)

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:
```env
# Appwrite Configuration
APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=your_project_id_here
APPWRITE_API_KEY=your_api_key_here

# API Keys
OPENROUTER_API_KEY=your_openrouter_key
NEWS_API_KEY=your_news_api_key
```

### 4. Start the Application

```bash
npm start
```

The application will automatically:
- Initialize the Appwrite database
- Create collections and indexes  
- Seed initial country data
- Start the server on port 3000

Look for these success messages:
```
✅ Connection successful!
✓ Database created
✓ Countries collection created
✓ Conflicts collection created
✓ Global Analysis collection created
✓ Regional Summaries collection created
✓ Initial data seeded successfully
```

## API Documentation

API documentation is available at `/docs` when the server is running.

### Main Endpoints

- `GET /api/countries` - List all countries with risk levels
- `GET /api/conflicts` - List active conflicts
- `GET /api/global-analysis` - Get latest global analysis
- `GET /api/historical-analysis` - Get historical risk data

## Configuration

### Required Environment Variables

```env
# Appwrite Configuration
APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=your_project_id
APPWRITE_API_KEY=your_api_key

# API Keys
OPENROUTER_API_KEY=your_openrouter_key
NEWS_API_KEY=your_news_api_key
```

### Optional Configuration

```env
NODE_ENV=development
PORT=3000
```

## Deployment

### Docker Deployment

```bash
docker-compose up -d
```

Make sure to set your environment variables in the docker-compose.yml file.

### Manual Deployment

1. Set up your Appwrite project and get credentials
2. Configure environment variables on your server
3. Install dependencies: `npm install`
4. Start the application: `npm start`

## Development

### Project Structure

```
├── appwrite-setup.js     # Database initialization
├── index.js              # Main application server
├── public/               # Frontend files
│   ├── app.js           # Frontend JavaScript
│   ├── styles.css       # Styling
│   └── index.html       # Main page
└── package.json          # Dependencies
```

### Adding New Features

1. Database changes: Update `appwrite-setup.js`
2. API endpoints: Add to `index.js`
3. Frontend: Update files in `public/`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the ISC License.

## Support

For setup issues, check:
1. [Appwrite Documentation](https://appwrite.io/docs)
2. [Appwrite Community Discord](https://discord.gg/GSeTUeA)
3. Project issues on GitHub

### Troubleshooting

**Database Connection Issues:**
- Verify Project ID and API Key are correct
- Check API key permissions include all database scopes
- Ensure endpoint URL is correct

**Collection Creation Errors:**
- Wait a few minutes between attempts - Appwrite needs time to process
- Check that attributes are created before adding indexes
- Verify your API key has `collections.write` permission
 
