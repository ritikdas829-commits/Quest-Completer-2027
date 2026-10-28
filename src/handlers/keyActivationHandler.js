/**
 * keyActivationHandler.js - Handle "Activate Premium" button & modal submission
 * Location: src/handlers/keyActivationHandler.js
 */

import { 
    ModalBuilder, TextInputBuilder, TextInputStyle, 
    ActionRowBuilder, ContainerBuilder, TextDisplayBuilder, MessageFlags 
} from 'discord.js';
import fs from 'fs';
import path from 'path';

const filePath = path.resolve('data/trialKeys.json');

function loadKeysData() {
    if (!fs.existsSync(filePath)) return { keys: {} };
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
        return { keys: {} };
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

// 2. Modal submit hone par key verify aur activate karne ka function
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
    saveKeysData(db);

    // Success response
    const successCard = new ContainerBuilder().setAccentColor(0x57F287);
    successCard.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `# ✅ Premium Activated Successfully!\n` +
            `Your key has been successfully redeemed.\n` +
            `**Duration:** ${keyData.durationDays} Days\n` +
            `Enjoy your automated quests!`
        )
    );
    await interaction.editReply({ components: [successCard], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    return true;
}
