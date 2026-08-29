const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { plugin: pvp } = require('mineflayer-pvp');

const autoEatPlugin = require('mineflayer-auto-eat');
const autoEat = autoEatPlugin.plugin ? autoEatPlugin.plugin : autoEatPlugin;

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
    this.targetPlayerToFollow = null;
    this.isSpawned = false;
  }

  async init() {
    console.log(`[INIT] ${this.name} agentini ishga tushirish jarayoni boshlandi...`);

    try {
      await db.saveAgent({
        name: this.name,
        courage: this.personality.courage,
        friendliness: this.personality.friendliness,
        aggression: this.personality.aggression,
        role: this.role,
        faction: this.faction
      });
    } catch (dbErr) {
      console.error(`[DB Warning]:`, dbErr.message);
    }

    this.connectBot();
  }

  connectBot() {
    console.log(`[CONNECT] Serverga ulanmoqda: ${config.server.host}:${config.server.port} (${this.name})`);

    try {
      this.bot = mineflayer.createBot({
        host: config.server.host,
        port: config.server.port,
        username: this.name,
        version: config.server.version,
        checkTimeoutInterval: 120000, // Aternos kick qilmasligi uchun vaqtni 2 daqiqaga uzaytiramiz
        hideErrors: false
      });
    } catch (botErr) {
      console.error(`[CRITICAL] Botni yaratishda xatolik:`, botErr.message);
      this.retryConnection();
      return;
    }

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
      console.log(`[AGENT SPAWNED] 🚀 ${this.name} serverga muvaffaqiyatli kirdi!`);
      this.reconnectAttempts = 0;
      this.isSpawned = true;

      const mcData = require('minecraft-data')(bot.version);
      bot.pathfinder.setMovements(new Movements(bot, mcData));
      
      if (bot.autoEat) {
        bot.autoEat.enable();
      }

      // Harakat va qarorlar sikli (serverni qiynamaslik uchun vaqtni 7 soniyaga uzaytirdik)
      if (!this.decisionInterval) {
        this.decisionInterval = setInterval(() => this.decisionCycle(), 7000);
      }

      // Chatga o'zi gapirish (har 60 soniyada)
      if (!this.chatInterval) {
        this.chatInterval = setInterval(() => {
          this.sendAutonomousChat();
        }, 60000);
      }
    });

    bot.on('chat', async (username, message) => {
      if (username === this.name) return;
      const msgLower = message.toLowerCase();

      try {
        await FactionManager.processSocialInteraction(this.name, username, message);
      } catch (e) {}

      // 1. Ergashish buyrug'i
      if (msgLower.includes('ergash') || msgLower.includes('follow')) {
        const player = bot.players[username]?.entity;
        if (player) {
          this.targetPlayerToFollow = username;
          bot.chat(`Xo'p bo'ladi, ${username}, ortingdan ergashaman.`);
          return;
        }
      }

      // 2. To'xtash buyrug'i
      if (msgLower.includes('toxta') || msgLower.includes('stop') || msgLower.includes("to'xta")) {
        this.targetPlayerToFollow = null;
        bot.pathfinder.setGoal(null);
        bot.chat(`To'xtadim, ${username}.`);
        return;
      }

      // 3. Buyum so'rash
      if (msgLower.includes('ber') || msgLower.includes('give')) {
        if (this.personality.friendliness > 50 || Math.random() > 0.4) {
          bot.chat(`Mayli, buni senga beraman.`);
          const item = bot.inventory.items()[0];
          if (item) {
            bot.toss(item.type, null, 1, () => {});
          }
        } else {
          bot.chat(`Yo'q, buni o'zimga kerak, bermayman!`);
        }
        return;
      }

      // 4. AI orqali suhbat
      if (message.includes(this.name) || Math.random() < 0.25) {
        try {
          const systemPrompt = `You are ${this.name}, an autonomous AI citizen in Minecraft.
Personality - Courage: ${this.personality.courage}, Friendliness: ${this.personality.friendliness}, Aggression: ${this.personality.aggression}.
Role: ${this.role}.
Reply in Uzbek language in 1 short, natural sentence.`;

          const userPrompt = `${username} said: "${message}". Respond naturally as a player.`;
          const reply = await queryOpenRouter(systemPrompt, userPrompt);

          if (reply) {
            bot.chat(reply);
          }
        } catch (chatErr) {}
      }
    });

    bot.on('end', (reason) => {
      console.log(`[DISCONNECTED] Uzildi: ${reason}. Qayta ulanmoqda...`);
      this.cleanup();
      this.retryConnection();
    });

    bot.on('error', (err) => {
      console.error(`[ERROR]:`, err.message);
    });
  }

  cleanup() {
    this.isSpawned = false;
    this.targetPlayerToFollow = null;
    if (this.decisionInterval) {
      clearInterval(this.decisionInterval);
      this.decisionInterval = null;
    }
    if (this.chatInterval) {
      clearInterval(this.chatInterval);
      this.chatInterval = null;
    }
  }

  async sendAutonomousChat() {
    if (!this.isSpawned || !this.bot || !this.bot.entity) return;
    try {
      const systemPrompt = `You are ${this.name}, an autonomous AI living in Minecraft. 
Write a short, casual thought or message in Uzbek language to say out loud in chat (max 1 sentence).`;
      
      const reply = await queryOpenRouter(systemPrompt, "Say something about what you are doing or feeling right now.");
      if (reply) {
        this.bot.chat(reply);
      }
    } catch (e) {}
  }

  retryConnection() {
    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectAttempts * 10000, 60000); // Har safar vaqtni asta-sekin uzaytiramiz
    console.log(`[RECONNECT] ${delay / 1000} soniyadan keyin qayta ulaniladi...`);
    setTimeout(() => this.connectBot(), delay);
  }

  async decisionCycle() {
    if (!this.isSpawned || !this.bot || !this.bot.entity) return;
    if (this.isBusy) return;
    this.isBusy = true;

    try {
      const bot = this.bot;

      // 1. Ergashish
      if (this.targetPlayerToFollow) {
        const targetPlayer = bot.players[this.targetPlayerToFollow]?.entity;
        if (targetPlayer) {
          if (bot.entity.position.distanceTo(targetPlayer.position) > 3) {
            bot.pathfinder.setGoal(new goals.GoalFollow(targetPlayer, 2), true);
          }
          this.isBusy = false;
          return;
        }
      }

      // 2. Dushmanlardan qochish / jang
      const enemy = bot.nearestEntity(entity => {
        return (entity.type === 'mob' && entity.username !== this.name) || 
               (entity.type === 'player' && entity.username !== this.name && this.personality.aggression > 70);
      });

      if (enemy && bot.entity.position.distanceTo(enemy.position) < 8) {
        if (this.combat && typeof this.combat.attack === 'function') {
          this.combat.attack(enemy);
          this.isBusy = false;
          return;
        }
      }

      // 3. Erkin harakat (Faqat to'xtab turganda yangi yo'l oladi)
      if (!bot.pathfinder.isMoving()) {
        const range = 10;
        const pos = bot.entity.position;
        const tx = Math.floor(pos.x + (Math.random() * (range * 2) - range));
        const tz = Math.floor(pos.z + (Math.random() * (range * 2) - range));
        
        bot.pathfinder.setGoal(new goals.GoalNear(tx, pos.y, tz, 1));
      }

    } catch (err) {
    } finally {
      setTimeout(() => {
        this.isBusy = false;
      }, 4000);
    }
  }
}

module.exports = AIAgent;
            
