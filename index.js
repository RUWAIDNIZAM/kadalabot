const { Client, GatewayIntentBits, ActivityType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ================= DATABASES =================
const STATS_FILE = './userStats.json';
const COUNT_FILE = './counting.json';
const AFK_FILE = './afk.json';

let userStats = fs.existsSync(STATS_FILE) ? JSON.parse(fs.readFileSync(STATS_FILE)) : {};
let countData = fs.existsSync(COUNT_FILE) ? JSON.parse(fs.readFileSync(COUNT_FILE)) : { current: 0, highscore: 0, lastUser: null };
let afkUsers = fs.existsSync(AFK_FILE) ? JSON.parse(fs.readFileSync(AFK_FILE)) : {};

const saveAll = () => {
    fs.writeFileSync(STATS_FILE, JSON.stringify(userStats, null, 2));
    fs.writeFileSync(COUNT_FILE, JSON.stringify(countData, null, 2));
    fs.writeFileSync(AFK_FILE, JSON.stringify(afkUsers, null, 2));
};

// ================= API ROUTES =================
app.get("/", (req, res) => res.sendFile(__dirname + "/index.html"));

app.get("/api/stats", async (req, res) => {
    try {
        const guild = client.guilds.cache.first();
        if (!guild) return res.json([]);
        const sorted = Object.values(userStats).sort((a, b) => b.count - a.count).filter(u => !u.isBot).slice(0, 10);
        const data = sorted.map(s => {
            const m = guild.members.cache.find(mem => mem.user.username === s.username);
            return { ...s, avatar: m ? m.user.displayAvatarURL({ size: 128 }) : 'https://cdn.discordapp.com/embed/avatars/0.png' };
        });
        res.json(data);
    } catch (e) { res.json([]); }
});

app.get("/api/staff", async (req, res) => {
    try {
        const guild = client.guilds.cache.first();
        if (!guild) return res.json([]);
        const staff = Object.values(userStats).filter(u => u.role === "Verified Owner" || u.role === "Mod");
        const data = staff.map(s => {
            const m = guild.members.cache.find(mem => mem.user.username === s.username);
            return { username: s.username, role: s.role, avatar: m ? m.user.displayAvatarURL({ size: 128 }) : 'https://cdn.discordapp.com/embed/avatars/0.png' };
        });
        res.json(data);
    } catch (e) { res.json([]); }
});

app.get("/api/online", async (req, res) => {
    try {
        const guild = client.guilds.cache.first();
        if (!guild) return res.json({ count: 0, members: [] });
        const m = await guild.members.fetch({ withPresences: true });
        const online = m.filter(mem => mem.presence && mem.presence.status !== 'offline' && !mem.user.bot);
        res.json({ count: online.size, members: online.map(mem => ({ username: mem.user.username, avatar: mem.user.displayAvatarURL({ size: 64 }), status: mem.presence.status })) });
    } catch (e) { res.json({ count: 0, members: [] }); }
});

app.get("/api/system", (req, res) => {
    res.json({
        ping: client.ws.ping + "ms",
        uptime: Math.floor(process.uptime() / 60) + " mins",
        status: "Operational",
        node: process.version
    });
});

app.get("/api/counting", (req, res) => res.json(countData));
app.get("/api/afk", async (req, res) => {
    const guild = client.guilds.cache.first();
    const list = [];
    for (const id in afkUsers) {
        const m = guild.members.cache.get(id);
        list.push({ username: m ? m.user.username : "Mamba", avatar: m ? m.user.displayAvatarURL() : '', reason: afkUsers[id].reason });
    }
    res.json(list);
});

app.listen(PORT, () => console.log(`Verkadala Hub running on ${PORT}`));

// ================= BOT LOGIC =================
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildPresences, GatewayIntentBits.GuildMembers] });

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    const userId = message.author.id;
    if (!userStats[userId]) userStats[userId] = { username: message.author.username, count: 0, role: userId === message.guild.ownerId ? "Verified Owner" : "Member", isBot: false };
    userStats[userId].count++;
    userStats[userId].username = message.author.username;
    saveAll();

    if (message.channel.name.includes('count')) {
        const num = parseInt(message.content);
        if (!isNaN(num)) {
            if (num !== countData.current + 1 || userId === countData.lastUser) {
                countData.current = 0; countData.lastUser = null;
            } else {
                countData.current = num; countData.lastUser = userId;
                if (num > countData.highscore) countData.highscore = num;
            }
            saveAll();
        }
    }
    if (afkUsers[userId]) { delete afkUsers[userId]; saveAll(); }
    if (message.content.toLowerCase().startsWith('kadala afk')) {
        afkUsers[userId] = { time: Date.now(), reason: message.content.split('afk')[1]?.trim() || "No reason" };
        saveAll();
    }
});

client.login(process.env.TOKEN);
