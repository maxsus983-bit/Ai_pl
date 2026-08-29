const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
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
    this.faction = 'Neutral'; // Do'st, Dushman yoki Neutral
    this.bot = null;
    this.personality = new Personality();
    this.isBusy = false;
    this.reconnectAttempts = 0;
    this.targetPlayerToFollow = null; // Kimga ergashish kerakligi
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
        version: config.server.version
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
      console.log(`[AGENT SPAWNED] 🚀 ${this.name} serverga kirdi va tiriklikni boshladi!`);
      this.reconnectAttempts = 0;

      const mcData = require('minecraft-data')(bot.version);
      bot.pathfinder.setMovements(new Movements(bot, mcData));
      
      if (bot.autoEat) {
        bot.autoEat.enable(); // Och qolganda avtomatik ovqat yeydi
      }

      // Doimiy aql va harakat sikli (har 4 soniyada bir ishlaydi)
      setInterval(() => this.decisionCycle(), 4000);
    });

    // Kimdir gapirganda yoki buyruq berganda
    bot.on('chat', async (username, message) => {
      if (username === this.name) return;
      const msgLower = message.toLowerCase();

      try {
        await FactionManager.processSocialInteraction(this.name, username, message);
      } catch (e) {}

      // 1. ERGASHISH BUYRUG'I ("menga ergash", "follow me")
      if (msgLower.includes('ergash') || msgLower.includes('follow')iliyuv) {
        const player = bot.players[username]?.entity;
        if (player) {
          this.targetPlayerToFollow = username;
          bot.chat(`Xo'p bo'ladi, ${username}, ortingdan ergashaman.`);
          return;
        }
      }

      // 2. TO'XTASH BUYRUG'I ("to'xta", "stop")
      if (msgLower.includes('toxta') || msgLower.includes('stop') || msgLower.includes("to'xta")) {
        this.targetPlayerToFollow = null;
        bot.pathfinder.setGoal(null);
        bot.chat(`To'xtadim, ${username}.`);
        return;
      }

      // 3. BUYUM SO'RASH ("menga ... ber", "give me")
      if (msgLower.includes('ber') || msgLower.includes('give')) {
        // Xarakterining do'stligiga qarab buyum berish yoki rad etish
        if (this.personality.friendliness > 50 || Math.random() > 0.4) {
          bot.chat(`Mayli, buni senga beraman.`);
          // Qo'lidagi biror narsani o'yinga tashlab berish
          const item = bot.inventory.items()[0];
          if (item) {
            bot.toss(item.type, null, 1, () => {});
          }
        } else {
          bot.chat(`Yo'q, buni o'zimga kerak, bermayman!`);
        }
        return;
      }

      // 4. ODDIY AI SUHBAT VA MUNOSABAT (Do'st yoki Dushman bo'lishi)
      if (message.includes(this.name) || Math.random() < 0.2) {
        try {
          const memories = await db.getMemories(this.name, 3).catch(() => []);
          const memoryText = memories.map(m => m.event_description).join('; ');

          const systemPrompt = `You are ${this.name}, an autonomous, living AI citizen in Minecraft.
Personality - Courage: ${this.personality.courage}, Friendliness: ${this.personality.friendliness}, Aggression: ${this.personality.aggression}.
Role: ${this.role}.
You can choose to be friendly, hostile, or neutral towards players depending on your personality.
Reply in Uzbek language in 1 short, natural sentence.`;

          const userPrompt = `${username} said: "${message}". Respond with your own free will.`;
          const reply = await queryOpenRouter(systemPrompt, userPrompt);

          if (reply) {
            bot.chat(reply);
            // Agar tajovuzkorligi juda baland bo'lsa, dushmanlik qilishi mumkin
            if (this.personality.aggression > 80 && Math.random() < 0.3) {
              const player = bot.players[username]?.entity;
              if (player && this.combat) {
                bot.chat(`Seni yoqtirmayapman!`);
                this.combat.attack(player);
              }
            }
          }
        } catch (chatErr) {}
      }
    });

    bot.on('end', (reason) => {
      console.log(`[DISCONNECTED] Uzildi: ${reason}. Qayta ulanmoqda...`);
      this.retryConnection();
    });

    bot.on('error', (err) => {
      console.error(`[ERROR]:`, err.message);
    });
  }

  retryConnection() {
    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectAttempts * 5000, 30000);
    setTimeout(() => this.connectBot(), delay);
  }

  // MUSTAQIL HARAKAT VA OMON QOLISH SIKLI
  async decisionCycle() {
    if (this.isBusy || !this.bot || !this.bot.entity) return;
    this.isBusy = true;

    try {
      const bot = this.bot;

      // 1. Agar kimgadir ergashish buyurilgan bo'lsa, o'sha o'yinchini topib ketadi
      if (this.targetPlayerToFollow) {
        const targetPlayer = bot.players[this.targetPlayerToFollow]?.entity;
        if (targetPlayer) {
          bot.pathfinder.setGoal(new goals.GoalFollow(targetPlayer, 2), true);
          this.isBusy = false;
          return;
        }
      }

      // 2. DUSHMANLAR YOKI MOB LAR BILAN KURASH (PvP / Self-Defense)
      const enemy = bot.nearestEntity(entity => {
        return (entity.type === 'mob' && entity.username !== this.name) || 
               (entity.type === 'player' && entity.username !== this.name && this.personality.aggression > 70);
      });

      if (enemy && bot.entity.position.distanceTo(enemy.position) < 8) {
        console.ch && console.log(`[COMBAT] Dushman topildi, jang boshlandi!`);
        if (this.combat && typeof this.combat.attack === 'function') {
          this.combat.attack(enemy);
          this.isBusy = false;
          return;
        }
      }

      // 3. ERKIN HARAKAT VA RESURS / QURILISH (Wander, Mine, Build)
      const actions = ['wander', 'mine', 'build'];
      const chosenAction = actions[Math.floor(Math.random() * actions.length)];

      if (chosenAction === 'wander') {
        // Atrofni o'zi kashf qilib kezib yuradi
        const range = 10;
        const pos = bot.entity.position;
        const tx = pos.x + (Math.floor(Math.random() * (range * 2)) - range);
        const tz = pos.z + (Math.floor(Math.random() * (range * 2)) - range);
        
        bot.pathfinder.setGoal(new goals.GoalNear(tx, pos.y, tz, 1));

      } else if (chosenAction === 'mine' && this.builder) {
        // O'zi uchun resurs yig'adi
        await this.builder.mineWood();

      } else if (chosenAction === 'build' && this.builder) {
        // O'zi uy yoki tuzilma qurishga urinadi
        console.log(`[BUILD] Bot o'zi uchun boshpana qurmoqda...`);
        // Builder moduli ichidagi qurish funksiyasi ishlaydi
      }

    } catch (err) {
      // Xatoliklarni yutib yuboradi, ishlashdan to'xtamaydi
    } finally {
      this.isBusy = false;
    }
  }
}

module.exports = AIAgent;
                                    
