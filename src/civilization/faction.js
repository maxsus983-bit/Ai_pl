const db = require('../database/db');

class FactionManager {
  static async processSocialInteraction(agentName, targetName, message) {
    let delta = 0;
    const text = message.toLowerCase();
    if (text.includes('salom') || text.includes('yordam') || text.includes('dost')) {
      delta = 10;
    } else if (text.includes('dushman') || text.includes('hujum')) {
      delta = -15;
    }

    if (delta !== 0) {
      await db.updateRelationship(agentName, targetName, delta);
      await db.addMemory(agentName, `Chat interaction with ${targetName}: "${message}"`);
    }
  }
}

module.exports = FactionManager;
