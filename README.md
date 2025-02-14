# 🌍 How Close To World End

A real-time AI-powered dashboard that analyzes global news to estimate how close we are to potential world-ending scenarios. The system uses advanced AI to process current events and calculate a probability score, providing insights into global stability.

![image](https://github.com/user-attachments/assets/cf36a1b5-3747-448b-800e-83ea6cfc1d91)

## 🌟 Features

- 🤖 AI-powered analysis of global news
- 📊 Real-time probability updates every 6 hours
- 📈 Historical trend tracking
- 🔄 Live updates via WebSocket
- 🎯 Detailed reasoning for each probability
- 📱 Responsive design
- 🔌 Public API with documentation

## 🚀 Live Demo

Visit [the website](https://worldend.neoserver.dev) to see the project in action.

## 🛠️ Self-Hosting Guide

### Prerequisites

- Node.js (v18 or higher)
- MySQL/MariaDB database
- NewsAPI key
- OpenRouter API key (for GPT access)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Neotastisch/HowCloseToWorldEnd.git
   cd HowCloseToWorldEnd
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory:
   ```env
   # Database Configuration
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=your_db_user
   DB_PASSWORD=your_db_password
   DB_NAME=worldend

   # API Keys
   NEWS_API_KEY=your_newsapi_key
   OPENROUTER_API_KEY=your_openrouter_key
   ```

4. Create the database:
   ```sql
   CREATE DATABASE worldend;
   ```

5. Start the server:
   ```bash
   node index.js
   ```

The application will be available at `http://localhost:3000`.

## 📡 API Usage

The project provides a public API with rate limiting (100 requests per 15 minutes per IP). API documentation is available at `/docs` when running the server.

Example endpoints:
- GET `/api/latest` - Get the latest probability data
- GET `/api/history` - Get historical probability data

## 🔧 Configuration

You can modify the following settings in `index.js`:
- Update interval (default: 6 hours)
- Rate limiting parameters
- Maximum history records
- Port number

## 📊 Analytics

The project uses Umami for anonymous usage statistics. You can:
- Disable analytics by removing the Umami script from `index.html`
- Replace it with your own analytics solution
- Self-host Umami

## 🤝 Contributing

While this project is not open for commercial use, you're welcome to:
1. Report bugs
2. Suggest improvements
3. Submit pull requests

Please read the [LICENSE](LICENSE) file for details on usage restrictions.

## ⚠️ Disclaimer

This is an educational project that uses AI to analyze news and generate probabilities. The results are speculative and should not be taken as definitive predictions or cause for panic.

## 📄 License

This project is licensed under a custom license that allows personal use and self-hosting but restricts commercial use. See the [LICENSE](LICENSE) file for details.


## 📧 Contact

For questions and support, please use the [GitHub Issues](https://github.com/Neotastisch/HowCloseToWorldEnd/issues) page.

Made with <3 by Neo
 
