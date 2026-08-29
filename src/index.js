const AIAgent = './ai/agent'; // Loyihangiz tuzilishiga qarab yo'lni to'g'rilang
const AIAgentClass = require('./ai/agent');

// Faqat bitta universal bot yaratamiz (u hamma ishni o'zi bajaradi)
const botAgent = new AIAgentClass('ROZA', 'Universal');
botAgent.init();

console.log('[SYSTEM] Universal AI Bot ishga tushdi va serverga ulanmoqda...');
