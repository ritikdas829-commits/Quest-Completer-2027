/**
 * keyActivationHandler.js - Handle "Activate Premium" button & modal submission with Role & Slot assignment
 * Location: src/handlers/keyActivationHandler.js
 */

import { 
    ModalBuilder, TextInputBuilder, TextInputStyle, 
    ActionRowBuilder, ContainerBuilder, TextDisplayBuilder, MessageFlags 
} from 'discord.js';
import fs from 'fs';
import path from 'path';

const filePath = path.resolve('data/trialKeys.json');
const TRIAL_ROLE_ID = 'YOUR_TRIAL_ROLE_ID'; // Yahan apna Discord Trial Role ID daalein

function loadKeysData() {
    if (!fs.existsSync(filePath)) return { keys: {}, users: {} };
    try {
        const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (!raw.keys) raw.keys = {};
        if (!raw.users) raw.users = {};
        return raw;
    } catch {
        return { keys: {}, users: {} };
    }
}

function saveKeysData(data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

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

// 2. Modal submit hone par key verify, activate, role assign aur slots unlock karne ka function
export async function handleActivationModalSubmit(interaction) {
    if (interaction.customId !== 'orbie_activate_modal') return false;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const userEnteredKey = interaction.fields.getTextInputValue('key_input').trim();
    const userId = interaction.user.id;

    const db = loadKeysData();
    const keyData = db.keys[userEnteredKey];

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

    // Check if key is locked to a specific user
    if (keyData.assignedTo && keyData.assignedTo !== userId) {
        const errCard = new ContainerBuilder().setAccentColor(0xED4245);
        errCard.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ❌ Unauthorized Key\nThis key is locked and can only be redeemed by the user it was assigned to.`));
        return await interaction.editReply({ components: [errCard], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    }

    // Mark key as redeemed
    keyData.redeemed = true;
    keyData.redeemedBy = userId;
    keyData.redeemedAt = Date.now();

    // Save user active trial & slot status
    db.users[userId] = {
        active: true,
        durationDays: keyData.durationDays,
        redeemedAt: Date.now(),
        expiresAt: keyData.durationDays === -1 ? null : Date.now() + (keyData.durationDays * 24 * 60 * 60 * 1000),
        unlockedSlots: [1] // Trial redeem karne par Slot #1 unlock ho jayega
    };

    saveKeysData(db);

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
            `• **Duration:** ${keyData.durationDays} Days\n` +
            `• **Unlocked Slot:** Slot #1 Active\n` +
            `• **Assigned Role:** Trial role successfully granted!\n\n` +
            `Aap ab apne quests run kar sakte hain!`
        )
    );
    await interaction.editReply({ components: [successCard], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    return true;
}
