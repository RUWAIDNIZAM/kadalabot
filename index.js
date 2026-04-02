// AI COMMAND
if (content.startsWith("kadala ai")) {
  const now = Date.now();
  const last = cooldown.get(userId) || 0;

  if (now - last < 3000) {
    return message.reply("dei dei slow down da");
  }

  cooldown.set(userId, now);

  const prompt = message.content.slice(10).trim();

  if (!prompt) {
    return message.reply("enna kekka pora sollu");
  }

  try {
    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `You are Verkadala, a Tamil Discord bot. Reply in casual Tamil slang (Tanglish), short and natural.\nUser: ${prompt}`
              }
            ]
          }
        ]
      }
    );

    const reply =
      res.data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!reply) {
      return message.reply("response illa");
    }

    message.reply(reply);

  } catch (err) {
    console.error("AI ERROR FULL:", JSON.stringify(err.response?.data, null, 2));
    message.reply("edho problem iruku, apram try pannu");
  }
}
