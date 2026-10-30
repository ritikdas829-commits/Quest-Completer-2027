/**
 * keyCommand.js - Key Generation, Admin Limits & User Trial Status Check
 * Location: src/commands/keyCommand.js
 */

import { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { generateKeyByRole, setAdminKeyLimit } from '../quest/trialKeyStore.js';
import { getEmojis } from '../quest/emoji.js';
import mongoose from 'mongoose';

// UserTrial Model reference
const UserTrial = mongoose.models.UserTrial || mongoose.model('UserTrial', new mongoose.Schema({
    userId: String,
    claimedTrial: Boolean,
    active: Boolean,
    expiresAt: Number,
    durationDays: mongoose.Schema.Types.Mixed,
    slot: Number,
    type: String
}));

export const adminCreateKeyCmd = {
    data: new SlashCommandBuilder()
        .setName('createkey')
        .setDescription('Generate a locked key with Slot and Duration (Admin Only)')
        .addUserOption(o => o.setName('user').setDescription('Target user who can exclusively use this key').setRequired(true))
        .addIntegerOption(o => 
            o.setName('slot')
             .setDescription('Select account slot (1 to 5)')
             .setRequired(true)
             .addChoices(
                 { name: 'Slot 1', value: 1 },
                 { name: 'Slot 2', value: 2 },
                 { name: 'Slot 3', value: 3 },
                 { name: 'Slot 4', value: 4 },
                 { name: 'Slot 5', value: 5 }
             )
        )
        .addStringOption(o => o.setName('duration').setDescription('Duration (e.g., 30d, 11d, lifetime)').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    prefix: 'createkey',

    // Slash Command Execution
    async execute(interaction) {
        const userId = interaction.user.id;
        const guildOwnerId = interaction.guild.ownerId;
        const guildId = interaction.guildId;
        
        const targetUser = interaction.options.getUser('user');
        const slot = interaction.options.getInteger('slot');
        const duration = interaction.options.getString('duration');

        await handleKeyGeneration(
            userId, guildOwnerId, targetUser, slot, duration, guildId, interaction.guild,
            async (opts) => await interaction.reply(opts)
        );
    },

    // Prefix Command Execution (;createkey @user 1 30d)
    async prefixExecute(message, args) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;

        const userId = message.author.id;
        const guildOwnerId = message.guild.ownerId;
        const guildId = message.guild.id;

        const targetUser = message.mentions.users.first() || null;
        const slot = parseInt(args[1]);
        const duration = args[2] || '30d';

        if (!targetUser || !slot || slot < 1 || slot > 5) {
            const EMOJI = await getEmojis(guildId);
            return await message.reply({ 
                content: `${EMOJI.error || '❌'} Correct usage: \`;createkey @user [slot 1-5] [duration]\` (Example: \`;createkey @user 1 30d\`)`, 
                allowedMentions: { repliedUser: false } 
            });
        }

        await handleKeyGeneration(
            userId, guildOwnerId, targetUser, slot, duration, guildId, message.guild,
            async (opts) => await message.reply({ ...opts, allowedMentions: { repliedUser: false } })
        );
    }
};

async function handleKeyGeneration(userId, guildOwnerId, targetUser, slot, duration, guildId, guild, replyFn) {
    const EMOJI = await getEmojis(guildId || 'global');
    const targetUserId = targetUser ? targetUser.id : null;
    
    const result = await generateKeyByRole(userId, guildOwnerId, targetUserId, duration, slot);

    if (!result.success) {
        const errCard = new ContainerBuilder().setAccentColor(0xED4245);
        errCard.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${EMOJI.error || '❌'} Permission / Limit Error\n${result.message}`));
        return await replyFn({ components: [errCard], flags: MessageFlags.Ephemeral });
    }

    const panelChannel = guild?.channels.cache.find(c => c.name.includes('panel') || c.name.includes('orbie')) || '#orbie-panel';

    if (targetUser) {
        try {
            const dmCard = new ContainerBuilder().setAccentColor(0x57F287);
            dmCard.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `# ${EMOJI.gift || '🎁'} Your Orbie Key Has Been Generated!\n\n` +
                    `An exclusive key has been created for you:\n` +
                    `**Key:** \`\`\`${result.key}\`\`\`\n` +
                    `${EMOJI.slot || '🎰'} **Assigned Slot:** Slot #${slot}\n` +
                    `${EMOJI.duration || '🎯'} **Duration:** ${duration}\n\n` +
                    `### ${EMOJI.shield || '🔒'} Security Notice:\n` +
                    `• This key is **strictly locked** to your Discord account.\n` +
                    `• If shared with anyone else, they will not be able to redeem it!\n\n` +
                    `### ${EMOJI.rocket || '🚀'} How to Activate:\n` +
                    `1. Go to the ${panelChannel} channel in the server.\n` +
                    `2. Click the **Activate Premium** button and paste your key.\n` +
                    `3. Your Trial/Premium role and **Slot #${slot}** will be unlocked instantly!`
                )
            );
            await targetUser.send({ components: [dmCard], flags: MessageFlags.IsComponentsV2 });
        } catch (err) {
            console.error("Could not send DM to target user:", err);
        }
    }

    const c = new ContainerBuilder().setAccentColor(0x57F287);
    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `# ${EMOJI.success || '✅'} Key Generated & Locked Successfully\n` +
            `**Key:** \`\`\`${result.key}\`\`\`\n` +
            `**Locked To:** ${targetUser ? targetUser.tag : 'Anyone'}\n` +
            `${EMOJI.slot || '🎰'} **Slot:** Slot #${slot}\n` +
            `${EMOJI.duration || '🎯'} **Duration:** ${duration}\n` +
            `**Status:** Key has been sent to user's **DM**! (${result.remaining || 'Unlimited'})`
        )
    );
    await replyFn({ components: [c], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
}

// Owner command to set specific limit for an admin
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

// 📊 NEW: Check any user's Trial/Premium status command
export const checkTrialCmd = {
    data: new SlashCommandBuilder()
        .setName('checktrial')
        .setDescription('Check active status, trial claim, slot & expiry of any user (Admin Only)')
        .addUserOption(o => o.setName('user').setDescription('Target user to check').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    prefix: 'checktrial',

    async execute(interaction) {
        const EMOJI = await getEmojis(interaction.guildId);
        const targetUser = interaction.options.getUser('user');
        const userId = targetUser.id;

        const userDoc = await UserTrial.findOne({ userId });

        const card = new ContainerBuilder().setAccentColor(userDoc?.active ? 0x57F287 : 0xED4245);

        if (!userDoc) {
            card.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `# ${EMOJI.error || '❌'} No Record Found\n` +
                    `User <@${userId}> has **never** claimed a trial or redeemed any key.`
                )
            );
            return await interaction.reply({ components: [card], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
        }

        const expiryDisplay = userDoc.expiresAt ? `<t:${Math.floor(userDoc.expiresAt / 1000)}:F> (<t:${Math.floor(userDoc.expiresAt / 1000)}:R>)` : 'Never (Lifetime)';
        const typeText = userDoc.type ? userDoc.type.toUpperCase() : 'TRIAL/BASE';
        const statusText = userDoc.active ? '🟢 **Active**' : '🔴 **Expired / Inactive**';

        card.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `# 📊 User Status: ${targetUser.tag}\n\n` +
                `• **User ID:** \`${userId}\`\n` +
                `• **Status:** ${statusText}\n` +
                `• **Subscription Type:** \`${typeText}\`\n` +
                `• **Claimed Trial?** ${userDoc.claimedTrial ? '✅ Yes' : '❌ No'}\n` +
                `• **Unlocked Slot:** Slot #${userDoc.slot || 1}\n` +
                `• **Expiry Time:** ${expiryDisplay}`
            )
        );

        await interaction.reply({ components: [card], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    },

    async prefixExecute(message, args) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        const EMOJI = await getEmojis(message.guild.id);
        const targetUser = message.mentions.users.first();

        if (!targetUser) {
            return await message.reply({ content: `${EMOJI.error || '❌'} Please mention a user: \`;checktrial @user\``, allowedMentions: { repliedUser: false } });
        }

        const userId = targetUser.id;
        const userDoc = await UserTrial.findOne({ userId });
        const card = new ContainerBuilder().setAccentColor(userDoc?.active ? 0x57F287 : 0xED4245);

        if (!userDoc) {
            card.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `# ${EMOJI.error || '❌'} No Record Found\n` +
                    `User <@${userId}> has **never** claimed a trial or redeemed any key.`
                )
            );
            return await message.reply({ components: [card], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } });
        }

        const expiryDisplay = userDoc.expiresAt ? `<t:${Math.floor(userDoc.expiresAt / 1000)}:F> (<t:${Math.floor(userDoc.expiresAt / 1000)}:R>)` : 'Never (Lifetime)';
        const typeText = userDoc.type ? userDoc.type.toUpperCase() : 'TRIAL/BASE';
        const statusText = userDoc.active ? '🟢 **Active**' : '🔴 **Expired / Inactive**';

        card.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `# 📊 User Status: ${targetUser.tag}\n\n` +
                `• **User ID:** \`${userId}\`\n` +
                `• **Status:** ${statusText}\n` +
                `• **Subscription Type:** \`${typeText}\`\n` +
                `• **Claimed Trial?** ${userDoc.claimedTrial ? '✅ Yes' : '❌ No'}\n` +
                `• **Unlocked Slot:** Slot #${userDoc.slot || 1}\n` +
                `• **Expiry Time:** ${expiryDisplay}`
            )
        );

        await message.reply({ components: [card], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } });
    }
};
