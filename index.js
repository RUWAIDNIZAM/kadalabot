const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const axios = require('axios');

// KEEP ALIVE
const app = express();
app.get("/", (req, res) => res.send("Bot alive"));
app.listen(process.env.PORT || 3000);

// DISCORD
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const cooldown = new Map();

// 🔥 MODELS (fallback)
const MODELS = [
  "meta-llama/llama-3-8b-instruct",
  "google/gemma-7b-it"
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

    // ================= DETECT REPLY TO BOT =================
    let isReplyToBot = false;

    if (message.reference) {
      const replied = await message.channel.messages.fetch(message.reference.messageId);
      if (replied.author.id === client.user.id) {
        isReplyToBot = true;
      }
    }

    // ================= TRIGGER =================
    if (!content.startsWith("kadala ai") && !isReplyToBot) return;

    // ================= COOLDOWN =================
    const now = Date.now();
    const last = cooldown.get(userId) || 0;

    if (now - last < 3000) {
      return message.reply("dei dei slow down da");
    }

    cooldown.set(userId, now);

    // ================= PROMPT =================
    let prompt = content.startsWith("kadala ai")
      ? message.content.slice(10).trim()
      : message.content;

    if (!prompt) return message.reply("enna kekka pora sollu");

    // ================= WAIT MESSAGE =================
    const tempMsg = await message.reply("oru nimisham...");

    let finalReply = null;

    for (const model of MODELS) {
      try {
        const res = await axios.post(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            model,
            messages: [
              {
                role: "user",
                content: `
You are Verkadala, a Chennai Tamil Discord bot.

STRICT RULES:
- ONLY Tanglish (Tamil + English mix)
- NO full English replies
- NO pure Tamil
- NO translations
- First give correct answer, then add fun tone

STYLE:
- Casual, like college friend
- Use words: dei, da, bro, macha
- Medium length
- Natural flow

Examples:
User: hi
Reply: dei enna da ippo dhaan online ah 😂

User: saptiya
Reply: sapten da bro, nee enna panra ippo?

User: what is 2+2
Reply: 2+2 = 4 da bro, idhukku kooda doubt ah 😂

Now reply properly.

User: ${prompt}
`
              }
            ],
            max_tokens: 200,
            temperature: 0.7
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

        const reply = res.data?.choices?.[0]?.message?.content;

        if (reply) {
          finalReply = reply;
          break;
        }

      } catch (err) {
        console.log("Model failed:", model);
      }
    }

    // ================= FINAL RESPONSE =================
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
