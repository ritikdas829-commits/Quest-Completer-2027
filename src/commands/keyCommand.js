/**
 * keyCommand.js - Key Generation with Auto-DM, Strict User Locking & Dynamic Emoji System
 * Location: src/commands/keyCommand.js
 */

import { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { generateKeyByRole, setAdminKeyLimit } from '../quest/trialKeyStore.js';
import { getEmojis } from '../quest/emoji.js';

export const adminCreateKeyCmd = {
    data: new SlashCommandBuilder()
        .setName('createkey')
        .setDescription('Generate a locked key for a specific user and auto-send to DM')
        .addUserOption(o => o.setName('user').setDescription('Target user who can exclusively use this key').setRequired(true))
        .addIntegerOption(o => o.setName('days').setDescription('Duration in days (Owner custom, Admin max 30)').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    prefix: 'createkey',

    // Slash Command Execution
    async execute(interaction) {
        const userId = interaction.user.id;
        const guildOwnerId = interaction.guild.ownerId;
        const guildId = interaction.guildId;
        
        const targetUser = interaction.options.getUser('user');
        const requestedDays = interaction.options.getInteger('days') || 30;

        await handleKeyGeneration(
            userId, guildOwnerId, targetUser, requestedDays, guildId,
            async (opts) => await interaction.reply(opts)
        );
    },

    // Prefix Command Execution (;createkey @user 30)
    async prefixExecute(message, args) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;

        const userId = message.author.id;
        const guildOwnerId = message.guild.ownerId;
        const guildId = message.guild.id;

        const targetUser = message.mentions.users.first() || null;
        const requestedDays = args[1] ? parseInt(args[1]) || 30 : 30;

        if (!targetUser) {
            const EMOJI = await getEmojis(guildId);
            return await message.reply({ 
                content: `${EMOJI.error || '❌'} Please mention a target user: \`;createkey @user 30\``, 
                allowedMentions: { repliedUser: false } 
            });
        }

        await handleKeyGeneration(
            userId, guildOwnerId, targetUser, requestedDays, guildId,
            async (opts) => await message.reply({ ...opts, allowedMentions: { repliedUser: false } })
        );
    }
};

async function handleKeyGeneration(userId, guildOwnerId, targetUser, requestedDays, guildId, replyFn) {
    const EMOJI = await getEmojis(guildId || 'global');
    const targetUserId = targetUser ? targetUser.id : null;
    const result = await generateKeyByRole(userId, guildOwnerId, targetUserId, requestedDays);

    if (!result.success) {
        const errCard = new ContainerBuilder().setAccentColor(0xED4245);
        errCard.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${EMOJI.error || '❌'} Permission / Limit Error\n${result.message}`));
        return await replyFn({ components: [errCard], flags: MessageFlags.Ephemeral });
    }

    // 📬 Auto-DM to the target user with key details & strict security warning
    if (targetUser) {
        try {
            const dmCard = new ContainerBuilder().setAccentColor(0x57F287);
            dmCard.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `# ${EMOJI.gift || '🎁'} Your Orbie Key Has Been Generated!\n\n` +
                    `An exclusive key has been created for you:\n` +
                    `**Key:** \`\`\`${result.key}\`\`\`\n` +
                    `${EMOJI.duration || '🎯'} **Duration:** ${requestedDays} Days\n\n` +
                    `### ${EMOJI.shield || '🔒'} Security Notice:\n` +
                    `• This key is **strictly locked** to your Discord account.\n` +
                    `• If shared with anyone else, they will not be able to redeem it!\n\n` +
                    `### ${EMOJI.rocket || '🚀'} How to Activate:\n` +
                    `1. Go to the **#orbie-panel** channel in the server.\n` +
                    `2. Click the **Activate Premium** button and paste your key.\n` +
                    `3. Your Trial/Premium role and slots will be unlocked instantly!`
                )
            );
            await targetUser.send({ components: [dmCard], flags: MessageFlags.IsComponentsV2 });
        } catch (err) {
            console.error("Could not send DM to target user:", err);
        }
    }

    // Response to Admin/Owner
    const c = new ContainerBuilder().setAccentColor(0x57F287);
    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `# ${EMOJI.success || '✅'} Key Generated & Locked Successfully\n` +
            `**Key:** \`\`\`${result.key}\`\`\`\n` +
            `**Locked To:** ${targetUser ? targetUser.tag : 'Anyone'}\n` +
            `${EMOJI.duration || '🎯'} **Duration:** ${requestedDays} Days\n` +
            `**Status:** Key has been sent to the user's **DM** and is exclusively locked to them! (${result.remaining})`
        )
    );
    await replyFn({ components: [c], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
}

// Optional: Owner command to set specific limit for an admin
export const setLimitCmd = {
    data: new SlashCommandBuilder()
        .setName('setadminlimit')
        .setDescription('[Owner Only] Set key generation limit for an admin')
        .addUserOption(o => o.setName('admin').setDescription('Select admin').setRequired(true))
        .addIntegerOption(o => o.setName('limit').setDescription('Max keys they can generate').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    prefix: 'setadminlimit',

    async execute(interaction) {
        const EMOJI = await getEmojis(interaction.guildId);
        if (interaction.user.id !== interaction.guild.ownerId) {
            return await interaction.reply({ content: `${EMOJI.error || '❌'} This command can only be used by the server **Original Owner**!`, flags: MessageFlags.Ephemeral });
        }

        const targetAdmin = interaction.options.getUser('admin');
        const limit = interaction.options.getInteger('limit');

        await setAdminKeyLimit(targetAdmin.id, limit);

        const c = new ContainerBuilder().setAccentColor(0x57F287);
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${EMOJI.success || '✅'} Limit Updated\nAdmin ${targetAdmin.tag} has been granted a limit of **${limit}** key generations!`));
        await interaction.reply({ components: [c], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    },

    async prefixExecute(message, args) {
        const EMOJI = await getEmojis(message.guild.id);
        if (message.author.id !== message.guild.ownerId) {
            return await message.reply({ content: `${EMOJI.error || '❌'} This command can only be used by the server **Original Owner**!`, allowedMentions: { repliedUser: false } });
        }

        const targetAdmin = message.mentions.users.first();
        const limit = parseInt(args[1]);

        if (!targetAdmin || isNaN(limit)) {
            return await message.reply({ content: `${EMOJI.error || '❌'} Correct format usage: \`;setadminlimit @admin 5\``, allowedMentions: { repliedUser: false } });
        }

        await setAdminKeyLimit(targetAdmin.id, limit);

        const c = new ContainerBuilder().setAccentColor(0x57F287);
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${EMOJI.success || '✅'} Limit Updated\nAdmin ${targetAdmin.tag} has been granted a limit of **${limit}** key generations!`));
        await message.reply({ components: [c], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } });
    }
};
