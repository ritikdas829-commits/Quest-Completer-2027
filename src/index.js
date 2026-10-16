import 'dotenv/config';
import { Client, GatewayIntentBits, Collection, Partials } from 'discord.js';
import { readdirSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import deployCommands from './utils/deployCommands.js';
import { makeTokenStore } from './commands/questCommands.js';
// FIXED: db.js ka export koi bhi ho — named ya default — dono chalega
import * as dbModule from './utils/db.js';

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
        `${col.white}${col.bright}   ╚══▀▀═╝  ╚═════╝  ╚═══╝   ╚═╝${col.reset}`,
        '',
        `${col.dim}  ─────────────────────────────────────────────────${col.reset}`,
        `  ${col.green}●${col.reset} ${col.white}Quest Completer V1${col.reset}  ${col.dim}|${col.reset}   ${col.white}dsc.gg/synoraxdev${col.reset}`,
        `${col.dim}  ─────────────────────────────────────────────────${col.reset}`,
        '',
    ];
    for (const line of lines) process.stdout.write(line + '\n');
}

const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) { console.error('DISCORD_TOKEN is not set.'); process.exit(1); }

// FIXED: 【entity-MongoDB¦canonical_name=MongoDB】 Connect — chahe export default ho ya named ho
const connectDB = dbModule.connectDB || dbModule.default || dbModule.connect;
if (connectDB && typeof connectDB === 'function') {
    try {
        await connectDB();
        console.log(`${col.green}● MongoDB Connected${col.reset}`);
    } catch (e) {
        console.warn(`${col.purple}● MongoDB Failed: ${e.message}${col.reset}`);
    }
} else {
    console.warn('● db.js me connectDB function nahi mila — skip kar raha hu');
}

banner();
await deployCommands(TOKEN, process.env.DISCORD_CLIENT_ID);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Message, Partials.Channel],
});

client.commands       = new Collection();
client.prefixCommands = new Collection();
client.tokenStore     = makeTokenStore(TOKEN);
// Prefix system — teri demand wala
client.config = { prefix: process.env.PREFIX || ';' };
client.prefix = process.env.PREFIX || ';';

const commandFiles = readdirSync(join(__dirname, 'commands')).filter(f => f.endsWith('.js'));
for (const file of commandFiles) {
    const mod = await import(pathToFileURL(join(__dirname, 'commands', file)).href);
    if (mod.default) {
        const cmd = mod.default;
        if (cmd?.data)   client.commands.set(cmd.data.name, cmd);
        if (cmd?.prefix) client.prefixCommands.set(cmd.prefix, cmd);
    }
    for (const [key, cmd] of Object.entries(mod)) {
        if (key === 'default' || key === 'makeTokenStore' || key === 'handleLinkModal' || key === 'handleLinkPromptButton' || key === 'runAutoquestForUser') continue;
        if (cmd?.data)   client.commands.set(cmd.data.name, cmd);
        if (cmd?.prefix) client.prefixCommands.set(cmd.prefix, cmd);
    }
}

const eventFiles = readdirSync(join(__dirname, 'events')).filter(f => f.endsWith('.js'));
for (const file of eventFiles) {
    const mod   = await import(pathToFileURL(join(__dirname, 'events', file)).href);
    const event = mod.default;
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
    } else {
        client.on(event.name, (...args) => event.execute(...args, client));
    }
}

client.login(TOKEN);
