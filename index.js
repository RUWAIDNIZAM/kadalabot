const { Client, GatewayIntentBits, ActivityType, EmbedBuilder } = require('discord.js');
const { GoogleGenerativeAI } = require("@google/generative-ai"); 
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const SITE_URL = "https://kadalabot.up.railway.app/";

// ================= DATABASE =================
const STATS_FILE = './userStats.json';
const COUNT_FILE = './counting.json';
const AFK_FILE = './afk.json';

const loadJSON = (file, fallback) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : fallback;
let userStats = loadJSON(STATS_FILE, {});
let gameData = loadJSON(COUNT_FILE, { current: 0, highscore: 0, lastUser: null });
let afkUsers = loadJSON(AFK_FILE, {});

const saveAll = () => {
    fs.writeFileSync(STATS_FILE, JSON.stringify(userStats, null, 2));
    fs.writeFileSync(COUNT_FILE, JSON.stringify(gameData, null, 2));
    fs.writeFileSync(AFK_FILE, JSON.stringify(afkUsers, null, 2));
};

// ================= API =================
app.get("/", (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.get("/api/all", async (req, res) => {
    try {
        const guild = client.guilds.cache.first();
        if (!guild) return res.status(503).json({ error: "Warming up..." });
        const m = await guild.members.fetch({ withPresences: true });
        const onlineMem = m.filter(mem => mem.presence && mem.presence.status !== 'offline' && !mem.user.bot);
        
        const stats = Object.values(userStats).sort((a, b) => b.count - a.count).filter(u => !u.isBot).slice(0, 10).map(s => {
            const mem = guild.members.cache.find(msg => msg.user.username === s.username);
            return { ...s, avatar: mem ? mem.user.displayAvatarURL() : 'https://cdn.discordapp.com/embed/avatars/0.png' };
        });

        const afk = Object.keys(afkUsers).map(id => {
            const mem = guild.members.cache.get(id);
            return { username: mem ? mem.user.username : "Mamba", reason: afkUsers[id].reason, avatar: mem ? mem.user.displayAvatarURL() : '' };
        });

        res.json({ stats, counting: gameData, afk, online: { count: onlineMem.size, members: onlineMem.map(mem => ({ username: mem.user.username, avatar: mem.user.displayAvatarURL(), status: mem.presence.status })) }, system: { ping: client.ws.ping + "ms", uptime: Math.floor(process.uptime() / 60) + "m" } });
    } catch (e) { res.status(500).json({ error: "Internal Error" }); }
});

app.listen(PORT, () => console.log(`Unhinged Hub Engine live on ${PORT}`));

// ================= BOT =================
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildPresences, GatewayIntentBits.GuildMembers] });

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    const userId = message.author.id;
    const content = message.content.toLowerCase();

    if (!userStats[userId]) userStats[userId] = { username: message.author.username, count: 0, role: userId === message.guild.ownerId ? "Verified Owner" : "Member" };
    userStats[userId].count++;
    saveAll();

    // 1. AFK Logic with Reason
    if (afkUsers[userId]) { 
        delete afkUsers[userId]; saveAll(); 
        message.reply(`Welcome back da! You were AFK but now you're back in the game. 🤝\n\n*Tip: uk u can also see this and more about tas in this server also in ${SITE_URL}*`); 
    }

    if (content.startsWith('kadala afk')) {
        const reason = message.content.split('afk')[1]?.trim() || "Ethuko poirukan (No reason)";
        afkUsers[userId] = { time: Date.now(), reason: reason };
        saveAll();
        return message.reply(`AFK set mamba! 😴 \n**Reason:** ${reason}\n\n*Tip: uk u can also see this and more about tas in this server also in ${SITE_URL}*`);
    }

    // 2. AFK Leaderboard with Reasons
    if (content === 'kadala leaderboard' || content === 'kadala afk leaderboard') {
        let lbMsg = "🏆 **AFK MAMBAS & REASONS** 🏆\n\n";
        const keys = Object.keys(afkUsers);
        if (keys.length === 0) lbMsg += "Evanum thoongala, ellarum active! 🔥";
        else {
            keys.forEach(id => {
                const user = client.users.cache.get(id);
                lbMsg += `👤 **${user ? user.username : 'Unknown'}**: ${afkUsers[id].reason}\n`;
            });
        }
        lbMsg += `\n🔗 **View full dashboard:** ${SITE_URL}\n*Tip: uk u can also see this and more about tas in this server also in ${SITE_URL}*`;
        return message.reply(lbMsg);
    }

    // 3. Counting Game
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
        }
    }
});

client.login(process.env.TOKEN);
