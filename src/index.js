const config = require('../config/config');
const AIAgent = require('./ai/agent');

console.log('==================================================');
console.log(' MINECRAFT AUTONOMOUS AI CIVILIZATION SYSTEM');
console.log(` Target Server: ${config.server.host}:${config.server.port}`);
console.log(` Target Swarm Size: ${config.swarm.count} AI Agents`);
console.log('==================================================');

async function startSwarm() {
  const count = Math.min(config.swarm.count, config.swarm.names.length);
  const roles = ['Builder', 'Miner', 'Explorer', 'Warrior'];

  for (let i = 0; i < count; i++) {
    const name = config.swarm.names[i];
    const role = roles[i % roles.length];
    const agent = new AIAgent(name, role);

    // Paper serverini qotirib qo'ymaslik uchun botlarni 2.5 sekundlik farq bilan ulaymiz
    await new Promise(resolve => setTimeout(resolve, 2500));
    agent.init();
  }
}

startSwarm().catch(err => console.error('Initialization error:', err));
