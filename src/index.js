require('dotenv').config(); // Agar .env fayldan ma'lumot o'qish kerak bo'lsa
const AIAgent = require('./ai/agent');

console.log('[SYSTEM] Minecraft AI Agent ishga tushirilmoqda...');

try {
    // Bitta universal bot yaratamiz (Mining, Building, PvP va Chatni o'zi bajaradi)
    const botAgent = new AIAgent('ROZA', 'Universal');
    
    // Agentni ishga tushirish
    botAgent.init();
    
    console.log('[SYSTEM] ROZA agenti muvaffaqiyatli ishga tushdi va serverga ulanishga urunmoqda.');
} catch (error) {
    console.error('[CRITICAL ERROR] Botni ishga tushirishda xatolik yuz berdi:', error);
}
