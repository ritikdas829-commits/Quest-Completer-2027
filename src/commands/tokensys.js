/**
 * tokensys.js - MongoDB Online Presence & Interactive Control Panel with Full Dynamic Emojis
 * Location: src/commands/tokensys.js
 */

import { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder, 
    StringSelectMenuOptionBuilder,
    MessageFlags 
} from 'discord.js';
import { startUserOnlinePresence, stopUserOnlinePresence } from '../quest/userPresence.js';
import { getEmojis } from '../quest/emoji.js';

// Helper: Build the interactive token control dashboard
async function buildTokenDashboard(client, guildId, userId) {
    const emojis = await getEmojis(guildId);
    const accounts = await client.tokenStore.getAllSlots(guildId, userId);
    const activeSlot = await client.tokenStore.getActiveSlot(guildId, userId);
    
    const embed = new EmbedBuilder();
    const components = [];

    if (!accounts || accounts.length === 0) {
        embed.setColor(0xED4245)
             .setTitle(`${emojis.error || '❌'} No Tokens Linked`)
             .setDescription('No accounts linked yet. Please use the `?link` command to add a token.');
        return { embeds: [embed], flags: MessageFlags.Ephemeral };
    }

    embed.setColor(0x5865F2)
         .setTitle(`${emojis.stats || '📊'} Token Status Dashboard & Control Panel`)
         .setDescription('Use the buttons below to bring your accounts online/offline or select a slot.');

    const menuOptions = [];
    for (const acc of accounts) {
        const isActive = activeSlot?.slot === acc.slot;
        const statusIcon = isActive ? (emojis.online || '🟢') : (emojis.dot || '⚪');
        
        embed.addFields({
            name: `Slot #${acc.slot} — ${acc.username || 'Linked Account'}`,
            value: `• **Status:** ${statusIcon} ${isActive ? 'Active (Online)' : 'Stored'}\n• **User ID:** \`${acc.linkedUserId || 'N/A'}\``,
            inline: false
        });

        menuOptions.push(
            new StringSelectMenuOptionBuilder()
                .setLabel(`Slot #${acc.slot}: ${acc.username || 'Account'}`)
                .setValue(`tokensys_select_${acc.slot}`)
                .setDescription(isActive ? 'Currently Active Slot' : 'Switch to this slot')
                .setDefault(isActive)
        );
    }

    // Dropdown for slots
    if (menuOptions.length > 0) {
        components.push(
            new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('tokensys_slot_select')
                    .setPlaceholder('Select active account slot...')
                    .addOptions(menuOptions)
            )
        );
    }

    // Control Buttons (Online On / Online Off / Refresh)
    components.push(
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('tokensys_btn_on').setLabel('Online On').setEmoji(emojis.online || '🟢').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('tokensys_btn_off').setLabel('Online Off').setEmoji(emojis.offline || '🔴').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('tokensys_btn_refresh').setLabel('Refresh Panel').setEmoji(emojis.gear || '🔄').setStyle(ButtonStyle.Secondary)
        )
    );

    return { embeds: [embed], components, flags: MessageFlags.Ephemeral };
}

// ─────────────────────────────────────────────
// 1. ONLINESTATUS (Dashboard Command)
// ─────────────────────────────────────────────
export const onlinestatus = {
    name: 'onlinestatus',
    prefix: 'onlinestatus',
    data: new SlashCommandBuilder()
        .setName('onlinestatus')
        .setDescription('Interactive dashboard to manage token slots and online presence'),
    
    async execute(interaction, client) {
        const panel = await buildTokenDashboard(client, interaction.guild?.id || 'global', interaction.user.id);
        await interaction.reply(panel);
    },

    async prefixExecute(message, _args, client) {
        const panel = await buildTokenDashboard(client, message.guild?.id || 'global', message.author.id);
        await message.reply(panel);
    }
};

