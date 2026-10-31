/**
 * index.js — Fully Fixed Main Entry Point with Automated Slash Command Registration
 * Location: index.js
 */

import 'dotenv/config';
import { Client, GatewayIntentBits, Collection, Partials, REST, Routes, Events } from 'discord.js';
import { readdirSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { TokenStore } from './quest/tokenStore.js';
import * as dbModule from './utils/db.js';

// Trackers, Role Store & Expiry Service Imports
import { cacheGuildInvites } from './handlers/inviteTracker.js';
import { syncRolesFromDB } from './quest/roleStore.js';
import { startTrialExpiryChecker } from './quest/trialExpiryChecker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const col = {
    reset:  '\x1b[0m', bright: '\x1b[1m', cyan: '\x1b[96m',
    blue:   '\x1b[34m', white: '\x1b[97m', purple: '\x1b[35m',
    green:  '\x1b[92m', dim:   '\x1b[90m',
};

function banner() {
    const lines = [
        '',
        `${col.cyan}${col.bright}   ██████╗  ██████╗██╗   ██╗ ██╗${col.reset}`,
        `${col.cyan}${col.bright}  ██╔═══██╗██╔════╝██║   ██║███║${col.reset}`,
        `${col.blue}${col.bright}  ██║   ██║██║     ██║   ██║╚██║${col.reset}`,
        `${col.blue}${col.bright}  ██║▄▄ ██║██║     ╚██╗ ██╔╝ ██║${col.reset}`,
        `${col.white}${col.bright}  ╚██████╔╝╚██████╗ ╚████╔╝  ██║${col.reset}`,
        `${col.white}${col.bright}   ╚══▀▀═╝  ╚═════╝  ╚═════╝   ╚═╝${col.reset}`,
        '',
        `${col.dim}  ─────────────────────────────────────────────────${col.reset}`,
        `  ${col.green}●${col.reset} ${col.white}Quest Completer V1 - 5 Slots${col.reset}  ${col.dim}|${col.reset}   ${col.white}dsc.gg/synoraxdev${col.reset}`,
        `${col.dim}  ─────────────────────────────────────────────────${col.reset}`,
        '',
    ];
    for (const line of lines) process.stdout.write(line + '\n');
}

const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) { console.error('DISCORD_TOKEN is not set.'); process.exit(1); }

// Safe MongoDB Connection
const connectDB = dbModule.connectDB || dbModule.default;
if (typeof connectDB === 'function') {
    try {
        await connectDB();
        console.log(`${col.green}● MongoDB Connected${col.reset}`);
    } catch (e) {
        console.warn(`${col.purple}● MongoDB Failed: ${e.message}${col.reset} — Bot chalega bina DB ke`);
    }
}

banner();

// Sync roles from DB on startup
try {
    await syncRolesFromDB();
    console.log(`${col.green}● Roles synced from MongoDB successfully${col.reset}`);
} catch (err) {
    console.warn(`${col.purple}● Role sync warning:${col.reset}`, err.message);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMembers,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.User, Partials.GuildMember],
});

const activePrefix    = process.env.PREFIX || process.env.BOT_PREFIX || ';';
client.commands       = new Collection();
client.prefixCommands = new Collection();
client.tokenStore     = new TokenStore();
client.config         = { prefix: activePrefix };
client.prefix         = activePrefix;

client.getPrefix = function(guildId) {
    return activePrefix;
};

// ── Robust & Safe Dynamic Command Loader ───────────────────────────────────
const commandFiles = readdirSync(join(__dirname, 'commands')).filter(f => f.endsWith('.js'));
for (const file of commandFiles) {
    const mod = await import(pathToFileURL(join(__dirname, 'commands', file)).href);

    const registerCmd = (cmd) => {
        if (!cmd || typeof cmd !== 'object') return;

        // Register Slash Commands
        if (cmd.data && typeof cmd.data.name === 'string') {
            client.commands.set(cmd.data.name, cmd);
        }

        // Register Prefix Commands
        const prefixName = cmd.prefix || cmd.name || cmd.data?.name;
        if (prefixName && typeof prefixName === 'string') {
            client.prefixCommands.set(prefixName.toLowerCase(), cmd);
        }
    };

    // 1. Register default export if present
    if (mod.default) {
        registerCmd(mod.default);
    }

    // 2. Register any valid named exports securely (Fixed operators here)
    for (const [key, cmd] of Object.entries(mod)) {
        if (key === 'default' || !cmd || typeof cmd !== 'object') continue;
        if (cmd.data || cmd.name || cmd.prefix) {
            registerCmd(cmd);
        }
    }
}

// ── Dynamic Event Loader ────────────────────────────────────────────────----
try {
    const eventFiles = readdirSync(join(__dirname, 'events')).filter(f => f.endsWith('.js'));
    for (const file of eventFiles) {
        const mod   = await import(pathToFileURL(join(__dirname, 'events', file)).href);
        const event = mod.default;
        if (event?.name && event?.execute) {
            if (event.once) {
                client.once(event.name, (...args) => event.execute(...args, client));
            } else {
                client.on(event.name, (...args) => event.execute(...args, client));
            }
        }
    }
} catch (err) {
    console.error('❌ Error loading events:', err);
}

// ── Client Ready Event & Slash Command Deployment ──────────────────────────
client.once(Events.ClientReady, async () => {
    console.log(`🤖 Logged in as ${client.user.tag}!`);

    // Register Slash Commands with Discord API
    try {
        console.log(`[SlashCmds] Registering slash commands...`);
        const rest = new REST({ version: '10' }).setToken(TOKEN);
        const commandsData = Array.from(client.commands.values()).map(c => c.data.toJSON());
        
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commandsData },
        );
        console.log(`✓ ${commandsData.length} command(s) registered successfully.`);
    } catch (error) {
        console.error('❌ Failed to register slash commands:', error);
    }

    await cacheGuildInvites(client);
    console.log(`⚡ Guild invites cached successfully.`);

    // ⏱️ Start automatic trial expiry checker background job
    startTrialExpiryChecker(client);
    console.log(`⏳ Trial expiry background checker service started.`);
});

client.login(TOKEN);
