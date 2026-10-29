/**
 * keyActivationHandler.js - Fully Updated MongoDB Activation Handler with Fixed Trial/Premium Detection
 * Location: src/handlers/keyActivationHandler.js
 */

import { 
    ModalBuilder, TextInputBuilder, TextInputStyle, 
    ActionRowBuilder, ContainerBuilder, TextDisplayBuilder, MessageFlags 
} from 'discord.js';
import mongoose from 'mongoose';
import { getEmojis } from '../quest/emoji.js';
import { getRolesAsync } from '../quest/roleStore.js';

// Mongoose Schemas
const keySchema = new mongoose.Schema({
    keyString: { type: String, required: true, unique: true },
    assignedTo: { type: String, default: null },
    type: { type: String, default: 'trial' }, // 'trial', 'admin_generated', 'premium', etc.
    durationDays: { type: Number, default: 30 },
    redeemed: { type: Boolean, default: false },
    redeemedBy: { type: String, default: null },
    redeemedAt: { type: Number, default: null },
    createdAt: { type: Number, default: Date.now }
});

const userTrialSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    claimedTrial: { type: Boolean, default: false },
    active: { type: Boolean, default: false },
    expiresAt: { type: Number, default: null },
    durationDays: { type: Number, default: 30 },
    unlockedSlots: { type: [Number], default: [1] }
});

const KeyStore = mongoose.models.KeyStore || mongoose.model('KeyStore', keySchema);
const UserTrial = mongoose.models.UserTrial || mongoose.model('UserTrial', userTrialSchema);

// 1. Button click par Modal open karne ka function (14-character length validation)
export async function handleActivationButton(interaction) {
    if (interaction.customId !== 'open_activate_modal') return false;

    const modal = new ModalBuilder()
        .setCustomId('orbie_activate_modal')
        .setTitle('Activate Premium / Trial');

    const keyInput = new TextInputBuilder()
        .setCustomId('key_input')
        .setLabel('Premium / Trial Key *')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Enter 14-character key...')
        .setRequired(true)
        .setMinLength(14)
        .setMaxLength(14);

    modal.addComponents(new ActionRowBuilder().addComponents(keyInput));
    await interaction.showModal(modal);
    return true;
}

// 2. Modal submit hone par key verify, slot unlock, aur role assign karne ka function
export async function handleActivationModalSubmit(interaction) {
    if (interaction.customId !== 'orbie_activate_modal') return false;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const EMOJI = await getEmojis(interaction.guildId || 'global');
    const userEnteredKey = interaction.fields.getTextInputValue('key_input').trim();
    const userId = interaction.user.id;
    const guildId = interaction.guildId;

    // Find key in MongoDB
    const keyData = await KeyStore.findOne({ keyString: userEnteredKey });

    if (!keyData) {
        const errCard = new ContainerBuilder().setAccentColor(0xED4245);
        errCard.addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `# ${EMOJI.error || '❌'} Invalid Key\n` +
            `The key you entered does not exist or is incorrect.\n\n` +
            `### 📋 Key Code:\n\`\`\`${userEnteredKey}\`\`\``
        ));
        return await interaction.editReply({ components: [errCard], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    }

    if (keyData.redeemed) {
        const errCard = new ContainerBuilder().setAccentColor(0xED4245);
        errCard.addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `# ${EMOJI.error || '❌'} Key Already Redeemed\n` +
            `This key has already been used by someone else.\n\n` +
            `### 📋 Key Code:\n\`\`\`${userEnteredKey}\`\`\``
        ));
        return await interaction.editReply({ components: [errCard], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    }

    if (keyData.assignedTo && keyData.assignedTo !== userId) {
        const errCard = new ContainerBuilder().setAccentColor(0xED4245);
        errCard.addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `# ${EMOJI.error || '❌'} Unauthorized Key\n` +
            `This key is locked to another user and cannot be used by you.\n\n` +
            `### 📋 Key Code:\n\`\`\`${userEnteredKey}\`\`\``
        ));
        return await interaction.editReply({ components: [errCard], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    }

    // Mark key as redeemed in MongoDB
    keyData.redeemed = true;
    keyData.redeemedBy = userId;
    keyData.redeemedAt = Date.now();
    await keyData.save();

    // 🛠️ FIXED: Correctly identify if it's a trial key (covering admin_generated and trial types)
    const isTrial = keyData.type === 'trial' || keyData.type === 'admin_generated' || keyData.durationDays <= 30;
    const unlockedSlotsArray = isTrial ? [1] : [1, 2, 3, 4, 5];

    // Save user active trial/premium & slot status in MongoDB
    const expiresAtTime = keyData.durationDays === -1 ? null : Date.now() + (keyData.durationDays * 24 * 60 * 60 * 1000);
    await UserTrial.findOneAndUpdate(
        { userId },
        {
            $set: {
                active: true,
                durationDays: keyData.durationDays,
                expiresAt: expiresAtTime,
                unlockedSlots: unlockedSlotsArray
            }
        },
        { upsert: true, new: true }
    );

    // 🔄 Dynamic Role Assignment based on Key Type & setupRoles config
    let roleStatusText = 'No role configured';
    try {
        if (interaction.guild) {
            const configuredRoles = await getRolesAsync(guildId);
            const member = await interaction.guild.members.fetch(userId);
            
            // Assign ROLE_TRIAL if trial, otherwise ROLE_PREMIUM
            const targetRoleId = isTrial ? configuredRoles.ROLE_TRIAL : (configuredRoles.ROLE_PREMIUM || configuredRoles.ROLE_2_BOOST);

            if (targetRoleId) {
                await member.roles.add(targetRoleId);
                roleStatusText = `<@&${targetRoleId}> assigned successfully!`;
            } else {
                roleStatusText = `No role configured for ${isTrial ? 'Trial' : 'Premium'} in \`/setuproles\``;
            }
        }
    } catch (err) {
        console.error('Error assigning role:', err.message);
        roleStatusText = 'Failed to give role (Check bot permissions)';
    }

    // Success response with clean formatting
    const successCard = new ContainerBuilder().setAccentColor(0x57F287);
    successCard.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `# ${EMOJI.success || '✅'} ${isTrial ? 'Trial' : 'Premium'} Activated Successfully!\n` +
            `Your key has been successfully redeemed.\n\n` +
            `• **Type:** \`${isTrial ? 'Trial Key' : 'Premium Key'}\`\n` +
            `• **Duration:** ${keyData.durationDays === -1 ? 'Lifetime' : `${keyData.durationDays} Days`}\n` +
            `• **Unlocked Slots:** ${isTrial ? 'Slot #1 Active' : 'Slots #1 to #5 Active (Full Access)'}\n` +
            `• **Role Status:** ${roleStatusText}\n\n` +
            `### 📋 Your Activated Key:\n\`\`\`${userEnteredKey}\`\`\``
        )
    );
    await interaction.editReply({ components: [successCard], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    return true;
}
