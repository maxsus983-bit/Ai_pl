class CombatEngine {
  constructor(bot) {
    this.bot = bot;
  }

  handleThreats(surroundings) {
    return { action: 'NONE' };
  }
}

module.exports = CombatEngine;
