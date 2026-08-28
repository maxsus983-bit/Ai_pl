class Builder {
  constructor(bot) {
    this.bot = bot;
  }

  async mineWood() {
    const logBlock = this.bot.findBlock({
      matching: block => block && block.name.includes('log'),
      maxDistance: 16
    });

    if (!logBlock) return { success: false };

    try {
      await this.bot.dig(logBlock);
      return { success: true };
    } catch (err) {
      return { success: false };
    }
  }
}

module.exports = Builder;
