/**
 * autoquest.js — Autoquest Command Handler (Fixed Double-Response)
 * Location: src/commands/autoquest.js
 */

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { enableAutoquest, disableAutoquest, isAutoquestEnabled, canUseAutoquest } from '../quest/autoquestStore.js';

async function getActiveToken(guildId, userId, tokenStore) { 
    const active = await tokenStore.getActiveSlot(guildId, userId); 
    if (!active) return null; 
    return active.token || await tokenStore.get(guildId, userId, active.slot); 
}

async function runAutoquestToggle(guildId, userId, member, tokenStore, replyFn, prefix) {
    // 1. Booster / Invite Check
    const check = await canUseAutoquest(member); 
    if (!check.allowed) { 
        const lock = check.lock; 
        const embed = new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle(lock.title)
            .setDescription(lock.desc);
        
        return await replyFn({ embeds: [embed] }); 
    }

    // 2. Toggle Off
    if (isAutoquestEnabled(userId)) { 
        disableAutoquest(userId); 
        const embed = new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle('🤖 Auto-Quest Disabled')
            .setDescription('Auto-quest background processing has been turned off for your account.');
        
        return await replyFn({ embeds: [embed] }); 
    }

    // 3. Check Active Slot Token
    const token = await getActiveToken(guildId, userId, tokenStore); 
    if (!token) { 
        const embed = new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle('❌ No Token Found')
            .setDescription(`Please link your account token first using \`${prefix}link\``);
        
        return await replyFn({ embeds: [embed] }); 
    }

    // 4. Toggle On
    enableAutoquest(userId); 
    const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('🤖 Auto-Quest Enabled!')
        .setDescription('Every new quest will be automatically completed for you in the background!');

    return await replyFn({ embeds: [embed] });
}

export const autoquestCmd = {
    data: new SlashCommandBuilder()
        .setName('autoquest')
        .setDescription('Auto-quest Booster - 15 Invite OR Boost Requirement'),
    prefix: 'autoquest',

    async execute(i, client) { 
        await i.deferReply({ ephemeral: true }); 
        const prefix = client.getPrefix ? client.getPrefix(i.guild.id) : ';';
        await runAutoquestToggle(i.guild.id, i.user.id, i.member, client.tokenStore, (o) => i.editReply(o), prefix); 
    },

    async prefixExecute(m, args, client) { 
        const prefix = client.getPrefix ? client.getPrefix(m.guild.id) : ';';
        await runAutoquestToggle(m.guild.id, m.author.id, m.member, client.tokenStore, (o) => m.reply(o), prefix); 
    }
};

export default autoquestCmd;
