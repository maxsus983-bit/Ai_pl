class Personality {
  constructor() {
    this.courage = Math.random() * 0.8 + 0.1;
    this.friendliness = Math.random() * 0.8 + 0.1;
    this.aggression = Math.random() * 0.8 + 0.1;
  }

  getSummary() {
    return `Courage: ${this.courage.toFixed(2)}, Friendliness: ${this.friendliness.toFixed(2)}, Aggression: ${this.aggression.toFixed(2)}`;
  }
}

module.exports = Personality;
