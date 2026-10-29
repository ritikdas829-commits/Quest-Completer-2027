/**
 * orbiePanel.js - Send the Public Premium Activation Panel & Modal Handler
 * Location: src/commands/orbiePanel.js
 */

import { 
    SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, PermissionFlagsBits, 
    ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags 
} from 'discord.js';
import { getEmojis } from '../quest/emoji.js';

export const orbiePanelCmd = {
    data: new SlashCommandBuilder()
        .setName('orbiepanel')
        .setDescription('Send the Orbie Premium & Trial Activation Panel to the channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    prefix: 'orbiepanel',

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        await sendPublicPanel(interaction.channel, interaction.guildId);
        await interaction.editReply({ content: '✅ Orbie panel has been successfully sent to this channel!' });
    },

    async prefixExecute(message) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        try { await message.delete(); } catch (err) {}
        await sendPublicPanel(message.channel, message.guildId);
    }
};

async function sendPublicPanel(channel, guildId) {
    const EMOJI = await getEmojis(guildId || 'global');

    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`${EMOJI.premium || '💎'} Orbie Premium Panel`)
        .setDescription(
            `Unlock Orbie Premium automation, video/desktop quest support, and active notifications.\n\n` +
            `${EMOJI.diamond || '💎'} **Trial Keys**\n` +
            `• Grant Orbie Trial for 3 days.\n` +
            `• Limited to one lifetime trial redemption per Discord account.\n` +
            `• Trial accounts can only link their own Discord token (no alts).\n\n` +
            `${EMOJI.crown || '👑'} **Premium Keys**\n` +
            `• Grant full Orbie Premium (5 active account slots).\n` +
            `• Extend existing paid premium periods natively.\n\n` +
            `${EMOJI.key || '🟡'} **Activation**\n` +
            `Click the button below to activate your key!`
        )
        .setFooter({ text: 'Thank you for using Orbie.' });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('open_activate_modal')
            .setLabel('Activate Premium')
            .setStyle(ButtonStyle.Success)
            .setEmoji(EMOJI.ticketRaw || '🎫')
    );

    await channel.send({
        embeds: [embed],
        components: [row]
    });
}

// Button Click Handler (Modal Open karega)
export async function handleOrbieButton(interaction) {
    if (interaction.customId !== 'open_activate_modal') return;

    const modal = new ModalBuilder()
        .setCustomId('activate_premium_modal')
        .setTitle('Activate Premium');

    const keyInput = new TextInputBuilder()
        .setCustomId('key_input')
        .setLabel('Premium / Trial Key')
        .setPlaceholder('Enter your 14-character key...')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMinLength(14)
        .setMaxLength(14);

    modal.addComponents(new ActionRowBuilder().addComponents(keyInput));
    return await interaction.showModal(modal);
}

// Modal Submission Handler (Key check karega)
export async function handleOrbieModal(interaction, client) {
    if (interaction.customId !== 'activate_premium_modal') return;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const EMOJI = await getEmojis(interaction.guildId || 'global');
    const key = interaction.fields.getTextInputValue('key_input').trim();

    try {
        if (!key || key.length !== 14) {
            return await interaction.editReply({
                content: `${EMOJI.error || '❌'} The key you entered is invalid. Please double-check it.`
            });
        }

        // Yahan aapka key activation/database logic aayega
        await interaction.editReply({
            content: `${EMOJI.success || '✅'} **Activation Successful!** Your premium has been activated.`
        });

    } catch (e) {
        await interaction.editReply({
            content: `${EMOJI.error || '❌'} **Activation Failed**\n${e.message || 'The key you entered is invalid. Please double-check it.'}`
        });
    }
}
