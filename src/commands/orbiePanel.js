/**
 * orbiePanel.js - Send the Public Premium Activation Panel & Modal Trigger
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
    const prefix = client?.getPrefix ? client.getPrefix(guildId) : (client?.config?.prefix || client?.prefix || ';');

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
