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
        const EMOJI = await getEmojis(interaction.guildId || 'global');

        await handleTrialRequest(
            interaction.user, 
            interaction.guild, 
            async (opts) => await interaction.editReply(opts),
            interaction.client,
            EMOJI
        );
    },

    // Prefix Command Execution (;activate trial)
    async prefixExecute(message, args) {
        const subCommand = args[0]?.toLowerCase();
        
        // Get correct dynamic prefix
        const prefix = message.client.getPrefix ? message.client.getPrefix(message.guild.id) : (message.client.prefix || process.env.PREFIX || ';');
        const EMOJI = await getEmojis(message.guildId || 'global');

        if (subCommand !== 'trial') {
            const errCard = new ContainerBuilder().setAccentColor(0xED4245);
            errCard.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`# ${EMOJI.msg_error || '❌'} Invalid Command Usage\nPlease use the correct command: \`${prefix}activate trial\``)
            );
            return await message.reply({ components: [errCard], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } });
        }

        await handleTrialRequest(
            message.author, 
            message.guild, 
            async (opts) => await message.reply({ ...opts, allowedMentions: { repliedUser: false } }),
            message.client,
            EMOJI
        );
    }
};

async function handleTrialRequest(user, guild, replyFn, client, EMOJI) {
    const userId = user.id;
    const guildOwnerId = guild?.ownerId || userId;
    const guildName = guild?.name || 'Orbie Support';

    // 1️⃣ Step 1: Verify DM accessibility FIRST before creating any key in the database
    try {
        await user.send({ 
            content: `🔒 **Security Check:** Verifying your DM access for Orbie Trial generation...` 
        }).catch(() => {
            throw new Error("DM_CLOSED");
        });
    } catch (err) {
        const dmErrCard = new ContainerBuilder().setAccentColor(0xED4245);
        dmErrCard.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `# ${EMOJI.msg_error || '❌'} DMs Are Closed!\n` +
                `Your Direct Messages are closed! Please open your server DMs and try running the command again.`
            )
        );
        return await replyFn({ components: [dmErrCard], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    }

    // 2️⃣ Step 2: Generate 1-time self-trial key (30 days) ONLY after DM is confirmed open
    const result = await generateKeyByRole(userId, guildOwnerId, userId, 30);

    if (!result.success) {
        const errCard = new ContainerBuilder().setAccentColor(0xED4245);
        errCard.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${EMOJI.msg_error || '❌'} Trial Error\n${result.message}`));
        return await replyFn({ components: [errCard], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    }

    try {
        // 3️⃣ Step 3: Send trial key via DM
        await sendTrialDmCard(user, result.key, guildName);

        const successCard = new ContainerBuilder().setAccentColor(0x57F287);
        successCard.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `# ${EMOJI.msg_success || '💙'} Key Sent Successfully\n\n` +
                `> ${EMOJI.key_key || '🔑'} Trial key has been sent to your DMs.\n` +
                `> ${EMOJI.msg_diamond || '💎'} Redeem it from <#1565058320560169182>\n` +
                `> ${EMOJI.key_expiry || '⏱️'} The key expires in 30 days if unused.\n` +
                `> ${EMOJI.key_shield || '🤖'} Only your account can redeem it.`
            )
        );
        await replyFn({ components: [successCard], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    } catch (err) {
        const dmErrCard = new ContainerBuilder().setAccentColor(0xED4245);
        dmErrCard.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `# ${EMOJI.msg_error || '❌'} Delivery Failed\n` +
                `Key was generated but could not be delivered to your DMs. Please contact support.`
            )
        );
        await replyFn({ components: [dmErrCard], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    }
}
