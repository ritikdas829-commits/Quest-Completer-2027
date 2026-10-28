/**
 * keyActivationHandler.js - MongoDB-backed "Activate Premium" button & modal handler
 * Location: src/handlers/keyActivationHandler.js
 */

import { 
    ModalBuilder, TextInputBuilder, TextInputStyle, 
    ActionRowBuilder, ContainerBuilder, TextDisplayBuilder, MessageFlags 
} from 'discord.js';
import mongoose from 'mongoose';

const TRIAL_ROLE_ID = 'YOUR_TRIAL_ROLE_ID'; // Yahan apna Discord Trial Role ID daalein

// Mongoose Schemas (trialKeyStore.js ke sath matching)
const keySchema = new mongoose.Schema({
    keyString: { type: String, required: true, unique: true },
    assignedTo: { type: String, default: null },
    type: { type: String, default: 'admin_generated' },
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

// 1. Button click par Modal open karne ka function
export async function handleActivationButton(interaction) {
    if (interaction.customId !== 'open_activate_modal') return false;

    const modal = new ModalBuilder()
        .setCustomId('orbie_activate_modal')
        .setTitle('Activate Premium');

    const keyInput = new TextInputBuilder()
        .setCustomId('key_input')
        .setLabel('Premium / Trial Key *')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('XXXX-XXXX-XXXX')
        .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(keyInput));
    await interaction.showModal(modal);
    return true;
}

// 2. Modal submit hone par key verify, activate, role assign aur slots unlock karne ka function (MongoDB)
export async function handleActivationModalSubmit(interaction) {
    if (interaction.customId !== 'orbie_activate_modal') return false;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const userEnteredKey = interaction.fields.getTextInputValue('key_input').trim();
    const userId = interaction.user.id;

    // Find key in MongoDB
    const keyData = await KeyStore.findOne({ keyString: userEnteredKey });

    if (!keyData) {
        const errCard = new ContainerBuilder().setAccentColor(0xED4245);
        errCard.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ❌ Invalid Key\nThe key you entered does not exist or is incorrect.`));
        return await interaction.editReply({ components: [errCard], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    }

    if (keyData.redeemed) {
        const errCard = new ContainerBuilder().setAccentColor(0xED4245);
        errCard.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ❌ Key Already Redeemed\nThis key has already been used by someone else.`));
        return await interaction.editReply({ components: [errCard], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    }

    // 🛑 Strict check: Agar key kisi specific user ke liye locked thi
    if (keyData.assignedTo && keyData.assignedTo !== userId) {
        const errCard = new ContainerBuilder().setAccentColor(0xED4245);
        errCard.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ❌ Unauthorized Key\nYeh key sirf us user ke liye locked hai jise yeh assign ki gayi thi! Aap ise use nahi kar sakte.`));
        return await interaction.editReply({ components: [errCard], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    }

    // Mark key as redeemed in MongoDB
    keyData.redeemed = true;
    keyData.redeemedBy = userId;
    keyData.redeemedAt = Date.now();
    await keyData.save();

    // Save user active trial & slot status in MongoDB
    const expiresAtTime = keyData.durationDays === -1 ? null : Date.now() + (keyData.durationDays * 24 * 60 * 60 * 1000);
    await UserTrial.findOneAndUpdate(
        { userId },
        {
            $set: {
                active: true,
                durationDays: keyData.durationDays,
                expiresAt: expiresAtTime,
                unlockedSlots: [1] // Trial redeem karne par Slot #1 unlock ho jayega
            }
        },
        { upsert: true, new: true }
    );

    // Assign Trial Role to the user automatically
    try {
        if (interaction.guild && TRIAL_ROLE_ID !== 'YOUR_TRIAL_ROLE_ID') {
            const member = await interaction.guild.members.fetch(userId);
            await member.roles.add(TRIAL_ROLE_ID);
        }
    } catch (err) {
        console.error('Could not assign trial role:', err.message);
    }

    // Success response with slot info
    const successCard = new ContainerBuilder().setAccentColor(0x57F287);
    successCard.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `# ✅ Premium / Trial Activated Successfully!\n` +
            `Your key has been successfully redeemed.\n\n` +
            `• **Duration:** ${keyData.durationDays === -1 ? 'Lifetime' : `${keyData.durationDays} Days`}\n` +
            `• **Unlocked Slot:** Slot #1 Active\n` +
            `• **Assigned Role:** Trial role successfully granted!\n\n` +
            `Aap ab apne quests run kar sakte hain!`
        )
    );
    await interaction.editReply({ components: [successCard], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    return true;
}
