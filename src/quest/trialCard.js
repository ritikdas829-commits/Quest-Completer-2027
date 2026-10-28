/**
 * trialCard.js - Generate and send Trial Key DM Embed Card
 * Location: src/quest/trialCard.js
 */

import { EmbedBuilder } from 'discord.js';

export async function sendTrialDmCard(user, key, guildName) {
    const embed = new EmbedBuilder()
        .setTitle('🎁 Aapki Orbie Trial Key Aa Gayi Hai!')
        .setDescription(
            `Hello **${user.username}**!\n\n` +
            `Aapne **${guildName}** server se apna **30-Day Free Trial** successfully request kar liya hai.\n\n` +
            `### 🔑 Aapki Key:\n` +
            `\`\`\`${key}\`\`\`\n\n` +
            `### 🚀 Kaise Activate Karein?\n` +
            `1. **${guildName}** server ke **#orbie-panel** channel par jayein.\n` +
            `2. **Activate Premium** button par click karein.\n` +
            `3. Pop-up form mein yeh key paste karke submit kar dein!\n\n` +
            `-# ⚠️ **Security Note:** Yeh key sirf aapke account ke liye locked hai. Ise kisi ke sath share na karein.`
        )
        .setColor(0x57F287)
        .setTimestamp();

    await user.send({ embeds: [embed] });
}
