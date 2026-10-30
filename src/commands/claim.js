/**
 * claim.js — Interactive Claim Command with Dropdown & Claim All Button
 * Location: src/commands/claim.js
 */

import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';

export default {
    name: 'claim',
    prefix: 'claim',
    description: 'Claim your rewards, items, or quest slots interactively',
    data: new SlashCommandBuilder()
        .setName('claim')
        .setDescription('Claim your rewards, items, or quest slots interactively'),

    async execute(interaction, client) {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ ephemeral: true }).catch(() => {});
        }
        await handleClaimInterface(interaction, true);
    },

    async prefixExecute(message, args, client) {
        await handleClaimInterface(message, false);
    }
};

async function handleClaimInterface(target, isInteraction) {
    // 1. Initial Embed aur UI components banana
    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🎁 Interactive Reward Claim Hub')
        .setDescription('Dropdown se category select karein ya phir ek hi baar mein sab kuch claim karne ke liye **Claim All** button dabayein!');

    // Dropdown Menu (Categories / Slots select karne ke liye)
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('claim_category_select')
        .setPlaceholder('Select a category to claim...')
        .addOptions([
            { label: 'Slot 1 Reward', value: 'slot_1', description: 'Claim reward for slot 1' },
            { label: 'Slot 2 Reward', value: 'slot_2', description: 'Claim reward for slot 2' },
            { label: 'Bonus Quest', value: 'bonus', description: 'Claim bonus reward' }
        ]);

    // Button (Claim All ke liye)
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

    // 2. Collector setup karna (Dropdown aur Button dono ko handle karne ke liye)
    const collector = response.createMessageComponentCollector({
        time: 60000 // 60 seconds timeout
    });

    collector.on('collect', async i => {
        if (i.user.id !== (target.user?.id || target.author?.id)) {
            return await i.reply({ content: 'Yeh menu aapke liye nahi hai!', ephemeral: true }).catch(() => {});
        }

        // Agar user ne Dropdown se kuch select kiya
        if (i.componentType === ComponentType.StringSelect) {
            const selectedValue = i.values[0];
            
            if (!i.deferred && !i.replied) await i.deferUpdate().catch(() => {});

            const successEmbed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle('✅ Claimed Successfully!')
                .setDescription(`Aapne **${selectedValue}** successfully claim kar liya hai.`);

            return await i.editReply({ embeds: [successEmbed], components: [row1, row2] }).catch(() => {});
        }

        // Agar user ne "Claim All" Button dabaya
        if (i.customId === 'claim_all_btn') {
            if (!i.deferred && !i.replied) await i.deferUpdate().catch(() => {});

            const allSuccessEmbed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle('🚀 All Rewards Claimed!')
                .setDescription('Aapke saare available rewards ek hi baar mein successfully claim ho chuke hain.');

            return await i.editReply({ embeds: [allSuccessEmbed], components: [] }).catch(() => {});
        }
    });

    // 3. Timeout hone par components disable kar dena
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
