/**
 * orbiePanel.js - Send the Premium Activation Panel with Button
 * Location: src/commands/orbiePanel.js
 */

import { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits } from 'discord.js';

export const orbiePanelCmd = {
    data: new SlashCommandBuilder()
        .setName('orbiepanel')
        .setDescription('Send the Orbie Premium & Trial Activation Panel')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    prefix: 'orbiepanel',

    async execute(interaction) {
        // 🛑 Error fix karne ke liye pehle defer reply karein
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        await sendPanel(interaction, async (opts) => await interaction.editReply(opts));
    },

    async prefixExecute(message) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        await sendPanel(message, async (opts) => await message.reply(opts));
    }
};

async function sendPanel(context, replyFn) {
    const panelCard = new ContainerBuilder().setAccentColor(0x5865F2);
    
    panelCard.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `# 🌟 Orbie Premium & Trial Activation\n\n` +
            `Welcome to the official Orbie activation center! If you have received a **Trial Key** or a **Premium Key**, you can redeem it right here.\n\n` +
            `### 🎟️ How to Activate:\n` +
            `1. Click the **Activate Premium** button below.\n` +
            `2. Paste your generated key in the pop-up form.\n` +
            `3. Enjoy your automated quests and unlocked slots instantly!\n\n` +
            `-# Keep your keys private and secure.`
        )
    );

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('open_activate_modal')
            .setLabel('Activate Premium')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🔑')
    );

    await replyFn({
        components: [panelCard, row],
        flags: MessageFlags.IsComponentsV2
    });
}
