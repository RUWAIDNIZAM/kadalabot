// 🤖 AI COMMAND
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

  // ⏳ temp message
  const tempMsg = await message.reply("oru nimisham...");

  try {
    const res = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openchat/openchat-3.5", // ✅ WORKING MODEL
        messages: [
          {
            role: "user",
            content: `Reply in Tamil slang (Tanglish), short and natural.\nUser: ${prompt}`
          }
        ]
      },
      {
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://kadalabot.onrender.com",
          "X-Title": "Verkadala Bot"
        }
      }
    );

    const reply = res.data.choices?.[0]?.message?.content;

    if (!reply) {
      return tempMsg.edit("response illa");
    }

    await tempMsg.edit(reply);

  } catch (err) {
    console.error("FULL ERROR:", err.response?.data || err.message);
    await tempMsg.edit("edho problem iruku, apram try pannu");
  }
}
