const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const express = require('express');
const axios = require('axios');

// 🌐 KEEP ALIVE (Railway)
const app = express();

app.get("/", (req, res) => {
  res.send("Verkadala bot is alive 🌰");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}...`);
});

// 🤖 DISCORD BOT
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const FILE = './afk.json';
let afkUsers = {};
if (fs.existsSync(FILE)) {
  afkUsers = JSON.parse(fs.readFileSync(FILE));
}

// 💾 Save AFK
function saveData() {
  fs.writeFileSync(FILE, JSON.stringify(afkUsers, null, 2));
}

// ⏱️ Time format
function formatTime(ms) {
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);

  if (hr > 0) return `${hr}h ${min % 60}m`;
  if (min > 0) return `${min}m`;
  return `${sec}s`;
}

// 🛑 Cooldown system
const cooldown = new Map();

// ✅ READY
client.on('clientReady', () => {
  console.log("🌰 Verkadala is watching kadala...");
});

// 💬 MAIN
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  const userId = message.author.id;
  const content = message.content.toLowerCase();

  // 🟢 REMOVE AFK
  if (afkUsers[userId]) {
    const time = Date.now() - afkUsers[userId].time;
    const duration = formatTime(time);

    delete afkUsers[userId];
    saveData();

    message.reply(
      `👀 ${message.author.username} AFK la ${duration} irundhaan 😴\nvera level comeback 😎🔥`
    );
  }

  // 🟡 SET AFK
  if (content.startsWith("kadala afk")) {
    const reason = message.content.slice(11).trim() || "no reason 😴";

    afkUsers[userId] = {
      reason: reason,
      time: Date.now()
    };

    saveData();

    return message.reply(
      `🌰 seri po… AFK set panniten 😴\nReason: ${reason} 😎`
    );
  }

  // 🤖 AI COMMAND
  if (content.startsWith("kadala ai")) {
    const now = Date.now();
    const last = cooldown.get(userId) || 0;

    if (now - last < 3000) {
      return message.reply("🌰 dei dei slow down da 😭");
    }

    cooldown.set(userId, now);

    const prompt = message.content.slice(10).trim();

    if (!prompt) {
      return message.reply("🌰 enna da kekra 😭");
    }

    try {
      const res = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          contents: [
            {
              parts: [
                {
                  text: `You are Verkadala 🌰, a funny Tamil Discord bot. Reply in casual Tamil slang, slightly savage but friendly.\nUser: ${prompt}`
                }
              ]
            }
          ]
        }
      );

      const reply = res.data.candidates[0].content.parts[0].text;

      message.reply(`🌰 ${reply}`);
    } catch (err) {
      console.error(err);
      message.reply("🌰 dei something broke 😭 try again later");
    }
  }

  // 🔵 AFK mention check
  message.mentions.users.forEach(user => {
    if (afkUsers[user.id]) {
      const data = afkUsers[user.id];
      const time = Date.now() - data.time;
      const duration = formatTime(time);

      message.reply(
        `🌰 ${user.username} AFK la irukaan — ${duration}\nReason: ${data.reason} 😎`
      );
    }
  });
});

// 🛡️ ERROR HANDLING
process.on("uncaughtException", console.error);
process.on("unhandledRejection", console.error);

// 🔐 LOGIN
client.login(process.env.TOKEN);
