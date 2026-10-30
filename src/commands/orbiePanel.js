/**
 * orbiePanel.js - Orbie Premium & Trial Activation Panel
 */

import { 
    SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, PermissionFlagsBits, 
    ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags 
} from 'discord.js';
import mongoose from 'mongoose';
import { getEmojis } from '../quest/emoji.js';
import { getRoles } from '../quest/roleStore.js';

// Models
const KeyStore = mongoose.models.KeyStore || mongoose.model('KeyStore', new mongoose.Schema({
    keyString: String,
    assignedTo: String,
    type: String, // 'premium' | 'trial'
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
    slot: Number,
    type: String
}));

export const orbiePanelCmd = {
    data: new SlashCommandBuilder()
        .setName('orbiepanel')
        .setDescription('Send the Orbie Premium & Trial Activation Panel')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    prefix: 'orbiepanel',

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        await sendPublicPanel(interaction.channel, interaction.guildId, interaction.client);
        await interaction.editReply({ content: '✅ Orbie panel sent successfully!' });
    },

    async prefixExecute(message, args, client) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply({ content: '❌ You need Administrator permission.', allowedMentions: { repliedUser: false } });
        }
        try { await message.delete(); } catch {}
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
            `• 3 days Orbie Trial\n` +
            `• One lifetime trial per Discord account\n\n` +
            `${EMOJI.crown || '👑'} **Premium Keys**\n` +
            `• Full Orbie Premium (5 account slots)\n` +
            `• Extends existing premium\n\n` +
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

    // 1. Key exists?
    const keyDoc = await KeyStore.findOne({ keyString });
    if (!keyDoc) {
        return interaction.editReply({
            content: `${EMOJI.error || '❌'} **Invalid Key!**\nThis key does not exist.`
        });
    }

    // Determine key type safely (Gemini + Grok mix)
    const isPremiumKey = keyDoc.type === 'premium' || (!keyDoc.type && keyDoc.slot > 1);
    const targetRoleId = isPremiumKey ? roles.ROLE_PREMIUM : roles.ROLE_TRIAL;
    const conflictingRoleId = isPremiumKey ? roles.ROLE_TRIAL : null;

    // 2. Key locked to someone else?
    if (keyDoc.assignedTo && String(keyDoc.assignedTo) !== String(userId)) {
        return interaction.editReply({
            content: `${EMOJI.shield || '🔒'} **Key Sharing Restricted!**\nThis key is locked to another account.`
        });
    }

    // 3. Already redeemed → self recovery
    if (keyDoc.redeemed) {
        const userDoc = await UserTrial.findOne({ userId, active: true });

        if (String(keyDoc.assignedTo) === String(userId) || userDoc) {
            try {
                if (targetRoleId && !member.roles.cache.has(targetRoleId)) {
                    await member.roles.add(targetRoleId);
                }
                if (conflictingRoleId && member.roles.cache.has(conflictingRoleId)) {
                    await member.roles.remove(conflictingRoleId);
                }
            } catch (err) {
                console.error(`[Orbie] Role restore failed for ${userId}:`, err);
            }

            await UserTrial.findOneAndUpdate(
                { userId },
                { $set: { active: true } },
                { upsert: true }
            );

            if (!keyDoc.assignedTo) {
                keyDoc.assignedTo = userId;
                await keyDoc.save();
            }

            return interaction.editReply({
                content: `${EMOJI.success || '✅'} **Role Restored!**\nYour subscription is still active.`
            });
        }

        return interaction.editReply({
            content: `${EMOJI.error || '❌'} **Key Already Used!**\nThis key was already redeemed by someone else.`
        });
    }

    // 4. Already active check (with upgrade support)
    const hasPremiumRole = roles.ROLE_PREMIUM && member.roles.cache.has(roles.ROLE_PREMIUM);
    const hasTrialRole = roles.ROLE_TRIAL && member.roles.cache.has(roles.ROLE_TRIAL);

    if (isPremiumKey && hasPremiumRole) {
        return interaction.editReply({
            content: `${EMOJI.error || '❌'} **Already Premium!**\nYou already have an active Premium role.`
        });
    }
    if (!isPremiumKey && (hasTrialRole || hasPremiumRole)) {
        return interaction.editReply({
            content: `${EMOJI.error || '❌'} **Already Active!**\nYou already have Trial or Premium.`
        });
    }

    // 5. Calculate expiry
    const durationDays = keyDoc.durationDays;
    let expiresAt = null;
    const isLifetime = durationDays === 'lifetime' || durationDays === -1 || durationDays === 'unlimited';

    if (!isLifetime) {
        const days = parseInt(durationDays) || 30;
        expiresAt = Date.now() + (days * 24 * 60 * 60 * 1000);
    }

    // 6. Full activation (with proper error handling)
    try {
        keyDoc.redeemed = true;
        keyDoc.assignedTo = userId;
        await keyDoc.save();

        await UserTrial.findOneAndUpdate(
            { userId },
            {
                $set: {
                    claimedTrial: true,
                    active: true,
                    expiresAt,
                    durationDays,
                    slot: keyDoc.slot || 1,
                    type: isPremiumKey ? 'premium' : 'trial'
                }
            },
            { upsert: true }
        );

        // Assign role + remove old trial role if upgrading
        if (targetRoleId) {
            await member.roles.add(targetRoleId);
        }
        if (isPremiumKey && conflictingRoleId && member.roles.cache.has(conflictingRoleId)) {
            await member.roles.remove(conflictingRoleId).catch(() => {});
        }

        const expiryDisplay = expiresAt ? `<t:${Math.floor(expiresAt / 1000)}:R>` : 'Never (Lifetime)';
        const keyTypeText = isPremiumKey ? 'Premium' : 'Trial';

        return interaction.editReply({
            content: `${EMOJI.success || '✅'} **Key Activated Successfully!**\n` +
                     `**Type:** ${keyTypeText}\n` +
                     `**Slot:** #${keyDoc.slot || 1}\n` +
                     `⏳ **Expires:** ${expiryDisplay}`
        });

    } catch (err) {
        console.error('[Orbie] Activation error:', err);
        return interaction.editReply({
            content: `${EMOJI.error || '❌'} Something went wrong while activating. Please try again or contact admin.`
        });
    }
}
