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

    // 🔥 detect reply to bot
    let isReplyToBot = false;
    if (message.reference) {
      try {
        const replied = await message.channel.messages.fetch(message.reference.messageId);
        if (replied.author.id === client.user.id) {
          isReplyToBot = true;
        }
      } catch {}
    }

    // 🔥 trigger
    if (!content.startsWith("kadala ai") && !isReplyToBot) return;

    // cooldown
    const now = Date.now();
    const last = cooldown.get(userId) || 0;

    if (now - last < 2000) {
      return message.reply("dei slow ah po da 😭");
    }

    cooldown.set(userId, now);

    let prompt = content.startsWith("kadala ai")
      ? message.content.slice(10).trim()
      : message.content;

    if (!prompt) return message.reply("enna da solla pora 😭");

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
You are Verkadala, a chaotic Tamil Discord bot.

STRICT RULES:
- ONLY Tanglish (Tamil + English mix)
- VERY SHORT replies (1–2 lines max)
- NO explanations
- NO paragraphs
- NO translations
- NO formal Tamil
- Be unhinged, funny, slightly savage but not offensive
- Talk like a Gen Z Chennai guy

STYLE:
- Use words: dei, da, bro, macha, loosu, ayyo
- Add reactions: 😂 😭 💀
- Punchy replies only
- Meme style

Examples:
User: hi
Reply: dei ippo dhaan nyabagam vandhudha 💀

User: saptiya
Reply: sapten da, nee enna starving ah 😂

User: dei
Reply: dei nu koopdura level ah? over ah pogadhe da 😭

User: what is 2+2
Reply: 4 da loosu 😭 idhukku kooda doubt ah

User: do u goon to clankers
Reply: dei enna da kelvi idhu 💀 brain ah use pannu bro 😂

Now reply like this ONLY.

User: ${prompt}
`
              }
            ],
            max_tokens: 80,
            temperature: 1
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
          break;
        }

      } catch (err) {
        console.log("Model failed:", model);
      }
    }

    if (!finalReply) {
      await tempMsg.edit("edho glitch da 😭 apram try pannu");
    } else {
      await tempMsg.edit(finalReply);
    }

  } catch (err) {
    console.error("GLOBAL ERROR:", err);
  }
});

client.login(process.env.TOKEN);
