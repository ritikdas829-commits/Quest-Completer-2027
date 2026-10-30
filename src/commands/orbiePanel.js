/**
 * orbiePanel.js - Send the Public Premium Activation Panel & Secure Modal Handler
 * Location: src/commands/orbiePanel.js
 */

import { 
    SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, PermissionFlagsBits, 
    ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags 
} from 'discord.js';
import mongoose from 'mongoose';
import { getEmojis } from '../quest/emoji.js';
import { getRoles } from '../quest/roleStore.js';

// Mongoose Models reference
const KeyStore = mongoose.models.KeyStore || mongoose.model('KeyStore', new mongoose.Schema({
    keyString: String,
    assignedTo: String,
    type: String, // 'premium' ya 'trial'
    durationDays: mongoose.Schema.Types.Mixed,
    slot: Number,
    redeemed: Boolean,
    createdAt: Number
}));

const UserTrial = mongoose.models.UserTrial || mongoose.model('UserTrial', new mongoose.Schema({
    userId: String,
    claimedTrial: Boolean,
    active: Boolean,
    expiresAt: Number,
    durationDays: mongoose.Schema.Types.Mixed,
    slot: Number
}));

export const orbiePanelCmd = {
    data: new SlashCommandBuilder()
        .setName('orbiepanel')
        .setDescription('Send the Orbie Premium & Trial Activation Panel to the channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    prefix: 'orbiepanel',

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        await sendPublicPanel(interaction.channel, interaction.guildId, interaction.client);
        await interaction.editReply({ content: '✅ Orbie panel has been successfully sent to this channel!' });
    },

    async prefixExecute(message, args, client) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply({ content: '❌ You do not have administrator permissions.', allowedMentions: { repliedUser: false } });
        }
        try { await message.delete(); } catch (err) {}
        await sendPublicPanel(message.channel, message.guildId, client);
    }
};

async function sendPublicPanel(channel, guildId, client) {
    const EMOJI = await getEmojis(guildId || 'global');

    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`${EMOJI.premium || '💎'} Orbie Premium & Trial Panel`)
        .setDescription(
            `Unlock Orbie Premium automation, video/desktop quest support, and active notifications.\n\n` +
            `${EMOJI.trial || '💎'} **Trial Keys**\n` +
            `• Grant Orbie Trial for 3 days.\n` +
            `• Limited to one lifetime trial redemption per Discord account.\n\n` +
            `${EMOJI.crown || '👑'} **Premium Keys**\n` +
            `• Grant full Orbie Premium (5 active account slots).\n` +
            `• Extend existing paid premium periods natively.\n\n` +
            `${EMOJI.ticket || '🎫'} **Activation**\n` +
            `Click the button below to activate your key!`
        )
        .setFooter({ text: 'Thank you for using Orbie.' });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('open_activate_modal')
            .setLabel('Activate Premium')
            .setStyle(ButtonStyle.Success)
            .setEmoji(EMOJI.success || '✅')
    );

    await channel.send({ embeds: [embed], components: [row] });
}

export async function handleOrbieButton(interaction) {
    if (!interaction.isButton() || interaction.customId !== 'open_activate_modal') return false;

    const modal = new ModalBuilder()
        .setCustomId('orbie_activate_modal')
        .setTitle('Activate Premium / Trial');

    const keyInput = new TextInputBuilder()
        .setCustomId('key_input')
        .setLabel('Premium / Trial Key *')
        .setPlaceholder('Enter your 14-character key...')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMinLength(14)
        .setMaxLength(14);

    modal.addComponents(new ActionRowBuilder().addComponents(keyInput));
    await interaction.showModal(modal);
    return true;
}

