const { Client, GatewayIntentBits, ActivityType, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');
const { GoogleGenerativeAI } = require("@google/generative-ai"); 
const express = require('express');
const fs = require('fs');

// ================= THE VERKADALA HUB (EXPRESS) =================
const app = express();
const PORT = process.env.PORT || 3000;

// 1. Serve the Liquid Glass UI
app.get("/", (req, res) => res.sendFile(__dirname + "/index.html"));

// 2. API: Send Top 10 Stats
app.get("/api/stats", (req, res) => {
    const sorted = Object.values(userStats).sort((a, b) => b.count - a.count).slice(0, 10);
    res.json(sorted);
});

// 3. API: Online Count
app.get("/api/online", async (req, res) => {
    try {
        const guild = client.guilds.cache.first();
        const f = await guild.fetch();
        res.json({ count: f.approximatePresenceCount || 0 });
    } catch (e) { res.json({ count: 0 }); }
});

// 4. API: Counting Data
app.get("/api/counting", (req, res) => res.json(countData));

app.listen(PORT, () => console.log(`Verkadala Hub live on Port ${PORT} 🔥`));

// ================= AI SETUP =================
const systemInstruction = `You are 'Kadala Watchman', a peak GenZ Tamil guy. Use Tanglish, slang like 'mamba', 'gubeer', 'clutch'. Keep it short (1-3 sentences).`;
let currentKeyIndex = -1;
function getAvailableKeys() { return [process.env.API_KEY_1, process.env.API_KEY_2, process.env.API_KEY_3].filter(k => k); }
function getNextChatModel() {
    const keys = getAvailableKeys();
    if (keys.length === 0) return null;
    currentKeyIndex = (currentKeyIndex + 1) % keys.length;
    const genAI = new GoogleGenerativeAI(keys[currentKeyIndex]);
    return genAI.getGenerativeModel({ model: "gemini-1.5-flash", systemInstruction });
}

// ================= CLIENT SETUP =================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessageReactions, GatewayIntentBits.GuildPresences
    ]
});

// ================= DATABASES =================
const AFK_FILE = './afk.json';
const AFK_STATS_FILE = './afkStats.json';
const USER_STATS_FILE = './userStats.json';
const COUNT_FILE = './counting.json';

let afkUsers = fs.existsSync(AFK_FILE) ? JSON.parse(fs.readFileSync(AFK_FILE)) : {};
let afkStats = fs.existsSync(AFK_STATS_FILE) ? JSON.parse(fs.readFileSync(AFK_STATS_FILE)) : {};
let userStats = fs.existsSync(USER_STATS_FILE) ? JSON.parse(fs.readFileSync(USER_STATS_FILE)) : {};
let countData = fs.existsSync(COUNT_FILE) ? JSON.parse(fs.readFileSync(COUNT_FILE)) : { current: 0, highscore: 0, lastUser: null };

const saveAll = () => {
    fs.writeFileSync(AFK_FILE, JSON.stringify(afkUsers, null, 2));
    fs.writeFileSync(AFK_STATS_FILE, JSON.stringify(afkStats, null, 2));
    fs.writeFileSync(USER_STATS_FILE, JSON.stringify(userStats, null, 2));
    fs.writeFileSync(COUNT_FILE, JSON.stringify(countData, null, 2));
};

const formatTime = (ms) => {
    const sec = Math.floor(ms / 1000) % 60;
    const min = Math.floor(ms / (1000 * 60)) % 60;
    return `${min}m ${sec}s`;
};

// ================= COLOR CONFIG =================
const COLORS = {
    'color_red': { name: 'Blood Red', hex: '#FF0000', label: 'Red 🔥', style: ButtonStyle.Danger },
    'color_blue': { name: 'Ocean Blue', hex: '#0000FF', label: 'Blue 🌊', style: ButtonStyle.Primary },
    'color_green': { name: 'Toxic Green', hex: '#00FF00', label: 'Green 🌿', style: ButtonStyle.Success },
    'color_yellow': { name: 'Cyber Yellow', hex: '#FFD700', label: 'Yellow ⚡', style: ButtonStyle.Secondary },
    'color_purple': { name: 'Neon Purple', hex: '#8A2BE2', label: 'Purple 👾', style: ButtonStyle.Secondary }
};

