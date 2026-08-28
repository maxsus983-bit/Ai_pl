require('dotenv').config();

module.exports = {
  server: {
    host: process.env.MC_HOST || 'ai_player.aternos.me',
    port: parseInt(process.env.MC_PORT, 10) || 15568,
    version: process.env.MC_VERSION || '1.12.2'
  },
  swarm: {
    count: parseInt(process.env.AI_COUNT, 10) || 10,
    names: [
      'KAITO', 'ROZA', 'SARA', 'AKIRA', 'REN', 
      'YUKI', 'RAI', 'HANA', 'KIRA', 'SHIN',
      'ALEX', 'TAKA', 'LUNA', 'ZACK', 'MIA',
      'NORA', 'IVAN', 'YURI', 'ZEUS', 'HERA'
    ]
  },
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY || '',
    model: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3-8b-instruct:free',
    baseUrl: 'https://openrouter.ai/api/v1/chat/completions'
  },
  performance: {
    decisionIntervalMs: 3000,
    debugMode: process.env.DEBUG_MODE === 'true'
  },
  db: {
    path: './data/civilization.db'
  }
};
    
