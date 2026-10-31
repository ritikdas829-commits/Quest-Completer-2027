/**
 * claim.js — Final Working Quest Claim Hub using QuestClient & Official Endpoints
 * Location: src/commands/claim.js
 */

import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { QuestClient } from '../quest/questClient.js';

export default {
    name: 'claim',
    prefix: 'claim',
    description: 'Real-time interactive quest reward claim hub',
    data: new SlashCommandBuilder()
        .setName('claim')
        .setDescription('Real-time interactive quest reward claim hub'),

    async execute(interaction, client) {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ ephemeral: true }).catch(() => {});
        }
        await handleClaimHub(interaction, client, true);
    },

    async prefixExecute(message, args, client) {
        await handleClaimHub(message, client, false);
    }
};

async function handleClaimHub(target, client, isInteraction) {
    const userId = target.user?.id || target.author?.id;
    const guildId = target.guild?.id || 'global';

    let token = null;
    try {
        if (client.tokenStore) {
            const activeSlot = await client.tokenStore.getActiveSlot(guildId, userId);
            if (activeSlot) {
                token = activeSlot.token || await client.tokenStore.get(guildId, userId, activeSlot.slot);
            }
        }
    } catch (err) {
        console.error('[Claim Hub] Token fetch error:', err);
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

    let questClient;
    let rawQuests = [];

    try {
        // Initialize official QuestClient wrapper
        questClient = new QuestClient(token);
        const questData = await questClient.fetchQuestsRaw();
        rawQuests = Array.isArray(questData) ? questData : (questData?.quests || questData?.items || []);
    } catch (err) {
        const errEmbed = new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle('❌ API Connection Failed')
            .setDescription(`Could not fetch quests using your token. It might be invalid or expired.\n\n*Error:* \`${err.message}\``);

        return isInteraction 
            ? await target.editReply({ embeds: [errEmbed], components: [] }).catch(() => {}) 
            : await target.reply({ embeds: [errEmbed], components: [] }).catch(() => {});
    }

    // Robust filtering for completed and unclaimed quests
    const claimableQuests = rawQuests.filter(q => {
        const status = q.user_status || q.userStatus || {};
        const isCompleted = status.completed_at != null;
        const hasClaimed = status.claimed_at != null;
        return isCompleted && !hasClaimed;
    });

    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🎁 Interactive Reward Claim Hub')
        .setDescription(`Found **${claimableQuests.length}** claimable quest(s).\nSelect a specific quest from the dropdown or click **Claim All 🚀** to claim everything at once.`);

    const selectOptions = claimableQuests.length > 0 
        ? claimableQuests.slice(0, 25).map(q => {
            const questName = q.config?.messages?.quest_name || q.id;
            return {
                label: questName.substring(0, 100),
                value: q.id,
                description: 'Click to claim reward'
            };
        })
        : [{ label: 'No claimable quests found', value: 'none', description: 'Complete quests first!' }];

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('claim_quest_select')
        .setPlaceholder('Select a specific quest to claim...')
        .addOptions(selectOptions);

    if (claimableQuests.length === 0) {
        selectMenu.setDisabled(true);
    }

    const claimAllButton = new ButtonBuilder()
        .setCustomId('claim_all_btn')
        .setLabel('Claim All 🚀')
        .setStyle(ButtonStyle.Success)
        .setDisabled(claimableQuests.length === 0);

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

    const collector = response.createMessageComponentCollector({ time: 120000 });

    collector.on('collect', async i => {
        try {
            if (i.user.id !== userId) {
                return await i.reply({ content: 'This menu is not for you!', ephemeral: true }).catch(() => {});
            }

            if (!i.deferred && !i.replied) {
                await i.deferUpdate().catch(() => {});
            }

            // Dropdown selection individual claim using official /reward-codes endpoint
            if (i.componentType === ComponentType.StringSelect) {
                const questId = i.values[0];
                if (questId === 'none') return;

                const targetQ = claimableQuests.find(q => q.id === questId);
                const questName = targetQ?.config?.messages?.quest_name || questId;

                let success = false;
                try {
                    await questClient.post(`/quests/${encodeURIComponent(questId)}/reward-codes`);
                    success = true;
                } catch (e) {
                    try {
                        await questClient.post(`/quests/${encodeURIComponent(questId)}/claim`);
                        success = true;
                    } catch {}
                }

                const resEmbed = new EmbedBuilder()
                    .setColor(success ? 0x57F287 : 0xED4245)
                    .setTitle(success ? '✅ Claimed!' : '❌ Failed')
                    .setDescription(success ? `Successfully claimed **${questName}**!` : `Failed to claim **${questName}** - already claimed or not completed.`);

                return await i.editReply({ embeds: [resEmbed], components: [row1, row2] }).catch(() => {});
            }

            // Claim All Button click handler with correct endpoint and rate-limit delay (800ms)
            if (i.customId === 'claim_all_btn') {
                let claimedCount = 0;
                for (const q of claimableQuests) {
                    try {
                        await questClient.post(`/quests/${encodeURIComponent(q.id)}/reward-codes`);
                        claimedCount++;
                        await new Promise(r => setTimeout(r, 800)); // Rate-limit protection
                    } catch (e) {
                        try {
                            await questClient.post(`/quests/${encodeURIComponent(q.id)}/claim`);
                            claimedCount++;
                            await new Promise(r => setTimeout(r, 800));
                        } catch {}
                    }
                }

                const embedAll = new EmbedBuilder()
                    .setColor(0x57F287)
                    .setTitle('🚀 Bulk Claim Done!')
                    .setDescription(`Claimed **${claimedCount}/${claimableQuests.length}** rewards successfully.`);

                return await i.editReply({ embeds: [embedAll], components: [] }).catch(() => {});
            }
        } catch (err) {
            console.error('[Claim Collector Error]:', err);
        }
    });

    collector.on('end', async () => {
        try {
            const disabledMenu = new StringSelectMenuBuilder()
                .setCustomId('claim_quest_select')
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
