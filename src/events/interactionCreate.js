import { getEmoji } from '../handlers/emoji.js';
import { handleLinkModal, handleLinkPromptButton } from '../commands/questCommands.js';
import { handleGuideButtons } from '../commands/guide.js';
import { buildQuestSolverPanel } from '../quest/questUI.js';

export default {
    name: 'interactionCreate',
    once: false,
    async execute(interaction, client) {

        // Guide Buttons handler (btn_pc, btn_android, btn_ios)
        if (interaction.isButton() && (interaction.customId === 'btn_pc' || interaction.customId === 'btn_android' || interaction.customId === 'btn_ios')) {
            await handleGuideButtons(interaction);
            return;
        }

        // Modal: link token
        if (interaction.isModalSubmit() && interaction.customId === 'link_token_modal') {
            await handleLinkModal(interaction, client);
            return;
        }

        // Button: link_prompt (opens modal)
        if (interaction.isButton() && interaction.customId === 'link_prompt') {
            await handleLinkPromptButton(interaction);
            return;
        }

        // Quest Select Menu handler
        if (interaction.isStringSelectMenu() && interaction.customId.startsWith('quest_select_')) {
            await interaction.deferUpdate();
            const selectedQuestId = interaction.values[0];
            const panel = await buildQuestSolverPanel(client, interaction.guild.id, interaction.user.id, selectedQuestId);
            await interaction.editReply(panel);
            return;
        }

        // Quest Buttons handler (start, stop, refresh)
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

        // Slash commands
        if (!interaction.isChatInputCommand()) return;
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.execute(interaction, client);
        } catch (err) {
            console.error(err);
            const msg = { content: `${getEmoji('error')} Something went wrong.`, flags: 64 };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(msg).catch(() => {});
            } else {
                await interaction.reply(msg).catch(() => {});
            }
        }
    },
};
