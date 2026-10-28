/**
 * trialRequest.js - Request and Receive a Trial Key in DM (Slash & Prefix Support)
 * Location: src/commands/trialRequest.js
 */

import { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, MessageFlags } from 'discord.js';
import { generateKeyByRole } from '../quest/trialKeyStore.js';
import { sendTrialDmCard } from '../quest/trialCard.js';

export const trialRequestCmd = {
    data: new SlashCommandBuilder()
        .setName('activatetrial')
        .setDescription('Request your 30-day Orbie Trial Key in DM'),
    prefix: 'activatetrial',

    // Slash Command Execution
    async execute(interaction) {
        // Timeout bachane ke liye pehle defer kar dein
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        await handleTrialRequest(
            interaction.user, 
            interaction.guild, 
            async (opts) => await interaction.editReply(opts)
        );
    },

    // Prefix Command Execution (;activatetrial)
    async prefixExecute(message) {
        await handleTrialRequest(
            message.author, 
            message.guild, 
            async (opts) => await message.reply(opts)
        );
    }
};

async function handleTrialRequest(user, guild, replyFn) {
    const userId = user.id;
    const guildOwnerId = guild.ownerId;
    const guildName = guild.name;

    // Generate 1-time self-trial key (30 days)
    const result = await generateKeyByRole(userId, guildOwnerId, userId, 30);

    if (!result.success) {
        const errCard = new ContainerBuilder().setAccentColor(0xED4245);
        errCard.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ❌ Trial Error\n${result.message}`));
        return await replyFn({ components: [errCard], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    }

    try {
        // Send trial key via DM
        await sendTrialDmCard(user, result.key, guildName);

        const successCard = new ContainerBuilder().setAccentColor(0x57F287);
        successCard.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `# 📬 Trial Key Sent!\n` +
                `Aapka **30-Day Trial Key** aapke **Direct Messages (DM)** mein bhej diya gaya hai.\n\n` +
                `👉 Apna DM check karein aur **#orbie-panel** mein jaakar key activate karein!`
            )
        );
        await replyFn({ components: [successCard], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    } catch (err) {
        const dmErrCard = new ContainerBuilder().setAccentColor(0xED4245);
        dmErrCard.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `# ❌ DM Failed\n` +
                `Aapke DMs closed hain! Kripya apne server DMs open karein, phir dobara command chalayein.`
            )
        );
        await replyFn({ components: [dmErrCard], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    }
}
