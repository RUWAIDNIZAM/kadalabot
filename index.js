require('dotenv').config();
const { Client } = require('discord.js');
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const { PostgresStorage } = require('./storage');

const app = express();
const PORT = process.env.PORT || 3000;
const SITE_URL = "https://kadalabot.up.railway.app/";

// ================= DATABASE =================
const DB_URL = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!DB_URL) throw new Error('Missing SUPABASE_DB_URL (or DATABASE_URL) in environment');

const pool = new Pool({
    connectionString: DB_URL,
    ssl: DB_URL.includes('localhost') || DB_URL.includes('127.0.0.1') ? false : { rejectUnauthorized: false }
});

const storage = new PostgresStorage(pool);

let userStats = {};
let countLB = {};
let gameData = { current: 0, highscore: 0, lastUser: null };
let afkUsers = {};

let cachedResponse = null; 

const formatTime = (ms) => {
    const mins = Math.floor(ms / 60000);
    const hrs = Math.floor(mins / 60);
    return hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m`;
};

// ================= MASTER SYNC (SILENT) =================
const updateMasterCache = async () => {
    try {
        const guild = client.guilds.cache.first();
        if (!guild) return;
        const m = await guild.members.fetch({ withPresences: true });
        const onlineMem = m.filter(mem => mem.presence && mem.presence.status !== 'offline' && !mem.user.bot);
        
        const yappers = Object.values(userStats).sort((a, b) => b.count - a.count).filter(u => !u.isBot).slice(0, 5).map(s => {
            const mem = guild.members.cache.find(msg => msg.user.username === s.username);
            return { ...s, avatar: mem ? mem.user.displayAvatarURL() : 'https://cdn.discordapp.com/embed/avatars/0.png' };
        });

        const counters = Object.values(countLB).sort((a, b) => b.points - a.points).slice(0, 5).map(s => {
            const mem = guild.members.cache.find(msg => msg.user.username === s.username);
            return { ...s, avatar: mem ? mem.user.displayAvatarURL() : '' };
        });

        const afk = Object.keys(afkUsers).map(id => {
            const mem = guild.members.cache.get(id);
            return { username: mem ? mem.user.username : "Mamba", reason: afkUsers[id].reason, since: afkUsers[id].time, avatar: mem ? mem.user.displayAvatarURL() : '' };
        });

        cachedResponse = { 
            totalMembers: guild.memberCount, yappers, counters, 
            online: { count: onlineMem.size, members: onlineMem.map(mem => ({ username: mem.user.username, avatar: mem.user.displayAvatarURL() })) },
            afk, system: { ping: client.ws.ping + "ms", uptime: Math.floor(process.uptime() / 60) + "m" }
        };
    } catch (e) { console.log("Silent sync failed"); }
};

// ================= API =================
app.get("/", (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get("/api/all", (req, res) => res.json(cachedResponse || {}));

app.listen(PORT, () => console.log(`Engine live on ${PORT}`));

// ================= BOT LOGIC =================
const client = new Client({ intents: [3276799] });

client.on('ready', async () => {
    try {
        await storage.initialize();
        const state = await storage.loadState();
        userStats = state.userStats;
        countLB = state.countLB;
        gameData = state.gameData;
        afkUsers = state.afkUsers;
        await updateMasterCache();
        setInterval(updateMasterCache, 30000);
        console.log('Bot ready with PostgreSQL storage');
    } catch (error) {
        console.error('Startup failed:', error.message);
        process.exit(1);
    }
});

client.on('messageCreate', async (message) => {
    try {
        if (message.author.bot) return;
        const userId = message.author.id;
        const content = message.content.toLowerCase();

        // Stats
        if (!userStats[userId]) userStats[userId] = { username: message.author.username, count: 0 };
        userStats[userId].count++;
        userStats[userId].username = message.author.username;
        await storage.upsertUserStat(userId, userStats[userId]);

        // AFK RETURN
        if (afkUsers[userId]) {
            const duration = formatTime(Date.now() - afkUsers[userId].time);
            const oldReason = afkUsers[userId].reason;
            delete afkUsers[userId];
            await storage.deleteAfkUser(userId);
            await updateMasterCache();
            return message.reply(`Welcome back mamba! 🤝\nNee **${duration}** ah thoongitu iruntha. \n**Reason:** ${oldReason}\n\n*uk u can also see this and more about tas in this server also in ${SITE_URL}*`);
        }

        // AFK SET
        if (content.startsWith('kadala afk')) {
            const r = message.content.split(/afk/i)[1]?.trim() || 'No reason';
            afkUsers[userId] = { time: Date.now(), reason: r };
            await storage.setAfkUser(userId, afkUsers[userId]);
            await updateMasterCache();
            return message.reply(`AFK set mamba! 😴\n\n*uk u can also see this and more about tas in this server also in ${SITE_URL}*`);
        }

        // Counting
        if (message.channel.name.includes('count')) {
            const num = parseInt(content, 10);
            if (!isNaN(num)) {
                if (num !== gameData.current + 1 || userId === gameData.lastUser) {
                    gameData.current = 0;
                    gameData.lastUser = null;
                } else {
                    gameData.current = num;
                    gameData.lastUser = userId;
                    gameData.highscore = Math.max(gameData.highscore, gameData.current);

                    if (!countLB[userId]) countLB[userId] = { username: message.author.username, points: 0 };
                    countLB[userId].username = message.author.username;
                    countLB[userId].points++;
                    await storage.upsertCountStat(userId, countLB[userId]);
                }

                await storage.saveGameData(gameData);
                await updateMasterCache();
            }
        }
    } catch (error) {
        console.error('Message handling failed:', error.message);
    }
});

client.login(process.env.TOKEN);
