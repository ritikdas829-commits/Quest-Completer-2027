/**
 * trialCommand.js - Key Generation with Owner & Admin Permission Handling
 * Location: src/commands/trialCommand.js
 */

import { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { generateKeyByRole, setAdminKeyLimit } from '../quest/trialKeyStore.js';

export const adminCreateKeyCmd = {
    data: new SlashCommandBuilder()
        .setName('createkey')
        .setDescription('Generate a key for a user (Owner: Unlimited/Lifetime, Admin: Limited/Max 30d)')
        .addUserOption(o => o.setName('user').setDescription('Target user to lock this key to').setRequired(false))
        .addIntegerOption(o => o.setName('days').setDescription('Duration in days (Owner can set custom, Admin max 30)').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    prefix: 'createkey',

    // Slash Command Execution
    async execute(interaction) {
        const userId = interaction.user.id;
        const guildOwnerId = interaction.guild.ownerId;
        
        const targetUser = interaction.options.getUser('user');
        const requestedDays = interaction.options.getInteger('days') || 30;

        await handleKeyGeneration(
            userId, guildOwnerId, targetUser, requestedDays,
            async (opts) => await interaction.reply(opts)
        );
    },

    // Prefix Command Execution (;createkey @user 30)
    async prefixExecute(message, args) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;

        const userId = message.author.id;
        const guildOwnerId = message.guild.ownerId;

        const targetUser = message.mentions.users.first() || null;
        const requestedDays = args[1] ? parseInt(args[1]) || 30 : 30;

        await handleKeyGeneration(
            userId, guildOwnerId, targetUser, requestedDays,
            async (opts) => await message.reply(opts)
        );
    }
};

// Helper function to avoid code duplication for both Slash & Prefix
async function handleKeyGeneration(userId, guildOwnerId, targetUser, requestedDays, replyFn) {
    const result = await generateKeyByRole(userId, guildOwnerId, targetUser ? targetUser.id : null, requestedDays);

    if (!result.success) {
        const errCard = new ContainerBuilder().setAccentColor(0xED4245);
        errCard.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ❌ Permission / Limit Error\n${result.message}`));
        return await replyFn({ components: [errCard], flags: MessageFlags.Ephemeral });
    }

    const c = new ContainerBuilder().setAccentColor(0x57F287);
    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `# ✅ Key Generated Successfully\n` +
            `**Key:** \`\`\`${result.key}\`\`\`\n` +
            `**Assigned To:** ${targetUser ? targetUser.tag : 'Anyone'}\n` +
            `**Duration:** ${requestedDays > 30 ? `${requestedDays} Days (Owner Privilege)` : `${requestedDays} Days`}\n` +
            `**Status:** ${result.remaining}`
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

    // Slash Command
    async execute(interaction) {
        if (interaction.user.id !== interaction.guild.ownerId) {
            return await interaction.reply({ content: `❌ Yeh command sirf server ka **Original Owner** hi use kar sakta hai!`, flags: MessageFlags.Ephemeral });
        }

        const targetAdmin = interaction.options.getUser('admin');
        const limit = interaction.options.getInteger('limit');

        await setAdminKeyLimit(targetAdmin.id, limit);

        const c = new ContainerBuilder().setAccentColor(0x57F287);
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ✅ Limit Updated\nAdmin ${targetAdmin.tag} ko **${limit}** keys banane ki limit de di gayi hai!`));
        await interaction.reply({ components: [c], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    },

    // Prefix Command (;setadminlimit @admin 5)
    async prefixExecute(message, args) {
        if (message.author.id !== message.guild.ownerId) {
            return await message.reply(`❌ Yeh command sirf server ka **Original Owner** hi use kar sakta hai!`);
        }

        const targetAdmin = message.mentions.users.first();
        const limit = parseInt(args[1]);

        if (!targetAdmin || isNaN(limit)) {
            return await message.reply(`❌ Sahi format use karein: \`;setadminlimit @admin 5\``);
        }

        await setAdminKeyLimit(targetAdmin.id, limit);

        const c = new ContainerBuilder().setAccentColor(0x57F287);
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ✅ Limit Updated\nAdmin ${targetAdmin.tag} ko **${limit}** keys banane ki limit de di gayi hai!`));
        await message.reply({ components: [c], flags: MessageFlags.IsComponentsV2 });
    }
};