// ================= INTERACTION HANDLER =================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    if (interaction.customId.startsWith('color_')) {
        await interaction.deferReply({ ephemeral: true });
        const colorData = COLORS[interaction.customId];
        const member = interaction.member;
        try {
            const colorRoleNames = Object.values(COLORS).map(c => c.name);
            const rolesToRemove = member.roles.cache.filter(r => colorRoleNames.includes(r.name));
            if (rolesToRemove.size > 0) await member.roles.remove(rolesToRemove);
            let role = interaction.guild.roles.cache.find(r => r.name === colorData.name);
            if (!role) role = await interaction.guild.roles.create({ name: colorData.name, color: colorData.hex });
            await member.roles.add(role);
            return interaction.editReply(`Unakku **${colorData.label}** assign panniyachu blood! Check the site for stats: [Verkadala Hub]`);
        } catch (err) { return interaction.editReply("Role error! Move bot role up."); }
    }
});

// ================= MESSAGE HANDLER =================
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    const content = message.content.toLowerCase();
    const userId = message.author.id;

    // --- 1. MESSAGE TRACKING ---
    if (!userStats[userId]) userStats[userId] = { username: message.author.username, count: 0, role: "Member" };
    userStats[userId].count++;
    userStats[userId].username = message.author.username;
    if (userId === message.guild.ownerId) userStats[userId].role = "Verified Owner";
    saveAll();

    // --- 2. COUNTING GAME ---
    if (message.channel.name.includes('count')) {
        const num = parseInt(content);
        if (!isNaN(num)) {
            if (num !== countData.current + 1 || userId === countData.lastUser) {
                message.react('❌');
                countData.current = 0; countData.lastUser = null; saveAll();
                return message.reply("GUBEER! Game reset to 0. Check the highscores here: [Website Link]");
            }
            countData.current = num; countData.lastUser = userId;
            if (num > countData.highscore) countData.highscore = num;
            saveAll();
            message.react('✅');
            return;
        }
    }

    // --- 3. AFK LOGIC ---
    if (afkUsers[userId]) {
        const time = Date.now() - afkUsers[userId].time;
        delete afkUsers[userId];
        afkStats[userId] = (afkStats[userId] || 0) + time;
        saveAll();
        return message.reply(`Welcome back! You were gone for ${formatTime(time)}. Check your global AFK rank on our site!`);
    }

    if (content.startsWith('kadala afk')) {
        const reason = content.split('afk')[1]?.trim() || "No reason";
        afkUsers[userId] = { time: Date.now(), reason };
        saveAll();
        return message.reply("AFK set pangu! Poitu vaa. Check who else is AFK on our website.");
    }

    // --- 4. LEADERBOARD ---
    if (content.includes('leaderboard')) {
        return message.reply("🏆 **Verkadala Leaderboard** is now LIVE on the web! Go here to see the full list: [Website Link]");
    }

    // --- 5. COLOR PANEL ---
    if (content.includes('colourpanel')) {
        const row = new ActionRowBuilder();
        Object.entries(COLORS).forEach(([id, data]) => {
            row.addComponents(new ButtonBuilder().setCustomId(id).setLabel(data.label).setStyle(data.style));
        });
        return message.channel.send({ content: "🎨 **KADALA COLOR PANEL**", components: [row] });
    }

    // --- 6. AI CHAT ---
    if (content.startsWith('kadala ') || (message.reference && message.mentions.has(client.user))) {
        await message.channel.sendTyping();
        try {
            const model = getNextChatModel();
            const res = await model.generateContent(content.replace('kadala ', ''));
            return message.reply(res.response.text());
        } catch(e) { return message.reply("AI is confused pangu! Check logs."); }
    }
});

client.login(process.env.TOKEN);
