/**
 * trialRequest.js - Request and Receive a Trial Key in DM (Slash & Prefix Support with Emojis)
 * Location: src/commands/trialRequest.js
 */

import { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, MessageFlags } from 'discord.js';
import { generateKeyByRole } from '../quest/trialKeyStore.js';
import { sendTrialDmCard } from '../quest/trialCard.js';
import { getEmojis } from '../quest/emoji.js';

export const trialRequestCmd = {
    data: new SlashCommandBuilder()
        .setName('activate')
        .setDescription('Activate Orbie features or claim your trial')
        .addSubcommand(sub =>
            sub.setName('trial')
               .setDescription('Claim your free 30-day Orbie Trial Key in DM')
        ),
    prefix: 'activate', // prefix command: ;activate trial

    // Slash Command Execution
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        if (subcommand !== 'trial') return;

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const emojis = await getEmojis(interaction.guildId || 'global');

        await handleTrialRequest(
            interaction.user, 
            interaction.guild, 
            async (opts) => await interaction.editReply(opts),
            interaction.client,
            emojis
        );
    },

    // Prefix Command Execution (;activate trial)
    async prefixExecute(message, args) {
        const subCommand = args[0]?.toLowerCase();
        
        // Get correct dynamic prefix
        const prefix = message.client.getPrefix ? message.client.getPrefix(message.guild.id) : (message.client.prefix || process.env.PREFIX || ';');
        const emojis = await getEmojis(message.guildId || 'global');

        if (subCommand !== 'trial') {
            const errCard = new ContainerBuilder().setAccentColor(0xED4245);
            errCard.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`# ${emojis.error || '❌'} Invalid Command Usage\nPlease use the correct command: \`${prefix}activate trial\``)
            );
            return await message.reply({ components: [errCard], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } });
        }

        await handleTrialRequest(
            message.author, 
            message.guild, 
            async (opts) => await message.reply({ ...opts, allowedMentions: { repliedUser: false } }),
            message.client,
            emojis
        );
    }
};

async function handleTrialRequest(user, guild, replyFn, client, emojis) {
    const userId = user.id;
    const guildOwnerId = guild?.ownerId || userId;
    const guildName = guild?.name || 'Orbie Support';

    // Generate 1-time self-trial key (30 days)
    const result = await generateKeyByRole(userId, guildOwnerId, userId, 30);

    if (!result.success) {
        const errCard = new ContainerBuilder().setAccentColor(0xED4245);
        errCard.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${emojis.error || '❌'} Trial Error\n${result.message}`));
        return await replyFn({ components: [errCard], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    }

    try {
        // Send trial key via DM
        await sendTrialDmCard(user, result.key, guildName);

        const successCard = new ContainerBuilder().setAccentColor(0x57F287);
        successCard.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `# ${emojis.mail || '📬'} Trial Key Sent!\n` +
                `Your **30-Day Trial Key** ${emojis.trial || '💎'} has been successfully sent to your **Direct Messages (DM)**.\n\n` +
                `👉 Please check your DMs and go to <#1565058320560169182> to redeem your key!`
            )
        );
        await replyFn({ components: [successCard], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    } catch (err) {
        const dmErrCard = new ContainerBuilder().setAccentColor(0xED4245);
        dmErrCard.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `# ${emojis.error || '❌'} DM Failed\n` +
                `Your DMs are closed! Please open your server DMs and try running the command again.`
            )
        );
        await replyFn({ components: [dmErrCard], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    }
}
