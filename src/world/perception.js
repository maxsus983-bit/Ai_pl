class Perception {
  constructor(bot) {
    this.bot = bot;
  }

  getSurroundings() {
    if (!this.bot || !this.bot.entity) return null;
    return {
      health: this.bot.health,
      food: this.bot.food,
      position: this.bot.entity.position.floored()
    };
  }
}

module.exports = Perception;
