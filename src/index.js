require('dotenv').config();
const AIAgent = require('./ai/agent');

// Konsolga darhol yozish uchun maxsus funksiya
function log(text) {
    console.log(text);
    process.stdout.write(text + '\n');
}

log('[SYSTEM] Minecraft AI Agent ishga tushmoqda...');

try {
    log('[SYSTEM] ROZA agenti obyekti yaratilmoqda...');
    const botAgent = new AIAgent('ROZA', 'Universal');
    
    log('[SYSTEM] Agent init() metodi chaqirilmoqda...');
    botAgent.init();
    
    log('[SYSTEM] Kodyozuv tugadi, bot ulanishga urunmoqda...');
} catch (error) {
    console.error('[CRITICAL ERROR] Ishga tushirishda xatolik:', error);
}