export async function handleOrbieModalSubmit(interaction) {
    if (!interaction.isModalSubmit() || interaction.customId !== 'orbie_activate_modal') return false;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const guildId = interaction.guildId;
    const member = interaction.member;
    const userId = interaction.user.id;
    const EMOJI = await getEmojis(guildId);
    const roles = getRoles(guildId);

    const keyString = interaction.fields.getTextInputValue('key_input').trim();

    // 🛑 Check 1: Key Existence Check
    const keyDoc = await KeyStore.findOne({ keyString });
    if (!keyDoc) {
        return await interaction.editReply({
            content: `${EMOJI.error || '❌'} **Invalid Key!**\nThe key you entered does not exist in our database. Please check and try again.`
        });
    }

    // Determine target role based on key type (Grok Point #2)
    const isPremiumKey = keyDoc.type === 'premium' || (!keyDoc.type && keyDoc.slot > 1);
    const targetRoleId = isPremiumKey ? roles.ROLE_PREMIUM : roles.ROLE_TRIAL;
    const conflictingRoleId = isPremiumKey ? roles.ROLE_TRIAL : null; // If upgrading from trial to premium

    // 🛑 Check 2: Key Ownership Check
    if (keyDoc.assignedTo && String(keyDoc.assignedTo) !== String(userId)) {
        return await interaction.editReply({
            content: `${EMOJI.shield || '🔒'} **Key Sharing Restricted!**\nThis key is strictly locked to another Discord account. You cannot use someone else's key!`
        });
    }

    // 🛑 Check 3: Already Redeemed & Self-Recovery Check
    if (keyDoc.redeemed) {
        const userTrialDoc = await UserTrial.findOne({ userId, active: true });

        if (String(keyDoc.assignedTo) === String(userId) || userTrialDoc) {
            if (targetRoleId && !member.roles.cache.has(targetRoleId)) {
                try {
                    await member.roles.add(targetRoleId);
                    // Remove trial role if upgrading to premium
                    if (conflictingRoleId && member.roles.cache.has(conflictingRoleId)) {
                        await member.roles.remove(conflictingRoleId).catch(() => {});
                    }
                } catch (err) {
                    console.error(`[Orbie] Role restore failed for ${userId}:`, err);
                }
            }

            await UserTrial.findOneAndUpdate(
                { userId },
                { $set: { active: true } },
                { upsert: true, new: true }
            );

            return await interaction.editReply({
                content: `${EMOJI.success || '✅'} **Role Restored Successfully!**\nYour subscription is active, and your role has been given back to you!`
            });
        }

        return await interaction.editReply({
            content: `${EMOJI.error || '❌'} **Key Already Redeemed!**\nThis key has already been used by someone else.`
        });
    }

    // 🛑 Check 4: Already Active Check (With Upgrade Support - Grok Point #4)
    const hasPremiumRole = roles.ROLE_PREMIUM && member.roles.cache.has(roles.ROLE_PREMIUM);
    const hasTrialRole = roles.ROLE_TRIAL && member.roles.cache.has(roles.ROLE_TRIAL);

    if (isPremiumKey && hasPremiumRole) {
        return await interaction.editReply({
            content: `${EMOJI.error || '❌'} **Already Premium!**\nYou already have an active Premium role.`
        });
    }
    if (!isPremiumKey && (hasTrialRole || hasPremiumRole)) {
        return await interaction.editReply({
            content: `${EMOJI.error || '❌'} **Already Active!**\nYou already have an active Trial or Premium role.`
        });
    }

    // 🚀 Expiry Calculation
    const durationDays = keyDoc.durationDays;
    let expiresAt = null;
    const isLifetime = durationDays === 'lifetime' || durationDays === -1 || durationDays === 'unlimited';

    if (!isLifetime) {
        const days = parseInt(durationDays) || 30;
        expiresAt = Date.now() + (days * 24 * 60 * 60 * 1000);
    }

    // 📝 Mark Key as Redeemed
    keyDoc.redeemed = true;
    keyDoc.assignedTo = userId;
    await keyDoc.save();

    // 📝 Update User Database
    await UserTrial.findOneAndUpdate(
        { userId },
        {
            $set: {
                claimedTrial: true,
                active: true,
                expiresAt: expiresAt,
                durationDays: durationDays,
                slot: keyDoc.slot || 1
            }
        },
        { upsert: true, new: true }
    );

    // 👑 Assign Role (and cleanup old trial role if upgrading)
    if (targetRoleId) {
        try {
            await member.roles.add(targetRoleId);
            if (isPremiumKey && conflictingRoleId && member.roles.cache.has(conflictingRoleId)) {
                await member.roles.remove(conflictingRoleId).catch(() => {});
            }
        } catch (err) {
            console.error(`[Orbie] Role assign failed for ${userId}:`, err);
        }
    }

    const expiryDisplay = expiresAt ? `<t:${Math.floor(expiresAt / 1000)}:R>` : 'Never (Lifetime)';
    return await interaction.editReply({
        content: `${EMOJI.success || '✅'} **Key Activated Successfully!**\n` +
                 `Your key has been verified, and **Slot #${keyDoc.slot || 1}** along with your role has been unlocked!\n` +
                 `⏳ **Expires:** ${expiryDisplay}`
    });
}
