const { Client, GatewayIntentBits, ActivityType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ================= PERSISTENT STORAGE =================
const STATS_FILE = './userStats.json';     // Yapping
const COUNT_DB_FILE = './countStats.json'; // Counting Leaderboard
const GAME_FILE = './counting.json';       // Current Game State
const AFK_FILE = './afk.json';             // AFK users

let userStats = fs.existsSync(STATS_FILE) ? JSON.parse(fs.readFileSync(STATS_FILE)) : {};
let countStats = fs.existsSync(COUNT_DB_FILE) ? JSON.parse(fs.readFileSync(COUNT_DB_FILE)) : {};
let gameData = fs.existsSync(GAME_FILE) ? JSON.parse(fs.readFileSync(GAME_FILE)) : { current: 0, highscore: 0, lastUser: null };
let afkUsers = fs.existsSync(AFK_FILE) ? JSON.parse(fs.readFileSync(AFK_FILE)) : {};

const saveAll = () => {
    fs.writeFileSync(STATS_FILE, JSON.stringify(userStats, null, 2));
    fs.writeFileSync(COUNT_DB_FILE, JSON.stringify(countStats, null, 2));
    fs.writeFileSync(GAME_FILE, JSON.stringify(gameData, null, 2));
    fs.writeFileSync(AFK_FILE, JSON.stringify(afkUsers, null, 2));
};

// ================= API ROUTES =================
app.get("/", (req, res) => res.sendFile(__dirname + "/index.html"));

app.get("/api/stats", async (req, res) => {
    const guild = client.guilds.cache.first();
    if (!guild) return res.json([]);
    const sorted = Object.values(userStats).sort((a, b) => b.count - a.count).filter(u => !u.isBot).slice(0, 10);
    res.json(sorted.map(s => {
        const m = guild.members.cache.find(mem => mem.user.username === s.username);
        return { ...s, avatar: m ? m.user.displayAvatarURL() : 'https://cdn.discordapp.com/embed/avatars/0.png' };
    }));
});

app.get("/api/counting-lb", async (req, res) => {
    const guild = client.guilds.cache.first();
    const sorted = Object.values(countStats).sort((a, b) => b.points - a.points).slice(0, 5);
    res.json(sorted.map(s => {
        const m = guild.members.cache.find(mem => mem.user.username === s.username);
        return { ...s, avatar: m ? m.user.displayAvatarURL() : 'https://cdn.discordapp.com/embed/avatars/0.png' };
    }));
});

app.get("/api/online", async (req, res) => {
    const guild = client.guilds.cache.first();
    if (!guild) return res.json({ count: 0, members: [] });
    const m = await guild.members.fetch({ withPresences: true });
    const online = m.filter(mem => mem.presence && mem.presence.status !== 'offline' && !mem.user.bot);
    res.json({ count: online.size, members: online.map(mem => ({ username: mem.user.username, avatar: mem.user.displayAvatarURL(), status: mem.presence.status })) });
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

app.listen(PORT, () => console.log(`Unhinged Hub Live on ${PORT}`));

// ================= BOT COMMANDS FIX =================
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildPresences, GatewayIntentBits.GuildMembers] });

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    const userId = message.author.id;
    const content = message.content.toLowerCase();

    // Stats Track
    if (!userStats[userId]) userStats[userId] = { username: message.author.username, count: 0, role: userId === message.guild.ownerId ? "Verified Owner" : "Member" };
    userStats[userId].count++;
    saveAll();

    // --- COUNTING GAME LOGIC ---
    if (message.channel.name.includes('count')) {
        const num = parseInt(content);
        if (!isNaN(num)) {
            if (num !== gameData.current + 1 || userId === gameData.lastUser) {
                message.react('❌'); gameData.current = 0; gameData.lastUser = null;
            } else {
                message.react('✅'); gameData.current = num; gameData.lastUser = userId;
                if (num > gameData.highscore) gameData.highscore = num;
                if (!countStats[userId]) countStats[userId] = { username: message.author.username, points: 0 };
                countStats[userId].points++; // Add to Counting LB
            }
            saveAll();
            return;
        }
    }

    // --- COMMAND HANDLER FIX ---
    if (content.startsWith('kadala ')) {
        const cmd = content.replace('kadala ', '').trim();

        if (cmd.startsWith('afk')) {
            afkUsers[userId] = { time: Date.now(), reason: cmd.split('afk')[1]?.trim() || "No reason" };
            saveAll();
            return message.reply("AFK set pangu! Site la check pannika.");
        }

        if (cmd === 'leaderboard') {
            return message.reply("Check the fire UI here: https://kadalabot.up.railway.app/");
        }
    }

    if (afkUsers[userId]) { delete afkUsers[userId]; saveAll(); message.reply("Welcome back!"); }
});

client.login(process.env.TOKEN);
