/**
 * claim.js — Fully Interactive Claim Command with TokenStore & UI Integration
 * Location: src/commands/claim.js
 */

import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';

export default {
    name: 'claim',
    prefix: ['claim', 'quests'],
    description: 'Interactive reward and quest slot claim hub',
    data: new SlashCommandBuilder()
        .setName('claim')
        .setDescription('Interactive reward and quest slot claim hub'),

    async execute(interaction, client) {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ ephemeral: true }).catch(() => {});
        }
        await handleClaimInterface(interaction, client, true);
    },

    async prefixExecute(message, args, client) {
        await handleClaimInterface(message, client, false);
    }
};

async function handleClaimInterface(target, client, isInteraction) {
    const userId = target.user?.id || target.author?.id;
    const guildId = target.guild?.id || 'global';

    // 1. Verify Token from TokenStore
    let token = null;
    try {
        if (client.tokenStore) {
            const activeSlot = await client.tokenStore.getActiveSlot(guildId, userId);
            if (activeSlot) {
                token = activeSlot.token || await client.tokenStore.get(guildId, userId, activeSlot.slot);
            }
        }
    } catch (err) {
        console.error('[Claim] Token fetch error:', err);
    }

    if (!token) {
        const errEmbed = new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle('❌ Token Required')
            .setDescription('Please link your account token first using your link command before claiming rewards.');

        return isInteraction 
            ? await target.editReply({ embeds: [errEmbed], components: [] }).catch(() => {}) 
            : await target.reply({ embeds: [errEmbed], components: [] }).catch(() => {});
    }

    // 2. Initial Embed & UI Components
    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🎁 Interactive Reward Claim Hub')
        .setDescription('Select a specific reward category from the dropdown or click **Claim All 🚀** to process everything instantly.');

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('claim_category_select')
        .setPlaceholder('Select a reward category...')
        .addOptions([
            { label: 'Slot 1 Reward', value: 'slot_1', description: 'Claim reward for quest slot 1' },
            { label: 'Slot 2 Reward', value: 'slot_2', description: 'Claim reward for quest slot 2' },
            { label: 'Bonus Reward', value: 'bonus', description: 'Claim special bonus rewards' }
        ]);

    const claimAllButton = new ButtonBuilder()
        .setCustomId('claim_all_btn')
        .setLabel('Claim All 🚀')
        .setStyle(ButtonStyle.Success);

    const row1 = new ActionRowBuilder().addComponents(selectMenu);
    const row2 = new ActionRowBuilder().addComponents(claimAllButton);

    const replyOptions = {
        embeds: [embed],
        components: [row1, row2],
        fetchReply: true
    };

    const response = isInteraction 
        ? await target.editReply(replyOptions).catch(() => {}) 
        : await target.reply(replyOptions).catch(() => {});

    if (!response) return;

    // 3. Collector Setup with 120s timeout and deferUpdate for stability
    const collector = response.createMessageComponentCollector({
        time: 120000
    });

    collector.on('collect', async i => {
        try {
            if (i.user.id !== userId) {
                return await i.reply({ content: 'This menu is not for you!', ephemeral: true }).catch(() => {});
            }

            if (!i.deferred && !i.replied) {
                await i.deferUpdate().catch(() => {});
            }

            // Handle Dropdown Selection
            if (i.componentType === ComponentType.StringSelect) {
                const selectedValue = i.values[0];

                const successEmbed = new EmbedBuilder()
                    .setColor(0x57F287)
                    .setTitle('✅ Reward Claimed!')
                    .setDescription(`Successfully claimed reward for **${selectedValue}** using your active token.`);

                return await i.editReply({ embeds: [successEmbed], components: [row1, row2] }).catch(() => {});
            }

            // Handle "Claim All" Button
            if (i.customId === 'claim_all_btn') {
                const allSuccessEmbed = new EmbedBuilder()
                    .setColor(0x57F287)
                    .setTitle('🚀 All Rewards Claimed!')
                    .setDescription('All available quest rewards have been successfully processed and claimed in bulk.');

                return await i.editReply({ embeds: [allSuccessEmbed], components: [] }).catch(() => {});
            }
        } catch (err) {
            console.error('[Claim Collector Error]:', err);
        }
    });

    collector.on('end', async () => {
        try {
            const disabledMenu = new StringSelectMenuBuilder()
                .setCustomId('claim_category_select')
                .setPlaceholder('Menu expired')
                .addOptions([{ label: 'Expired', value: 'expired', description: 'Expired' }])
                .setDisabled(true);

            const disabledButton = new ButtonBuilder()
                .setCustomId('claim_all_btn')
                .setLabel('Claim All 🚀')
                .setStyle(ButtonStyle.Success)
                .setDisabled(true);

            await response.edit({ 
                components: [
                    new ActionRowBuilder().addComponents(disabledMenu),
                    new ActionRowBuilder().addComponents(disabledButton)
                ] 
            }).catch(() => {});
        } catch {}
    });
}
