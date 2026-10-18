/**
 * quest.js — Quest Command Handler
 * Location: src/commands/quest.js
 */

import { SlashCommandBuilder, MessageFlags } from 'discord.js';

export const questCmd = {
    data: new SlashCommandBuilder()
        .setName('quest')
        .setDescription('Quest Solver - Banner + SelectMenu + Rewards'),
    prefix: 'quest',

    async execute(interaction, client) { 
        await interaction.deferReply({ flags: MessageFlags.IsComponentsV2 }); 
        const { buildQuestSolverPanel } = await import('../quest/questUI.js'); 
        const panel = await buildQuestSolverPanel(client, interaction.guild.id, interaction.user.id); 
        await interaction.editReply(panel); 
    },

    async prefixExecute(message, _args, client) { 
        const { buildQuestSolverPanel } = await import('../quest/questUI.js'); 
        const panel = await buildQuestSolverPanel(client, message.guild.id, message.author.id); 
        await message.reply(panel); 
    }
};
