/**
 * keyActivationHandler.js - Combined Modal Handler, Dynamic Prefix, and Full Emoji System Integration
 * Location: src/handlers/keyActivationHandler.js
 */

import { 
    ModalBuilder, TextInputBuilder, TextInputStyle, 
    ActionRowBuilder, ContainerBuilder, TextDisplayBuilder, MessageFlags, EmbedBuilder 
} from 'discord.js';
import mongoose from 'mongoose';
import { getEmojis } from '../quest/emoji.js';
import { getRolesAsync } from '../quest/roleStore.js';

// Mongoose Schemas
const keySchema = new mongoose.Schema({
    keyString: { type: String, required: true, unique: true },
    assignedTo: { type: String, default: null },
    type: { type: String, default: 'trial' },
    durationDays: { type: Number, default: 30 },
    redeemed: { type: Boolean, default: false },
    redeemedBy: { type: String, default: null },
    redeemedAt: { type: Number, default: null },
    createdAt: { type: Number, default: Date.now }
});

const userTrialSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    claimedTrial: { type: Boolean, default: false },
    active: { type: Boolean, default: false },
    expiresAt: { type: Number, default: null },
    durationDays: { type: Number, default: 30 },
    unlockedSlots: { type: [Number], default: [1] }
});

const KeyStore = mongoose.models.KeyStore || mongoose.model('KeyStore', keySchema);
const UserTrial = mongoose.models.UserTrial || mongoose.model('UserTrial', userTrialSchema);

/**
 * 1. Button Click Trigger: Opens the redemption modal
 */
export async function handleActivationButton(interaction) {
    if (!interaction.isButton() || interaction.customId !== 'open_activate_modal') return false;

    const modal = new ModalBuilder()
        .setCustomId('orbie_activate_modal')
        .setTitle('Activate Premium / Trial');

    const keyInput = new TextInputBuilder()
        .setCustomId('key_input')
        .setLabel('Premium / Trial Key *')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Enter 14-character key...')
        .setRequired(true)
        .setMinLength(14)
        .setMaxLength(14);

    modal.addComponents(new ActionRowBuilder().addComponents(keyInput));
    await interaction.showModal(modal);
    return true;
}

/**
 * 2. Modal Submit Handler
 */
export async function handleActivationModalSubmit(interaction) {
    if (!interaction.isModalSubmit() || interaction.customId !== 'orbie_activate_modal') return false;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    
    // 🎨 Fetch custom emojis dynamically via system
    const EMOJI = await getEmojis(interaction.guildId || 'global');
    const userEnteredKey = interaction.fields.getTextInputValue('key_input').trim();
    const userId = interaction.user.id;
    const guildId = interaction.guildId;

    // Default prefix fallback for modal view
    const activePrefix = interaction.client?.config?.prefix || interaction.client?.prefix || ';';

    await processKeyRedemption(
        userEnteredKey, 
        userId, 
        interaction.guild, 
        guildId, 
        EMOJI, 
        async (payload) => await interaction.editReply(payload),
        async (embedObj) => await interaction.user.send({ embeds: [embedObj] }),
        activePrefix
    );
    return true;
}

/**
 * 3. Dynamic Prefix Command Support
 */
export default {
    name: 'activate',
    prefix: 'activate',
    description: 'Redeem your premium or trial key',

    async execute(message, args, client) {
        const userEnteredKey = args[0]?.trim();
        const userId = message.author.id;
        const guildId = message.guild?.id;

        // 🔄 Dynamic Prefix and Custom Emoji Loader
        const activePrefix = client.config?.prefix || client.prefix || ';';
        const EMOJI = await getEmojis(guildId || 'global');

        if (!userEnteredKey) {
            return message.reply({
                content: `${EMOJI.error || '❌'} Please provide your activation key.\nUsage: \`${activePrefix}activate <your-key>\``,
                allowedMentions: { repliedUser: false }
            });
        }

        await processKeyRedemption(
            userEnteredKey,
            userId,
            message.guild,
            guildId,
            EMOJI,
            async (payload) => await message.reply({ ...payload, allowedMentions: { repliedUser: false } }),
            async (embedObj) => await message.author.send({ embeds: [embedObj] }),
            activePrefix
        );
    }
};

/**
 * Core Shared Key Redemption Logic with Custom Emoji System
 */
