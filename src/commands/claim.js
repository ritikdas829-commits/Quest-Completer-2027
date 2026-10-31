/**
 * claim.js — Fully Fixed Direct API Claim Hub with Raw Filtering & Bulk Loop
 * Location: src/commands/claim.js
 */

import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';

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

function createUserClient(token) {
    const BASE_URL = 'https://discord.com/api/v10';
    return {
        async get(endpoint) {
            const res = await fetch(`${BASE_URL}${endpoint}`, {
                headers: { Authorization: token }
            });
            if (!res.ok) throw new Error(`API GET Error: ${res.statusText}`);
            return await res.json();
        },
        async post(endpoint, body = {}) {
            const res = await fetch(`${BASE_URL}${endpoint}`, {
                method: 'POST',
                headers: {
                    Authorization: token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`API POST Error (${res.status}): ${text}`);
            }
            return await res.text().then(t => t ? JSON.parse(t) : {});
        }
    };
}

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

    const userClient = createUserClient(token);
    let rawQuests = [];

    try {
        const questData = await userClient.get('/quests/@me');
        rawQuests = Array.isArray(questData) ? questData : (questData?.quests || questData?.items || []);
    } catch (err) {
        const errEmbed = new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle('❌ API Connection Failed')
            .setDescription(`Could not fetch quests using your token.\n\n*Error:* \`${err.message}\``);

        return isInteraction 
            ? await target.editReply({ embeds: [errEmbed], components: [] }).catch(() => {}) 
            : await target.reply({ embeds: [errEmbed], components: [] }).catch(() => {});
    }

    // Direct and robust raw filtering for all completed & unclaimed quests
    const claimableQuests = rawQuests.filter(q => {
        const status = q.user_status || {};
        const isCompleted = status.completed_at != null || status.percent_complete === 100;
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

            // Dropdown selection individual claim
            if (i.componentType === ComponentType.StringSelect) {
                const questId = i.values[0];
                if (questId === 'none') return;

                const targetQ = claimableQuests.find(q => q.id === questId);
                const questName = targetQ?.config?.messages?.quest_name || questId;

                let success = false;
                try {
                    await userClient.post(`/quests/${encodeURIComponent(questId)}/claim-reward`);
                    success = true;
                } catch (e) {
                    console.error(`[Claim Error] Failed for ${questId}:`, e.message);
                }

                const resEmbed = new EmbedBuilder();
                if (success) {
                    resEmbed.setColor(0x57F287)
                        .setTitle('✅ Quest Reward Claimed!')
                        .setDescription(`Successfully claimed reward for **${questName}**!`);
                } else {
                    resEmbed.setColor(0xED4245)
                        .setTitle('❌ Claim Failed')
                        .setDescription(`Could not claim reward for **${questName}**.`);
                }

                return await i.editReply({ embeds: [resEmbed], components: [row1, row2] }).catch(() => {});
            }

            // Claim All Button click handler
            if (i.customId === 'claim_all_btn') {
                let claimedCount = 0;
                for (const q of claimableQuests) {
                    try {
                        await userClient.post(`/quests/${encodeURIComponent(q.id)}/claim-reward`);
                        claimedCount++;
                    } catch (err) {
                        console.error(`[ClaimAll Error for ${q.id}]:`, err.message);
                    }
                }

                const allSuccessEmbed = new EmbedBuilder()
                    .setColor(0x57F287)
                    .setTitle('🚀 Bulk Claim Completed!')
                    .setDescription(`Successfully processed and claimed **${claimedCount}** out of **${claimableQuests.length}** quest reward(s).`);

                return await i.editReply({ embeds: [allSuccessEmbed], components: [] }).catch(() => {});
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
