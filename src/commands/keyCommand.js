/**
 * keyCommand.js - Key Generation with Auto-DM and Strict User Locking
 * Location: src/commands/keyCommand.js
 */

import { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { generateKeyByRole, setAdminKeyLimit } from '../quest/trialKeyStore.js';

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

        if (!targetUser) {
            return await message.reply(`❌ Kripya target user ko mention karein: \`;createkey @user 30\``);
        }

        await handleKeyGeneration(
            userId, guildOwnerId, targetUser, requestedDays,
            async (opts) => await message.reply(opts)
        );
    }
};

async function handleKeyGeneration(userId, guildOwnerId, targetUser, requestedDays, replyFn) {
    const targetUserId = targetUser ? targetUser.id : null;
    const result = await generateKeyByRole(userId, guildOwnerId, targetUserId, requestedDays);

    if (!result.success) {
        const errCard = new ContainerBuilder().setAccentColor(0xED4245);
        errCard.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ❌ Permission / Limit Error\n${result.message}`));
        return await replyFn({ components: [errCard], flags: MessageFlags.Ephemeral });
    }

    // 📬 Auto-DM to the target user with key details & strict warning
    if (targetUser) {
        try {
            const dmCard = new ContainerBuilder().setAccentColor(0x57F287);
            dmCard.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `# 🎁 Aapke Liye Orbie Key Generate Ho Gayi Hai!\n\n` +
                    `Aapke liye ek exclusive key banai gayi hai:\n` +
                    `**Key:** \`\`\`${result.key}\`\`\`\n` +
                    `**Duration:** ${requestedDays} Days\n\n` +
                    `### 🔒 Security Notice:\n` +
                    `• Yeh key **sirf aur sirf aapke account** ke liye locked hai.\n` +
                    `• Agar aap yeh key kisi aur ko doge, toh woh ise redeem nahi kar payega!\n\n` +
                    `### 🚀 Kaise Activate Karein?\n` +
                    `1. Server ke **#orbie-panel** channel par jayein.\n` +
                    `2. **Activate Premium** button par click karke apni key enter karein.\n` +
                    `3. Aapka Trial/Premium role aur Slots turant unlock ho jayenge!`
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
            `# ✅ Key Generated & Locked Successfully\n` +
            `**Key:** \`\`\`${result.key}\`\`\`\n` +
            `**Locked To:** ${targetUser ? targetUser.tag : 'Anyone'}\n` +
            `**Duration:** ${requestedDays} Days\n` +
            `**Status:** Key user ke **DM** mein bhej di gayi hai aur yeh sirf wahi use kar payega! (${result.remaining})`
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

    async prefixExecute(message, args) {
        if (message.author.id !== message.guild.ownerId) {
            return await message.reply(`❌ Yeh command sirf server ka **OriginalOwner** hi use kar sakta hai!`);
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
