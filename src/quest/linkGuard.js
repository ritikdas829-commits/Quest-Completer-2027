/**
 * linkGuard.js - Link Check Guard
 * Location: src/quest/linkGuard.js
 * If user not linked and uses any command, show link panel
 * Until linked, quest will not run
 */

import { buildSlotPanel } from './slotUI.js';

export function hasAnyLinkedSlot(userId, tokenStore) {
    for (let i = 1; i <= 5; i++) {
        const token = tokenStore.get(`${userId}_slot_${i}`);
        if (token) return true;
    }
    return false;
}

export function getLinkedSlotsCount(userId, tokenStore) {
    let count = 0;
    for (let i = 1; i <= 5; i++) {
        if (tokenStore.get(`${userId}_slot_${i}`)) count++;
    }
    return count;
}

export async function requireLink(member, tokenStore, inviteStore, commandName = 'quest') {
    const userId = member.id || member.user?.id;
    const hasLinked = hasAnyLinkedSlot(userId, tokenStore);

    if (!hasLinked) {
        const panel = await buildSlotPanel(member, inviteStore, tokenStore);
        return {
            linked: false,
            hasLinked: false,
            panel: panel,
            message: `❌ Link Required - Please link first - Use /link or ?link - Until then ${commandName} will not run`,
        };
    }

    return {
        linked: true,
        hasLinked: true,
        panel: null,
        message: null,
    };
}

export async function requireLinkForQuest(member, tokenStore, inviteStore) {
    return await requireLink(member, tokenStore, inviteStore, 'quest');
}

export function withLinkGuard(commandExecute) {
    return async (interaction, client, ...args) => {
        const member = interaction.member || interaction.user;
        const check = await requireLink(member, client.tokenStore, client.inviteStore, interaction.commandName || 'command');
        
        if (!check.linked) {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ ...check.panel, ephemeral: true }).catch(()=>{});
            } else {
                await interaction.reply({ ...check.panel, ephemeral: true }).catch(async () => {
                    await interaction.reply({ content: check.message, ephemeral: true }).catch(()=>{});
                });
            }
            return;
        }
        return await commandExecute(interaction, client, ...args);
    };
}

export function withLinkGuardPrefix(prefixExecute) {
    return async (message, args, client, ...rest) => {
        const check = await requireLink(message.member, client.tokenStore, client.inviteStore, 'quest');
        
        if (!check.linked) {
            await message.reply({ ...check.panel }).catch(async () => {
                await message.reply(check.message).catch(()=>{});
            });
            return;
        }
        return await prefixExecute(message, args, client, ...rest);
    };
}
