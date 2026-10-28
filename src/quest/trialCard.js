import { ContainerBuilder, TextDisplayBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';

export async function sendTrialDmCard(user, trialKey, guildName) {
    try {
        const dmChannel = await user.createDM();
        
        const dmCard = new ContainerBuilder().setAccentColor(0x5865F2);
        dmCard.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `# 💙 Your Orbie Trial Key\n` +
                `Here is your requested Orbie Trial key. Keep it safe and private[span_10](start_span)[span_10](end_span).\n\n` +
                `### 🎴 Key Type\n\`Trial Key\`[span_11](start_span)[span_11](end_span)\n\n` +
                `### ⏱️ Premium Duration\n\`3 Quests / Slots\`[span_12](start_span)[span_12](end_span)\n\n` +
                `### ⏳ Key Expires In\n\`30 Days ⏱️\`[span_13](start_span)[span_13](end_span)\n\n` +
                `### 🔑 Trial Key\n\`\`\`${trialKey}\`\`\`\n\n` +
                `### 🎟️ Redeem Instructions\n` +
                `Go to the redeem panel in **${guildName}** -> \`#orbie-panel\`, click the **Activate Premium** button, and paste this key[span_14](start_span)[span_14](end_span).\n\n` +
                `### 📋 Important Notes\n` +
                `• Only you can redeem this key[span_15](start_span)[span_15](end_span).\n` +
                `• Trial can only be redeemed once[span_16](start_span)[span_16](end_span).\n` +
                `• Trial allows solving up to 3 quests[span_17](start_span)[span_17](end_span).\n` +
                `• Trial users can only link the Discord account that redeemed the trial[span_18](start_span)[span_18](end_span).\n` +
                `• Keep this key private. Sharing it may result in loss of trial[span_19](start_span)[span_19](end_span).`
            )
        );

        // Copy Key button (Note: Discord buttons can't auto-copy to clipboard directly via API, but we can provide a button or modal/text fallback)
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`copy_key_${trialKey}`)
                .setLabel('Copy Key')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🔑')
        );

        await dmChannel.send({ components: [dmCard, row], flags: MessageFlags.IsComponentsV2 });
        
        // Extra text message so mobile users can easily copy the raw text string if needed (as seen in screenshot 4)
        await dmChannel.send({ content: trialKey });
    } catch (err) {
        console.error('Could not send DM:', err.message);
    }
}
