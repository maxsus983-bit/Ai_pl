const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const config = require('../../config/config');

const dbDir = path.dirname(config.db.path);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(config.db.path);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS agents (
    name TEXT PRIMARY KEY,
    courage REAL,
    friendliness REAL,
    aggression REAL,
    role TEXT,
    faction TEXT,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_name TEXT,
    event_description TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS relationships (
    agent_name TEXT,
    target_name TEXT,
    score INTEGER DEFAULT 0,
    PRIMARY KEY (agent_name, target_name)
  )`);
});

module.exports = {
  db,
  getAgent: (name) => new Promise((resolve, reject) => {
    db.get(`SELECT * FROM agents WHERE name = ?`, [name], (err, row) => err ? reject(err) : resolve(row));
  }),
  saveAgent: (agent) => new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO agents (name, courage, friendliness, aggression, role, faction) 
       VALUES (?, ?, ?, ?, ?, ?) 
       ON CONFLICT(name) DO UPDATE SET role=excluded.role, faction=excluded.faction`,
      [agent.name, agent.courage, agent.friendliness, agent.aggression, agent.role, agent.faction],
      (err) => err ? reject(err) : resolve()
    );
  }),
  addMemory: (agentName, desc) => new Promise((resolve, reject) => {
    db.run(`INSERT INTO memories (agent_name, event_description) VALUES (?, ?)`, [agentName, desc], (err) => err ? reject(err) : resolve());
  }),
  getMemories: (agentName, limit = 3) => new Promise((resolve, reject) => {
    db.all(`SELECT event_description FROM memories WHERE agent_name = ? ORDER BY id DESC LIMIT ?`, [agentName, limit], (err, rows) => err ? reject(err) : resolve(rows || []));
  }),
  getRelationship: (agentName, targetName) => new Promise((resolve, reject) => {
    db.get(`SELECT score FROM relationships WHERE agent_name = ? AND target_name = ?`, [agentName, targetName], (err, row) => err ? reject(err) : resolve(row ? row.score : 0));
  }),
  updateRelationship: (agentName, targetName, delta) => new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO relationships (agent_name, target_name, score) VALUES (?, ?, ?) 
       ON CONFLICT(agent_name, target_name) DO UPDATE SET score = score + ?`,
      [agentName, targetName, delta, delta],
      (err) => err ? reject(err) : resolve()
    );
  })
};
         
