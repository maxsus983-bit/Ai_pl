const mineflayer = require('mineflayer');
const { pathfinder, Movements } = require('mineflayer-pathfinder');
const { plugin: pvp } = require('mineflayer-pvp');

const autoeat = require('mineflayer-auto-eat').plugin;
const config = require('../../config/config');
const db = require('../database/db');
const Personality = require('./personality');
const Perception = require('../world/perception');
const Builder = require('../building/builder');
const CombatEngine = require('../combat/combat');
const FactionManager = require('../civilization/faction');
const { queryOpenRouter } = require('./llm');

class AIAgent {
  constructor(name, role = 'Builder') {
    this.name = name;
    this.role = role;
    this.faction = 'Neutral';
    this.bot = null;
    this.personality = new Personality();
    this.isBusy = false;
  }

  async init() {
    await db.saveAgent({
      name: this.name,
      courage: this.personality.courage,
      friendliness: this.personality.friendliness,
      aggression: this.personality.aggression,
      role: this.role,
      faction: this.faction
    });

    this.bot = mineflayer.createBot({
      host: config.server.host,
      port: config.server.port,
      username: this.name,
      version: config.server.version
    });

    this.bot.loadPlugin(pathfinder);
    this.bot.loadPlugin(pvp);
    this.bot.loadPlugin(autoeat);

    this.perception = new Perception(this.bot);
    this.builder = new Builder(this.bot);
    this.combat = new CombatEngine(this.bot);

    this.setupEvents();
  }

  setupEvents() {
    const bot = this.bot;

    bot.on('spawn', () => {
      console.log(`[AGENT SPAWNED] ${this.name} (${this.role}) serverga ulandi.`);
      const mcData = require('minecraft-data')(bot.version);
      bot.pathfinder.setMovements(new Movements(bot, mcData));
      bot.autoEat.enable();

      setInterval(() => this.decisionCycle(), config.performance.decisionIntervalMs);
    });

    bot.on('chat', async (username, message) => {
      if (username === this.name) return;

      await FactionManager.processSocialInteraction(this.name, username, message);

      if (message.includes(this.name) || Math.random() < 0.15) {
        const memories = await db.getMemories(this.name, 3);
        const memoryText = memories.map(m => m.event_description).join('; ');

        const systemPrompt = `You are ${this.name}, an autonomous AI citizen in Minecraft 1.12.2.
Personality: ${this.personality.getSummary()}.
Role: ${this.role}.
Recent memories: ${memoryText}.
Reply in Uzbek language in 1 short, natural sentence.`;

        const userPrompt = `${username} said: "${message}". Respond naturally.`;
        const reply = await queryOpenRouter(systemPrompt, userPrompt);

        if (reply) {
          bot.chat(reply);
        }
      }
    });
  }

  async decisionCycle() {
    if (this.isBusy || !this.bot || !this.bot.entity) return;
    this.isBusy = true;

    try {
      if (this.role === 'Builder' || this.role === 'Miner') {
        await this.builder.mineWood();
      }
    } catch (err) {
      // Ignore routine error loops
    } finally {
      this.isBusy = false;
    }
  }
}

module.exports = AIAgent;
  