// ─────────────────────────────────────────────
// 2. ONLINEON — Sets active slot & brings account online
// ─────────────────────────────────────────────
export const onlineon = {
    name: 'onlineon',
    prefix: 'onlineon',
    data: new SlashCommandBuilder()
        .setName('onlineon')
        .setDescription('Bring your linked token slot online 24/7')
        .addIntegerOption(o => o.setName('slot').setDescription('Slot number (1-5)').setMinValue(1).setMaxValue(5).setRequired(true)),
    
    async execute(interaction, client) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const slot = interaction.options.getInteger('slot');
        const guildId = interaction.guild?.id || 'global';
        const userId = interaction.user.id;
        const emojis = await getEmojis(guildId);

        await client.tokenStore.setActiveSlot(guildId, userId, slot);
        const active = await client.tokenStore.getActiveSlot(guildId, userId);

        if (!active || !active.token) {
            const errEmbed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle(`${emojis.error || '❌'} Slot Empty / Invalid Token`)
                .setDescription(`Slot **#${slot}** does not have a valid linked token, or the token is **expired/invalid**.\n\nPlease use the \`?link\` command to link a new token.`);
            return await interaction.editReply({ embeds: [errEmbed] });
        }

        // Start 24/7 Gateway Presence with Token Validation Check
        try {
            const res = await fetch('https://discord.com/api/v9/users/@me', {
                headers: { Authorization: active.token.trim().replace(/^['"]|['"]$/g, '') }
            });
            
            if (!res.ok) {
                const expiredEmbed = new EmbedBuilder()
                    .setColor(0xED4245)
                    .setTitle(`${emojis.error || '❌'} Token Expired or Invalid`)
                    .setDescription(`The token for Slot **#${slot}** was rejected by Discord (Invalid/Expired Token).\n\nPlease link your token again.`);
                return await interaction.editReply({ embeds: [expiredEmbed] });
            }
        } catch {}

        startUserOnlinePresence(userId, active.token, 'online');

        let targetUser = interaction.user;
        if (active.linkedUserId) {
            try {
                targetUser = await client.users.fetch(active.linkedUserId);
            } catch {}
        }

        const embed = await buildOnlineProfileEmbed(slot, targetUser, guildId);
        await interaction.editReply({ embeds: [embed] });
    },

    async prefixExecute(message, args, client) {
        const guildId = message.guild?.id || 'global';
        const userId = message.author.id;
        const slot = parseInt(args[0]);
        const emojis = await getEmojis(guildId);

        if (!slot || slot < 1 || slot > 5) {
            return message.reply({ content: `${emojis.error || '❌'} Please select a valid slot number (1-5). Example: \`;onlineon 1\``, allowedMentions: { repliedUser: false } });
        }

        await client.tokenStore.setActiveSlot(guildId, userId, slot);
        const active = await client.tokenStore.getActiveSlot(guildId, userId);

        if (!active || !active.token) {
            const errEmbed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle(`${emojis.error || '❌'} Slot Empty / Invalid Token`)
                .setDescription(`Slot **#${slot}** does not have a valid linked token, or the token is **expired/invalid**.\n\nPlease use the \`?link\` command to link a new token.`);
            return await message.reply({ embeds: [errEmbed], allowedMentions: { repliedUser: false } });
        }

        startUserOnlinePresence(userId, active.token, 'online');

        let targetUser = message.author;
        if (active.linkedUserId) {
            try {
                targetUser = await client.users.fetch(active.linkedUserId);
            } catch {}
        }

        const embed = await buildOnlineProfileEmbed(slot, targetUser, guildId);
        await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    }
};

// ── Helper: Profile Embed Generator with Full Dynamic Emojis ────────
async function buildOnlineProfileEmbed(slot, targetUser, guildId) {
    const emojis = await getEmojis(guildId);
    const avatarUrl = targetUser.displayAvatarURL({ dynamic: true, size: 256 });
    const createdAt = `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>`;

    return new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle(`${emojis.online || '🟢'} 24/7 Online Presence Activated!`)
        .setDescription(`Successfully activated **Slot #${slot}** and connected to Discord Gateway 24/7.`)
        .setThumbnail(avatarUrl)
        .addFields(
            { name: `${emojis.user || '👤'} User Name`, value: `\`${targetUser.tag || targetUser.username}\``, inline: true },
            { name: `${emojis.id || '🆔'} User ID`, value: `\`${targetUser.id}\``, inline: true },
            { name: `${emojis.slot || '🎰'} Active Slot`, value: `\`Slot #${slot}\``, inline: true },
            { name: `${emojis.calendar || '📅'} Account Created`, value: createdAt, inline: true },
            { name: `${emojis.globe || '🌐'} Connection Status`, value: `${emojis.online || '🟢'} **24/7 Gateway Online (Persistent)**`, inline: true }
        )
        .setFooter({ text: 'Orbie Quest Bot • 24/7 Presence Manager' })
        .setTimestamp();
}

// ─────────────────────────────────────────────
// 3. ONLINEOFF — Disconnects online presence
// ─────────────────────────────────────────────
exports = module.exports; // Compatible export wrapper if needed, below standard ESM:
export const onlineoff = {
    name: 'onlineoff',
    prefix: 'onlineoff',
    data: new SlashCommandBuilder()
        .setName('onlineoff')
        .setDescription('Disconnect account online presence and go offline'),
    
    async execute(interaction, client) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const guildId = interaction.guild?.id || 'global';
        const emojis = await getEmojis(guildId);

        stopUserOnlinePresence(interaction.user.id);

        const embed = new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle(`${emojis.offline || '🔴'} Account Offline`)
            .setDescription('Your account online gateway connection has been successfully disconnected.');

        await interaction.editReply({ embeds: [embed] });
    },

    async prefixExecute(message, _args, client) {
        const guildId = message.guild?.id || 'global';
        const emojis = await getEmojis(guildId);

        stopUserOnlinePresence(message.author.id);

        const embed = new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle(`${emojis.offline || '🔴'} Account Offline`)
            .setDescription('Your account online gateway connection has been successfully disconnected.');

        await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    }
};
