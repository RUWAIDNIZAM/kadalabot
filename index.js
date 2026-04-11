const { Client, GatewayIntentBits, ActivityType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { GoogleGenerativeAI } = require("@google/generative-ai"); 
const express = require('express');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const SITE_URL = "https://kadalabot.up.railway.app/";

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

// ================= API ROUTES (CRASH-PROOF) =================
app.get("/", (req, res) => res.sendFile(__dirname + "/index.html"));

app.get("/api/stats", async (req, res) => {
    try {
        const guild = client.guilds.cache.first();
        if (!guild) return res.json([]); 
        const sorted = Object.values(userStats)
            .sort((a, b) => b.count - a.count)
            .filter(u => u.username.toLowerCase() !== 'dyno' && !u.isBot);
        const top10 = sorted.slice(0, 10);
        const dataWithAvatars = top10.map(stats => {
            const member = guild.members.cache.find(m => m.user.username === stats.username);
            return { ...stats, avatar: member ? member.user.displayAvatarURL({ size: 128 }) : 'https://cdn.discordapp.com/embed/avatars/0.png' };
        });
        res.json(dataWithAvatars);
    } catch (e) { res.json([]); }
});

app.get("/api/afk", async (req, res) => {
    try {
        const guild = client.guilds.cache.first();
        if (!guild) return res.json([]);
        const afkList = [];
        for (const id in afkUsers) {
            const member = guild.members.cache.get(id);
            afkList.push({
                username: member ? member.user.username : "Mamba",
                avatar: member ? member.user.displayAvatarURL({ size: 64 }) : 'https://cdn.discordapp.com/embed/avatars/0.png',
                reason: afkUsers[id].reason
            });
        }
        res.json(afkList);
    } catch (e) { res.json([]); }
});

app.get("/api/online", async (req, res) => {
    try {
        const guild = client.guilds.cache.first();
        if (!guild) return res.json({ count: 0, members: [] });
        await guild.members.fetch();
        const online = guild.members.cache.filter(m => m.presence && m.presence.status !== 'offline' && !m.user.bot);
        res.json({ count: online.size, members: online.map(m => ({ username: m.user.username, avatar: m.user.displayAvatarURL({ size: 64 }), status: m.presence.status })) });
    } catch (e) { res.json({ count: 0, members: [] }); }
});

app.get("/api/counting", (req, res) => res.json(countData));
app.listen(PORT, () => console.log(`Verkadala Hub live on Port ${PORT} 🔥`));

// ================= BOT LOGIC =================
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildPresences, GatewayIntentBits.GuildMembers] });

client.on('ready', () => client.user.setActivity('kadalabot.up.railway.app 📈', { type: ActivityType.Watching }));

client.on('messageCreate', async (message) => {
    if (message.author.bot && message.author.username.toLowerCase() !== 'dyno') return;
    const userId = message.author.id;
    const content = message.content.toLowerCase();

    if (!userStats[userId]) userStats[userId] = { username: message.author.username, count: 0, role: "Member", isBot: message.author.bot };
    userStats[userId].count++;
    userStats[userId].username = message.author.username;
    saveAll();

    if (message.channel.name.includes('count')) {
        const num = parseInt(content);
        if (!isNaN(num)) {
            if (num !== countData.current + 1 || userId === countData.lastUser) {
                message.react('❌');
                countData.current = 0; countData.lastUser = null; saveAll();
                return message.reply(`GUBEER! Reset to 0. Site check panni highscore paaru pangu: ${SITE_URL}`);
            }
            countData.current = num; countData.lastUser = userId;
            if (num > countData.highscore) countData.highscore = num;
            saveAll();
            message.react('✅');
        }
    }

    if (afkUsers[userId]) { delete afkUsers[userId]; saveAll(); return message.reply(`Welcome back! Check un stats here: ${SITE_URL}`); }
    if (content.startsWith('kadala afk')) {
        afkUsers[userId] = { time: Date.now(), reason: content.split('afk')[1]?.trim() || "No reason" };
        saveAll();
        return message.reply(`AFK set! Un reason website la update aayiduchi: ${SITE_URL}`);
    }
});
client.login(process.env.TOKEN);
