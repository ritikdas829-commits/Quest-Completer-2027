import 'dotenv/config';
import { Client, GatewayIntentBits, Collection, Partials } from 'discord.js';
import { readdirSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import deployCommands from './utils/deployCommands.js';
import { TokenStore } from './quest/tokenStore.js';
import * as dbModule from './utils/db.js';
import { handleButton as handlePremiumButton, handleModal as handlePremiumModal } from './commands/premiumLink.js';

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
await deployCommands(TOKEN, process.env.DISCORD_CLIENT_ID);

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

client.commands       = new Collection();
client.prefixCommands = new Collection();
client.tokenStore     = new TokenStore(TOKEN);
client.config         = { prefix: process.env.PREFIX || ';' };
client.prefix         = process.env.PREFIX || ';';

// Load Commands Dynamically
const commandFiles = readdirSync(join(__dirname, 'commands')).filter(f => f.endsWith('.js'));
for (const file of commandFiles) {
    const mod = await import(pathToFileURL(join(__dirname, 'commands', file)).href);
    if (mod.default) {
        const cmd = mod.default;
        if (cmd?.data)   client.commands.set(cmd.data.name, cmd);
        if (cmd?.prefix) client.prefixCommands.set(cmd.prefix, cmd);
    }
    for (const [key, cmd] of Object.entries(mod)) {
        if (['default', 'makeTokenStore', 'handleLinkModal', 'handleLinkPromptButton', 'runAutoquestForUser', 'buildPremiumLinkPanel', 'handleButton', 'handleModal'].includes(key)) continue;
        if (cmd?.data)   client.commands.set(cmd.data.name, cmd);
        if (cmd?.prefix) client.prefixCommands.set(cmd.prefix, cmd);
    }
}

// ── Interaction Create Handler (Buttons, Modals, and Slash Commands) ───────
client.on('interactionCreate', async (interaction) => {
    try {
        // 1. Handle 5-Slot Premium Link Buttons (Link, Unlink, Select)
        if (interaction.isButton()) {
            if (
                interaction.customId.startsWith('link_slot_') ||
                interaction.customId.startsWith('unlink_slot_') ||
                interaction.customId.startsWith('select_slot_')
            ) {
                return await handlePremiumButton(interaction, client);
            }
        }

        // 2. Handle 5-Slot Modals (Token Submission Popups)
        if (interaction.isModalSubmit()) {
            if (interaction.customId.startsWith('link_modal_slot_')) {
                return await handlePremiumModal(interaction, client);
            }
        }

        // 3. Handle Slash Commands
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;
            await command.execute(interaction, client);
        }
    } catch (err) {
        console.error('❌ Interaction Error:', err);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ An error occurred while executing this action.', ephemeral: true }).catch(() => {});
        }
    }
});

// Load Events
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
} catch {}

client.login(TOKEN);
