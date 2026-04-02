const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const axios = require('axios');

// KEEP ALIVE
const app = express();
app.get("/", (req, res) => res.send("Bot alive"));
app.listen(process.env.PORT || 3000, () => {
  console.log("Web server running...");
});

// DISCORD BOT
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const cooldown = new Map();

client.on('clientReady', () => {
  console.log("Verkadala is running");
});

// ✅ ASYNC FIX HERE
client.on('messageCreate', async (message) => {
  try {
    if (message.author.bot) return;
    if (!message.content) return;

    const content = message.content.toLowerCase();
    const userId = message.author.id;

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

      // 👇 wait message
      const tempMsg = await message.reply("oru nimisham...");

      try {
        const res = await axios.post(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            model: "mistralai/mistral-7b-instruct",
            messages: [
              {
                role: "user",
                content: `Reply in Tamil slang.\nUser: ${prompt}`
              }
            ]
          },
          {
            headers: {
              "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
              "Content-Type": "application/json"
            }
          }
        );

        const reply = res.data.choices[0].message.content;

        await tempMsg.edit(reply);

      } catch (err) {
        console.error("AI ERROR:", err.response?.data || err.message);
        await tempMsg.edit("edho problem iruku, apram try pannu");
      }
    }

  } catch (err) {
    console.error("GLOBAL ERROR:", err);
  }
});

client.login(process.env.TOKEN);