async function processKeyRedemption(userEnteredKey, userId, guild, guildId, EMOJI, replyFn, dmFn, activePrefix = ';') {
    const keyData = await KeyStore.findOne({ keyString: userEnteredKey });

    if (!keyData) {
        const errCard = new ContainerBuilder().setAccentColor(0xED4245);
        errCard.addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `# ${EMOJI.error || '❌'} Invalid Key\n` +
            `The key you entered does not exist or is incorrect.\n\n` +
            `### 📋 Key Code:\n\`\`\`${userEnteredKey}\`\`\``
        ));
        return await replyFn({ components: [errCard], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    }

    if (keyData.redeemed) {
        const errCard = new ContainerBuilder().setAccentColor(0xED4245);
        errCard.addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `# ${EMOJI.error || '❌'} Key Already Redeemed\n` +
            `This key has already been used by someone else.\n\n` +
            `### 📋 Key Code:\n\`\`\`${userEnteredKey}\`\`\``
        ));
        return await replyFn({ components: [errCard], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    }

    if (keyData.assignedTo && keyData.assignedTo !== userId) {
        const errCard = new ContainerBuilder().setAccentColor(0xED4245);
        errCard.addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `# ${EMOJI.error || '❌'} Unauthorized Key\n` +
            `This key is locked to another user and cannot be used by you.\n\n` +
            `### 📋 Key Code:\n\`\`\`${userEnteredKey}\`\`\``
        ));
        return await replyFn({ components: [errCard], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    }

    keyData.redeemed = true;
    keyData.redeemedBy = userId;
    keyData.redeemedAt = Date.now();
    await keyData.save();

    const isTrial = keyData.type === 'trial' || keyData.type === 'admin_generated' || keyData.durationDays <= 30;
    const unlockedSlotsArray = isTrial ? [1] : [1, 2, 3, 4, 5];

    const expiresAtTime = keyData.durationDays === -1 ? null : Date.now() + (keyData.durationDays * 24 * 60 * 60 * 1000);
    await UserTrial.findOneAndUpdate(
        { userId },
        {
            $set: {
                active: true,
                durationDays: keyData.durationDays,
                expiresAt: expiresAtTime,
                unlockedSlots: unlockedSlotsArray
            }
        },
        { upsert: true, new: true }
    );

    let roleStatusText = 'No role configured';
    try {
        if (guild) {
            const configuredRoles = await getRolesAsync(guildId);
            const member = await guild.members.fetch(userId);
            const targetRoleId = isTrial ? configuredRoles.ROLE_TRIAL : (configuredRoles.ROLE_PREMIUM || configuredRoles.ROLE_2_BOOST);

            if (targetRoleId) {
                await member.roles.add(targetRoleId);
                roleStatusText = `<@&${targetRoleId}> assigned successfully!`;
            } else {
                roleStatusText = `No role configured for ${isTrial ? 'Trial' : 'Premium'} in \`/setuproles\``;
            }
        }
    } catch (err) {
        console.error('Error assigning role:', err.message);
        roleStatusText = 'Failed to give role (Check bot permissions)';
    }

    // Success response panel card with custom emojis
    const successCard = new ContainerBuilder().setAccentColor(0x57F287);
    successCard.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `# ${EMOJI.success || '✅'} ${isTrial ? 'Trial' : 'Premium'} Activated Successfully!\n` +
            `Your key has been successfully redeemed. Check your DMs for full details.\n\n` +
            `• **Type:** \`${isTrial ? 'Trial Key' : 'Premium Key'}\`\n` +
            `• **Duration:** ${keyData.durationDays === -1 ? 'Lifetime' : `${keyData.durationDays} Days`}\n` +
            `• **Role Status:** ${roleStatusText}\n\n` +
            `### 📋 Your Activated Key:\n\`\`\`${userEnteredKey}\`\`\``
        )
    );
    await replyFn({ components: [successCard], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });

    // Detailed DM Success Embed with custom emojis
    try {
        const dmEmbed = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle(`${EMOJI.success || '✅'} Premium Activated!`)
            .setDescription('Your key was successfully redeemed.')
            .addFields(
                { name: `${EMOJI.trial || '🧿'} Tier Type`, value: `\`${isTrial ? 'Trial' : 'Premium'}\``, inline: false },
                { name: '⏱️ Redeemed At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false },
                { name: '📦 Allocation', value: isTrial ? '`3 Quest Credits` / `1 Trial Slot`' : '`Full Access` / `5 Active Slots`', inline: false },
                { name: '🛡️ Role Granted', value: `\`${roleStatusText}\``, inline: false },
                { 
                    name: '🚀 Getting Started', 
                    value: `You can now start using automations:\n> 🔗 Link account: \`${activePrefix}link\`\n> ⚡ Start quests: \`${activePrefix}questall\``, 
                    inline: false 
                }
            );

        await dmFn(dmEmbed);
    } catch (err) {
        console.error('Could not send success DM to user:', err);
    }
}
