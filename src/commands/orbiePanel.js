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
    type: String,
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

    // Slash Command Execution
    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        await sendPublicPanel(interaction.channel, interaction.guildId, interaction.client);
        await interaction.editReply({ content: '✅ Orbie panel has been successfully sent to this channel!' });
    },

    // Prefix Command Execution (;orbiepanel)
    async prefixExecute(message, args, client) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply({ content: '❌ You do not have administrator permissions.', allowedMentions: { repliedUser: false } });
        }
        try { await message.delete(); } catch (err) {}
        await sendPublicPanel(message.channel, message.guildId, client);
    }
};

/**
 * Core function to build and send the public panel with clean emoji integration
 */
async function sendPublicPanel(channel, guildId, client) {
    const EMOJI = await getEmojis(guildId || 'global');

    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`${EMOJI.premium || '💎'} Orbie Premium & Trial Panel`)
        .setDescription(
            `Unlock Orbie Premium automation, video/desktop quest support, and active notifications.\n\n` +
            `${EMOJI.trial || '💎'} **Trial Keys**\n` +
            `• Grant Orbie Trial for 3 days.\n` +
            `• Limited to one lifetime trial redemption per Discord account.\n` +
            `• Trial accounts can only link their own Discord token (no alts).\n\n` +
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

    await channel.send({
        embeds: [embed],
        components: [row]
    });
}

/**
 * Button Click Handler: Opens the popup modal when the panel button is clicked
 */
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

/**
 * Secure Modal Submit Handler: Handles Key Verification, Role Checks, and Activation
 */
export async function handleOrbieModalSubmit(interaction) {
    if (!interaction.isModalSubmit() || interaction.customId !== 'orbie_activate_modal') return false;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const guildId = interaction.guildId;
    const member = interaction.member;
    const userId = interaction.user.id;
    const EMOJI = await getEmojis(guildId);
    const roles = getRoles(guildId);

    // 🛑 Check 1: Role Pre-check (Agar user ke paas pehle se active role hai)
    const hasExistingRole = 
        (roles.ROLE_TRIAL && member.roles.cache.has(roles.ROLE_TRIAL)) ||
        (roles.ROLE_PREMIUM && member.roles.cache.has(roles.ROLE_PREMIUM)) ||
        (roles.ROLE_2_BOOST && member.roles.cache.has(roles.ROLE_2_BOOST));

    if (hasExistingRole) {
        return await interaction.editReply({
            content: `${EMOJI.error || '❌'} **Already Active!**\nYou already have an active Trial or Premium role in this server. You cannot redeem another key right now.`
        });
    }

    const keyString = interaction.fields.getTextInputValue('key_input').trim();

    // 🛑 Check 2: Key Existence Check
    const keyDoc = await KeyStore.findOne({ keyString });
    if (!keyDoc) {
        return await interaction.editReply({
            content: `${EMOJI.error || '❌'} **Invalid Key!**\nThe key you entered does not exist in our database. Please check and try again.`
        });
    }

    // 🛑 Check 3: Key Already Redeemed Check (With self-recovery / role restore support)
    if (keyDoc.redeemed) {
        // Agar key pehle se redeemed hai, par woh usi user ki hai toh role wapas de do
        if (keyDoc.assignedTo === userId) {
            const targetRoleId = roles.ROLE_PREMIUM || roles.ROLE_TRIAL;
            if (targetRoleId && !member.roles.cache.has(targetRoleId)) {
                await member.roles.add(targetRoleId).catch(err => console.error("Failed to restore role:", err));
            }
            return await interaction.editReply({
                content: `${EMOJI.success || '✅'} **Role Restored Successfully!**\nYour subscription is still active, so your role has been successfully given back to you!`
            });
        }

        return await interaction.editReply({
            content: `${EMOJI.error || '❌'} **Key Already Redeemed!**\nThis key has already been used by someone else.`
        });
    }

    // 🛑 Check 4: Key Sharing / Account Locking Check (Strict Ownership)
    if (keyDoc.assignedTo && keyDoc.assignedTo !== userId) {
        return await interaction.editReply({
            content: `${EMOJI.shield || '🔒'} **Key Sharing Restricted!**\nThis key is strictly locked to another Discord account. You cannot use someone else's key!`
        });
    }

    // 🚀 Expiry Calculation
    const durationDays = keyDoc.durationDays;
    let expiresAt = null;

    if (durationDays !== 'lifetime' && durationDays !== -1) {
        const days = parseInt(durationDays) || 30;
        expiresAt = Date.now() + (days * 24 * 60 * 60 * 1000);
    } else {
        expiresAt = null; // Lifetime support
    }

    // 📝 Mark Key as Redeemed
    keyDoc.redeemed = true;
    await keyDoc.save();

    // 📝 Save/Update User Status in Database
    await UserTrial.findOneAndUpdate(
        { userId },
        {
            $set: {
                active: true,
                expiresAt: expiresAt,
                durationDays: durationDays,
                slot: keyDoc.slot || 1
            }
        },
        { upsert: true, new: true }
    );

    // 👑 Assign Role to User
    const targetRoleId = roles.ROLE_PREMIUM || roles.ROLE_TRIAL;
    if (targetRoleId) {
        await member.roles.add(targetRoleId).catch(err => console.error("Failed to add role:", err));
    }

    // 🎉 Success Response
    return await interaction.editReply({
        content: `${EMOJI.success || '✅'} **Key Activated Successfully!**\nYour key has been verified, and **Slot #${keyDoc.slot || 1}** along with your role has been unlocked!`
    });
}
