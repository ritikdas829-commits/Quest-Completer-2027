/**
 * trialCard.js - Generate and send Trial Key DM Embed Card (Cleaned 1 Quest & No Backticks in Button)
 * Location: src/quest/trialCard.js
 */

import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getEmojis } from './emoji.js';

export async function sendTrialDmCard(user, key, guildName = 'Orbie Support', channelId = '1565058320560169182') {
    // Dynamic Emoji System integration
    const emojis = await getEmojis('global');

    // Server ke diye gaye channel ID ke sath direct clickable link
    const channelMention = channelId ? `<#${channelId}>` : `#orbie-panel`;

    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`${emojis.crown || '👑'} Your Orbie Trial Key`)
        .setDescription(
            `Here is your requested Orbie Trial key. Keep it safe and private.\n\n` +
            `${emojis.tag || '🏷️'} **Key Type**\n` +
            `\`Trial Key\`\n\n` +
            `${emojis.target || '🎯'} **Premium Duration**\n` +
            `\`1\`\n\n` +
            `${emojis.hourglass || '⏳'} **Key Expires In**\n` +
            `\`30 Days\`\n\n` +
            `${emojis.key || '🔑'} **Trial Key**\n` +
            `\`${key}\`\n\n` +
            `${emojis.ticket || '🎫'} **Redeem Instructions**\n` +
            `Go to the redeem panel in **${guildName}** at ${channelMention}, click the Activate Premium button, and paste this key.\n\n` +
            `${emojis.scroll || '📜'} **Important Notes**\n` +
            `• Only you can redeem this key.\n` +
            `• Trial can only be redeemed once.\n` +
            `• Trial allows solving up to 1 quest.\n` +
            `• Trial users can only link the Discord account that redeemed the trial.\n` +
            `• Keep this key private. Sharing it may result in loss of trial.`
        )
        .setFooter({ text: 'Orbie Security System' })
        .setTimestamp();

    // Copy Key Button (Sirf pure key ka string, koi backticks nahi)
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`copy_key_${key}`)
            .setLabel('Copy Key')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(emojis.keyButton || '🔑')
    );

    try {
        await user.send({ embeds: [embed], components: [row] });
    } catch (err) {
        console.error('Could not send DM to user:', err.message);
    }
}
