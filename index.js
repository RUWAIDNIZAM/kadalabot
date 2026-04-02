const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const axios = require('axios');

// KEEP ALIVE
const app = express();
app.get("/", (req, res) => res.send("Bot alive"));
app.listen(process.env.PORT || 3000);

// DISCORD BOT
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const cooldown = new Map();

// 🔥 MODELS (auto fallback)
const MODELS = [
  "meta-llama/llama-3-8b-instruct",
  "google/gemma-7b-it",
  "mistralai/mistral-7b-instruct"
];

client.once('clientReady', () => {
  console.log("Verkadala is running");
});

client.on('messageCreate', async (message) => {
  try {
    if (message.author.bot) return;
    if (!message.content) return;

    const content = message.content.toLowerCase();
    const userId = message.author.id;

    if (!content.startsWith("kadala ai")) return;

    // cooldown
    const now = Date.now();
    const last = cooldown.get(userId) || 0;

    if (now - last < 3000) {
      return message.reply("dei dei slow down da");
    }

    cooldown.set(userId, now);

    const prompt = message.content.slice(10).trim();
    if (!prompt) return message.reply("enna kekka pora sollu");

    const tempMsg = await message.reply("oru nimisham...");

    let finalReply = null;

    for (const model of MODELS) {
      try {
        console.log("Trying:", model);

        const res = await axios.post(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            model,
            messages: [
              {
                role: "user",
                content: `
You are Verkadala, a funny Tamil Discord bot.

Rules:
- Reply ONLY in casual Tamil slang (Tanglish)
- Be funny, slightly savage, but friendly
- Do NOT be too short
- Do NOT give boring replies
- Add attitude and personality
- Make replies feel human, not robotic

Examples:
User: hi
Reply: dei enna da ippo dhaan online ah?

User: what doing
Reply: inga waste ah iruken da, nee enna panra?

User: dei
Reply: dei nu koopdura alavukku close ah? 😏

Now reply properly.

User: ${prompt}
`
              }
            ],
            max_tokens: 200,
            temperature: 0.9
          },
          {
            headers: {
              "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://kadalabot.onrender.com",
              "X-Title": "Verkadala Bot"
            },
            timeout: 10000
          }
        );

        const reply = res.data?.choices?.[0]?.message?.content;

        if (reply) {
          finalReply = reply;
          console.log("SUCCESS:", model);
          break;
        }

      } catch (err) {
        console.log("FAILED:", model);
      }
    }

    if (!finalReply) {
      await tempMsg.edit("edho problem iruku, apram try pannu");
    } else {
      await tempMsg.edit(finalReply);
    }

  } catch (err) {
    console.error("GLOBAL ERROR:", err);
  }
});

client.login(process.env.TOKEN);
