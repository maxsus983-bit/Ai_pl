const fetch = require('node-fetch');
const config = require('../../config/config');

async function queryOpenRouter(systemPrompt, userPrompt) {
  if (!config.openrouter.apiKey) {
    return null;
  }

  try {
    const response = await fetch(config.openrouter.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.openrouter.apiKey}`,
        'HTTP-Referer': 'https://github.com/minecraft-ai-civilization',
        'X-Title': 'Minecraft AI Civilization',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.openrouter.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 120
      })
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (err) {
    return null;
  }
}

module.exports = { queryOpenRouter };
