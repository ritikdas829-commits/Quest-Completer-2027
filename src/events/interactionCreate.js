import { getEmoji } from '../handlers/emoji.js';
import { handleGuideButtons } from '../commands/guide.js';
import { handleButton as handlePremiumButton, handleModal as handlePremiumModal } from '../commands/premiumLink.js';
import { buildQuestSolverPanel } from '../quest/questUI.js';

export default {
    name: 'interactionCreate',
    once: false,
    async execute(interaction, client) {
        try {
            // 1. Guide Buttons handler (btn_pc, btn_android, btn_ios)
            if (interaction.isButton() && ['btn_pc', 'btn_android', 'btn_ios'].includes(interaction.customId)) {
                await handleGuideButtons(interaction);
                return;
            }

            // 2. Premium Slot Buttons handler
            if (interaction.isButton() && (
                interaction.customId.startsWith('link_slot_') ||
                interaction.customId.startsWith('unlink_slot_') ||
                interaction.customId.startsWith('select_slot_')
            )) {
                await handlePremiumButton(interaction, client);
                return;
            }

            // 3. Link prompt button (opens modal or responds)
            if (interaction.isButton() && interaction.customId === 'link_prompt') {
                await interaction.reply({ content: '🔗 Please use the link command or manage slots via premium panel.', flags: 64 }).catch(() => {});
                return;
            }

            // 4. Modals handler (Premium modals & token modals)
            if (interaction.isModalSubmit()) {
                if (interaction.customId.startsWith('link_modal_slot_')) {
                    await handlePremiumModal(interaction, client);
                    return;
                }
                if (interaction.customId === 'link_token_modal') {
                    await interaction.reply({ content: '✅ Token modal received.', flags: 64 }).catch(() => {});
                    return;
                }
            }

            // 5. Quest Select Menu handler
            if (interaction.isStringSelectMenu() && interaction.customId.startsWith('quest_select_')) {
                await interaction.deferUpdate();
                const selectedQuestId = interaction.values[0];
                const panel = await buildQuestSolverPanel(client, interaction.guild.id, interaction.user.id, selectedQuestId);
                await interaction.editReply(panel);
                return;
            }

            // 6. Quest Buttons handler (start, stop, refresh)
            if (interaction.isButton() && (interaction.customId.startsWith('quest_start_') || interaction.customId.startsWith('quest_stop_') || interaction.customId === 'quest_refresh')) {
                if (interaction.customId === 'quest_refresh') {
                    await interaction.deferUpdate();
                    const panel = await buildQuestSolverPanel(client, interaction.guild.id, interaction.user.id);
                    await interaction.editReply(panel);
                    return;
                }

                if (interaction.customId.startsWith('quest_start_')) {
                    const questId = interaction.customId.replace('quest_start_', '');
                    await interaction.reply({ content: `▶️ Quest start requested for ID: \`${questId}\``, flags: 64 });
                    return;
                }

                if (interaction.customId.startsWith('quest_stop_')) {
                    const questId = interaction.customId.replace('quest_stop_', '');
                    await interaction.reply({ content: `⏹️ Quest stop requested for ID: \`${questId}\``, flags: 64 });
                    return;
                }
            }

            // 7. Slash commands
            if (interaction.isChatInputCommand()) {
                const command = client.commands.get(interaction.commandName);
                if (!command) return;
                await command.execute(interaction, client);
            }
        } catch (err) {
            console.error('❌ Interaction Error:', err);
            const msg = { content: `${getEmoji('error')} Something went wrong.`, flags: 64 };
            if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
                await interaction.reply(msg).catch(() => {});
            } else if (interaction.isRepliable() && interaction.deferred) {
                await interaction.followUp(msg).catch(() => {});
            }
        }
    },
};
