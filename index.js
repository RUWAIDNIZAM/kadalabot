const { Client, GatewayIntentBits, ActivityType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { GoogleGenerativeAI } = require("@google/generative-ai"); 
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const SITE_URL = "https://kadalabot.up.railway.app/";

// ================= DATABASE INITIALIZATION =================
const STATS_FILE = './userStats.json';
const COUNT_DB_FILE = './countStats.json';
const GAME_FILE = './counting.json';
const AFK_FILE = './afk.json';

const loadJSON = (file, fallback) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : fallback;
let userStats = loadJSON(STATS_FILE, {});
let countStats = loadJSON(COUNT_DB_FILE, {});
let gameData = loadJSON(GAME_FILE, { current: 0, highscore: 0, lastUser: null });
let afkUsers = loadJSON(AFK_FILE, {});

const saveAll = () => {
    fs.writeFileSync(STATS_FILE, JSON.stringify(userStats, null, 2));
    fs.writeFileSync(COUNT_DB_FILE, JSON.stringify(countStats, null, 2));
    fs.writeFileSync(GAME_FILE, JSON.stringify(gameData, null, 2));
    fs.writeFileSync(AFK_FILE, JSON.stringify(afkUsers, null, 2));
};

// ================= AI SETUP (ROTATION) =================
const systemInstruction = "You are 'Kadala Watchman', a peak GenZ Tamil guy. Use Tanglish, slang like 'mamba', 'gubeer', 'clutch', 'blood'. Keep it short.";
let currentKeyIndex = -1;
const getAvailableKeys = () => [process.env.API_KEY_1, process.env.API_KEY_2, process.env.API_KEY_3].filter(k => k);
const getAIModel = () => {
    const keys = getAvailableKeys();
    if (!keys.length) return null;
    currentKeyIndex = (currentKeyIndex + 1) % keys.length;
    const genAI = new GoogleGenerativeAI(keys[currentKeyIndex]);
    return genAI.getGenerativeModel({ model: "gemini-1.5-flash", systemInstruction });
};

// ================= API ROUTES (WEBSITE) =================
app.get("/", (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.get("/api/stats", async (req, res) => {
    try {
        const guild = client.guilds.cache.first();
        if (!guild) return res.json([]);
        const sorted = Object.values(userStats).sort((a, b) => b.count - a.count).filter(u => !u.isBot).slice(0, 10);
        res.json(sorted.map(s => {
            const m = guild.members.cache.find(mem => mem.user.username === s.username);
            return { ...s, avatar: m ? m.user.displayAvatarURL() : 'https://cdn.discordapp.com/embed/avatars/0.png' };
        }));
    } catch (e) { res.json([]); }
});

app.get("/api/online", async (req, res) => {
    try {
        const guild = client.guilds.cache.first();
        if (!guild) return res.json({ count: 0, members: [] });
        const m = await guild.members.fetch({ withPresences: true });
        const online = m.filter(mem => mem.presence && mem.presence.status !== 'offline' && !mem.user.bot);
        res.json({ count: online.size, members: online.map(mem => ({ username: mem.user.username, avatar: mem.user.displayAvatarURL(), status: mem.presence.status })) });
    } catch (e) { res.json({ count: 0, members: [] }); }
});

app.get("/api/staff", async (req, res) => {
    const guild = client.guilds.cache.first();
    if (!guild) return res.json([]);
    const staff = Object.values(userStats).filter(u => u.role === "Verified Owner" || u.role === "Mod");
    res.json(staff.map(s => {
        const m = guild.members.cache.find(mem => mem.user.username === s.username);
        return { username: s.username, role: s.role, avatar: m ? m.user.displayAvatarURL() : '' };
    }));
});

app.get("/api/system", (req, res) => res.json({ ping: client.ws.ping + "ms", uptime: Math.floor(process.uptime() / 60) + "m", status: "Operational" }));
app.get("/api/counting", (req, res) => res.json(gameData));
app.get("/api/afk", (req, res) => {
    const guild = client.guilds.cache.first();
    res.json(Object.keys(afkUsers).map(id => {
        const m = guild.members.cache.get(id);
        return { username: m ? m.user.username : "Mamba", reason: afkUsers[id].reason, avatar: m ? m.user.displayAvatarURL() : '' };
    }));
});

app.listen(PORT, () => console.log(`Unhinged Hub Live on ${PORT} 🔥`));

// ================= BOT LOGIC =================
const client = new Client({ intents: [3276799] });

client.on('ready', () => {
    client.user.setActivity('kadalabot.up.railway.app 📈', { type: ActivityType.Watching });
    console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    const userId = message.author.id;
    const content = message.content.toLowerCase();

    // 1. Stats Tracking
    if (!userStats[userId]) userStats[userId] = { username: message.author.username, count: 0, role: userId === message.guild.ownerId ? "Verified Owner" : "Member", isBot: false };
    userStats[userId].count++;
    userStats[userId].username = message.author.username;
    saveAll();

    // 2. Counting Game
    if (message.channel.name.includes('count')) {
        const num = parseInt(content);
        if (!isNaN(num)) {
            if (num !== gameData.current + 1 || userId === gameData.lastUser) {
                message.react('❌'); gameData.current = 0; gameData.lastUser = null;
            } else {
                message.react('✅'); gameData.current = num; gameData.lastUser = userId;
                if (num > gameData.highscore) gameData.highscore = num;
            }
            saveAll();
            return;
        }
    }

    // 3. AFK Logic
    if (afkUsers[userId]) { delete afkUsers[userId]; saveAll(); message.reply("Welcome back mamba!"); }
    if (content.startsWith('kadala afk')) {
        afkUsers[userId] = { time: Date.now(), reason: content.split('afk')[1]?.trim() || "No reason" };
        saveAll();
        return message.reply(`AFK set! Check website status: ${SITE_URL}`);
    }

    // 4. AI Logic
    if (content.startsWith('kadala ') || (message.reference && message.mentions.has(client.user))) {
        await message.channel.sendTyping();
        const model = getAIModel();
        if (!model) return message.reply("No AI keys found pangu!");
        const result = await model.generateContent(content.replace('kadala ', ''));
        return message.reply(result.response.text());
    }
});

client.login(process.env.TOKEN);
