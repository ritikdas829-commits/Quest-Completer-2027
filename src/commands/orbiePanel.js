/**
 * orbiePanel.js - Send the Public Premium Activation Panel to Channel
 * Location: src/commands/orbiePanel.js
 */

import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } from 'discord.js';

export const orbiePanelCmd = {
    data: new SlashCommandBuilder()
        .setName('orbiepanel')
        .setDescription('Send the Orbie Premium & Trial Activation Panel to the channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    prefix: 'orbiepanel',

    async execute(interaction) {
        // Defer ephemeral takki command fail na ho
        await interaction.deferReply({ ephemeral: true });
        
        // Panel ko public channel mein send karein
        await sendPublicPanel(interaction.channel);
        
        // Admin ko private success message dein
        await interaction.editReply({ content: '✅ Orbie panel has been successfully sent to this channel!' });
    },

    async prefixExecute(message) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        
        // Prefix command ke liye original message delete karke panel bhej sakte hain ya seedha send kar sakte hain
        try { await message.delete(); } catch (err) {}
        await sendPublicPanel(message.channel);
    }
};

async function sendPublicPanel(channel) {
    const embed = new EmbedBuilder()
        .setTitle('🌟 Orbie Premium & Trial Activation')
        .setDescription(
            `Welcome to the official Orbie activation center! If you have received a **Trial Key** or a **Premium Key**, you can redeem it right here.\n\n` +
            `### 🎟️ How to Activate:\n` +
            `1. Click the **Activate Premium** button below.\n` +
            `2. Paste your generated key in the pop-up form.\n` +
            `3. Enjoy your automated quests and unlocked slots instantly!\n\n` +
            `-* Keep your keys private and secure.`
        )
        .setColor(0x5865F2);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('open_activate_modal')
            .setLabel('Activate Premium')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🔑')
    );

    await channel.send({
        embeds: [embed],
        components: [row]
    });
}
