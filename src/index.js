require('dotenv').config();
const AIAgent = require('./ai/agent');

console.log('[SYSTEM] Minecraft AI Agent ishga tushirilmoqda...');

try {
    const botAgent = new AIAgent('ROZA', 'Universal');
    botAgent.init();
    
    console.log('[SYSTEM] ROZA agenti ishga tushdi va serverga ulanmoqda...');
} catch (error) {
    console.error('[CRITICAL ERROR] Botni ishga tushirishda xatolik:', error);
}
