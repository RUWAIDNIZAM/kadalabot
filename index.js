const { Client, GatewayIntentBits, ActivityType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const SITE_URL = "https://kadalabot.up.railway.app/"; 
const PROMO_CHANNEL_ID = "1477208051584073799"; 

// ================= STORAGE =================
const loadJSON = (file, fallback) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : fallback;
let userStats = loadJSON('./userStats.json', {});
let countLB = loadJSON('./countLB.json', {});
let gameData = loadJSON('./counting.json', { current: 0, lastUser: null });
let afkUsers = loadJSON('./afk.json', {});
let latestMessages = []; // Website "At a Glance" feed

const saveAll = () => {
    fs.writeFileSync('./userStats.json', JSON.stringify(userStats, null, 2));
    fs.writeFileSync('./countLB.json', JSON.stringify(countLB, null, 2));
    fs.writeFileSync('./counting.json', JSON.stringify(gameData, null, 2));
    fs.writeFileSync('./afk.json', JSON.stringify(afkUsers, null, 2));
};

const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) return `${hrs}h ${mins % 60}m`;
    return `${mins}m ${totalSeconds % 60}s`;
};

// ================= MASTER CACHE =================
let cachedResponse = null;
const updateMasterCache = async () => {
    try {
        const guild = client.guilds.cache.first();
        if (!guild) return;
        const m = await guild.members.fetch({ withPresences: true });
        const online = m.filter(mem => mem.presence?.status !== 'offline' && !mem.user.bot);
        
        cachedResponse = { 
            totalKadalais: guild.memberCount,
            onlineKadalais: { 
                count: online.size, 
                members: online.map(mem => ({ username: mem.user.username, avatar: mem.user.displayAvatarURL() })).slice(0, 20) 
            },
            yappers: Object.values(userStats).sort((a,b) => b.count - a.count).slice(0, 10),
            counters: Object.values(countLB).sort((a,b) => b.points - a.points).slice(0, 5),
            afk: Object.keys(afkUsers).map(id => ({ username: guild.members.cache.get(id)?.user.username || "Kadalai", reason: afkUsers[id].reason })),
            chat: latestMessages,
            system: { ping: client.ws.ping + "ms", uptime: Math.floor(process.uptime() / 60) + "m" }
        };
    } catch (e) { console.log("Sync error"); }
};

// ================= DISCORD BOT =================
const client = new Client({ 
    intents: [3276799], 
    presence: { activities: [{ name: 'Verkadala Stop', type: ActivityType.Watching }] }
});

client.on('ready', () => {
    console.log(`Verkadala Stop live as ${client.user.tag}`);
    updateMasterCache();
    setInterval(updateMasterCache, 30000);

    // 📢 30-MIN PROMOTER
    setInterval(() => {
        const channel = client.channels.cache.get(PROMO_CHANNEL_ID);
        if (channel) channel.send(`📢 Dei mapla, check the Verkadala Stop stats here: ${SITE_URL}`);
    }, 1800000);
});

// Color Panel Handler
client.on('interactionCreate', async i => {
    if (!i.isButton()) return;
    const colors = { 'red_role': '#ff4d4d', 'blue_role': '#33b5e5', 'green_role': '#2ecc71', 'yellow_role': '#f1c40f', 'purple_role': '#9b59b6' };
    const colorHex = colors[i.customId];
    if (!colorHex) return;
    await i.deferReply({ ephemeral: true });
    try {
        const roleName = i.component.label.split(' ')[0];
        const role = i.guild.roles.cache.find(r => r.name === roleName) || await i.guild.roles.create({ name: roleName, color: colorHex });
        await i.member.roles.add(role);
        await i.editReply(`Vaazhthukkal mapla! Role added. ✨`);
    } catch (e) { await i.editReply("Permissions error!"); }
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;
    const userId = message.author.id;
    const content = message.content;

    // 💬 CAPTURE FOR WEBSITE
    latestMessages.unshift({
        author: message.author.username,
        content: content.length > 50 ? content.substring(0, 50) + "..." : content,
        avatar: message.author.displayAvatarURL(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    if (latestMessages.length > 10) latestMessages.pop();

    // 🏆 STATS
    if (!userStats[userId]) userStats[userId] = { username: message.author.username, count: 0 };
    userStats[userId].count++;

    // 🔢 COUNTING
    if (message.channel.name.includes('count')) {
        const num = parseInt(content);
        if (!isNaN(num)) {
            if (num !== gameData.current + 1 || userId === gameData.lastUser) {
                message.react('❌'); gameData.current = 0; gameData.lastUser = null;
                message.reply("Gubeer mistake! Reset to 0.");
            } else {
                message.react('✅'); gameData.current = num; gameData.lastUser = userId;
                if (!countLB[userId]) countLB[userId] = { username: message.author.username, points: 0 };
                countLB[userId].points++;
            }
            saveAll();
        }
    }

    // 😴 AFK SYSTEM
    if (message.mentions.users.size > 0) {
        message.mentions.users.forEach(u => {
            if (afkUsers[u.id]) {
                const duration = formatTime(Date.now() - afkUsers[u.id].time);
                message.reply(`Dei mamba, **${u.username}** afk pointen! Nee **${duration}** ah **${afkUsers[u.id].reason}** nu sollitu poiruntha.`);
            }
        });
    }

    if (afkUsers[userId] && !content.toLowerCase().startsWith('kadala afk')) {
        const dur = formatTime(Date.now() - afkUsers[userId].time);
        delete afkUsers[userId]; saveAll();
        message.reply(`Welcome back! You were away for ${dur}.`);
    }

    if (content.toLowerCase().startsWith('kadala afk')) {
        const r = content.split(/afk/i)[1]?.trim() || "No reason";
        afkUsers[userId] = { time: Date.now(), reason: r };
        saveAll();
        message.channel.send(`afk pointen: ${r}`);
    }

    // Setup color command
    if (content.toLowerCase() === 'kadala setup color') {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('red_role').setLabel('Red 🔥').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('blue_role').setLabel('Blue 🌊').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('green_role').setLabel('Green 🌿').setStyle(ButtonStyle.Success)
        );
        message.channel.send({ content: "🎨 **KADALA COLOR PANEL**", components: [row] });
    }
    updateMasterCache();
});

app.get("/", (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get("/api/all", (req, res) => res.json(cachedResponse || {}));
app.listen(PORT, () => console.log("ver2_a Server Live"));
client.login(process.env.TOKEN);
