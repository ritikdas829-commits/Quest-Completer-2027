/**
 * accessCheck.js - Check if user has required roles/status before running commands
 * Location: src/handlers/accessCheck.js
 */

import { EmbedBuilder } from 'discord.js';

export async function checkUserAccess(messageOrInteraction, clientInstance) {
    const member = messageOrInteraction.member;
    if (!member) return true; // Fallback for DMs or non-guild context

    // Aapke server ke roles (Environment variables ya direct IDs se check karein)
    const allowedRoles = [
        process.env.ROLE_PREMIUM, 
        process.env.ROLE_BOOSTER, 
        process.env.ROLE_TRIAL
    ].filter(Boolean); // undefined roles ko filter out kar dega

    // Agar server mein roles configure nahi hain, toh by default pass ya block karne ka logic
    if (allowedRoles.length > 0) {
        const hasAccess = member.roles.cache.some(role => allowedRoles.includes(role.id));
        if (hasAccess) return true;
    }

    // Bot ka prefix dynamic nikalne ke liye (default ';' agar na mile toh)
    const client = clientInstance || messageOrInteraction.client;
    const prefix = client?.config?.prefix || client?.prefix || ';';

    // Agar user ke paas role nahi hai, toh Access Denied embed bhejo with dynamic prefix
    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('💙 Premium Access Required')
        .setDescription(
            `This premium bot requires the **Premium**, **Booster**, or **Trial** role/status.\n\n` +
            `💎 **Free Orbie Premium Trial!**\n` +
            `> ⭐ You are eligible to claim a free 30-day Orbie Premium trial.\n` +
            `> ⌨️ Use the command \`${prefix}activate trial\` to get your trial key at no cost.\n\n` +
            `Join support: https://discord.gg/p2PnQhdf38`
        );

    try {
        if (messageOrInteraction.replied || messageOrInteraction.deferred) {
            await messageOrInteraction.followUp({ embeds: [embed], ephemeral: true });
        } else if (typeof messageOrInteraction.reply === 'function') {
            await messageOrInteraction.reply({ embeds: [embed], ephemeral: true });
        } else if (messageOrInteraction.channel) {
            await messageOrInteraction.channel.send({ embeds: [embed] });
        }
    } catch (err) {
        console.error('Error sending access check embed:', err);
    }

    return false;
}
