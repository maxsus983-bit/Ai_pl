const mineflayer = require('mineflayer');
const { pathfinder, Movements } = require('mineflayer-pathfinder');
const { plugin: pvp } = require('mineflayer-pvp');
const autoEat = require('mineflayer-auto-eat').plugin;
const config = require('../../config/config');
const db = require('../database/db');
const Personality = require('./personality');
const Perception = require('../world/perception');
const Builder = require('../building/builder');
const CombatEngine = require('../combat/combat');
const FactionManager = require('../civilization/faction');
const { queryOpenRouter } = require('./llm');

class AIAgent {
  constructor(name, role = 'Universal') {
    this.name = name;
    this.role = role;
    this.faction = 'Neutral';
    this.bot = null;
    this.personality = new Personality();
    this.isBusy = false;
    this.reconnectAttempts = 0;
  }

  async init() {
    console.log(`[INIT] ${this.name} agentini ishga tushirish jarayoni boshlandi...`);

    // Bazaga saqlash jarayoni xatolik bersa ham to'xtab qolmasligi uchun try-catchga olindi
    try {
      await db.saveAgent({
        name: this.name,
        courage: this.personality.courage,
        friendliness: this.personality.friendliness,
        aggression: this.personality.aggression,
        role: this.role,
        faction: this.faction
      });
      console.log(`[DB] ${this.name} ma'lumotlari bazaga muvaffaqiyatli saqlandi.`);
    } catch (dbErr) {
      console.error(`[DB Warning] Bazaga saqlashda xatolik (davom etaveradi):`, dbErr.message);
    }

    this.connectBot();
  }

  connectBot() {
    console.log(`[CONNECT] Minecraft serveriga ulanmoqda: ${config.server.host}:${config.server.port} (${this.name})`);

    try {
      this.bot = mineflayer.createBot({
        host: config.server.host,
        port: config.server.port,
        username: this.name,
        version: config.server.version
      });
    } catch (botErr) {
      console.error(`[CRITICAL] Botni yaratishda xatolik:`, botErr.message);
      this.retryConnection();
      return;
    }

    // Plaginlarni ulash
    this.bot.loadPlugin(pathfinder);
    this.bot.loadPlugin(pvp);
    this.bot.loadPlugin(autoEat);
    
    this.perception = new Perception(this.bot);
    this.builder = new Builder(this.bot);
    this.combat = new CombatEngine(this.bot);

    this.setupEvents();
  }

  setupEvents() {
    const bot = this.bot;

    bot.once('spawn', () => {
      console.log(`[AGENT SPAWNED] 🚀 ${this.name} (${this.role}) serverga muvaffaqiyatli kirdi!`);
      this.reconnectAttempts = 0; // Ulangach urinishlar soni nollanadi

      const mcData = require('minecraft-data')(bot.version);
      bot.pathfinder.setMovements(new Movements(bot, mcData));
      if (bot.autoEat) {
        bot.autoEat.enable();
      }

      // Doimiy harakat va qaror qabul qilish sikli
      setInterval(() => this.decisionCycle(), config.performance?.decisionIntervalMs || 5000);
    });

    // Serverdan uzilib qolsa yoki kick qilinsa, qayta ulanish mexanizmi
    bot.on('end', (reason) => {
      console.log(`[DISCONNECTED] Bot serverdan uzildi. Sabab: ${reason}`);
      this.retryConnection();
    });

    bot.on('error', (err) => {
      console.error(`[BOT ERROR]`, err.message);
    });

    bot.on('chat', async (username, message) => {
      if (username === this.name) return;

      try {
        await FactionManager.processSocialInteraction(this.name, username, message);
      } catch (e) {
        // Ijtimoiy o'zaro ta'sir xatosini yutib yuboramiz
      }

      if (message.includes(this.name) || Math.random() < 0.15) {
        try {
          const memories = await db.getMemories(this.name, 3).catch(() => []);
          const memoryText = memories.map(m => m.event_description).join('; ');

          const systemPrompt = `You are ${this.name}, an autonomous AI citizen in Minecraft.
Personality: ${this.personality.getSummary()}.
Role: ${this.role}.
Recent memories: ${memoryText}.
Reply in Uzbek language in 1 short, natural sentence.`;

          const userPrompt = `${username} said: "${message}". Respond naturally.`;
          const reply = await queryOpenRouter(systemPrompt, userPrompt);

          if (reply) {
            bot.chat(reply);
          }
        } catch (chatErr) {
          console.error('[Chat AI Error]:', chatErr.message);
        }
      }
    });
  }

  retryConnection() {
    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectAttempts * 5000, 30000); // Har safar vaqtni uzaytirib boradi (max 30 sek)
    console.log(`[RECONNECT] ${delay / 1000} soniyadan keyin qayta ulanishga harakat qilinadi... (Urinish: ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connectBot();
    }, delay);
  }

  async decisionCycle() {
    if (this.isBusy || !this.bot || !this.bot.entity) return;
    this.isBusy = true;

    try {
      // Universal bot vazifalari: Agar xavf bo'lmasa resurs yig'adi yoki quradi
      if (this.role === 'Universal' || this.role === 'Builder' || this.role === 'Miner') {
        if (this.builder && typeof this.builder.mineWood === 'function') {
          await this.builder.mineWood();
        }
      }
    } catch (err) {
      // Routine xatoliklarni tashlab yuboradi
    } finally {
      this.isBusy = false;
    }
  }
}

module.exports = AIAgent;
        
