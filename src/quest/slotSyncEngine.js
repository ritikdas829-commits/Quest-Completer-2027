l/**
 * slotSyncEngine.js - Automated Slot & Role Synchronization Engine (FIXED FOR ALL 6 SLOTS)
 * Location: src/quest/slotSyncEngine.js
 */

import { getProgressiveSlots } from './slotSystem.js';
import { getRoles } from './roleStore.js';

/**
 * Synchronizes a user's Discord roles and slot access based on their current status.
 * @param {GuildMember} member - The Discord guild member object.
 * @param {Client} client - The Discord client instance.
 */
export async function syncUserSlotsAndRoles(member, client) {
    try {
        if (!member || member.user?.bot || !member.guild) return;

        const guild = member.guild;
        const roles = getRoles(guild.id) || {};
        
        // Fetch slot details and progression state
        const slotData = await getProgressiveSlots(member);
        const { invites, boosts } = slotData;

        // 1. Check if user unlocked higher tiers (2/5/10/15 Invites or 1/2 Boosts)
        const hasSlot2 = invites >= 2;
        const hasSlot3 = invites >= 5;
        const hasSlot4 = invites >= 10;
        const hasSlot5 = invites >= 15 || boosts >= 1;
        const hasSlot6 = boosts >= 2;

        // 2. AUTO-ASSIGN PROGRESSIVE ROLES safely for all 6 slots
        const roleSlot2 = roles.ROLE_SLOT_2 || roles.ROLE_2_INVITES;
        const roleSlot3 = roles.ROLE_SLOT_3 || roles.ROLE_5_INVITES;
        const roleSlot4 = roles.ROLE_SLOT_4 || roles.ROLE_10_INVITES;
        const roleSlot5 = roles.ROLE_1_BOOST || roles.ROLE_SLOT_5;
        const roleSlot6 = roles.ROLE_2_BOOST || roles.ROLE_SLOT_6;

        if (hasSlot2 && roleSlot2 && !member.roles.cache.has(roleSlot2)) {
            await member.roles.add(roleSlot2).catch(() => {});
        }
        if (hasSlot3 && roleSlot3 && !member.roles.cache.has(roleSlot3)) {
            await member.roles.add(roleSlot3).catch(() => {});
        }
        if (hasSlot4 && roleSlot4 && !member.roles.cache.has(roleSlot4)) {
            await member.roles.add(roleSlot4).catch(() => {});
        }
        if (hasSlot5 && roleSlot5 && !member.roles.cache.has(roleSlot5)) {
            await member.roles.add(roleSlot5).catch(() => {});
        }
        if (hasSlot6 && roleSlot6 && !member.roles.cache.has(roleSlot6)) {
            await member.roles.add(roleSlot6).catch(() => {});
        }

        console.log(`⚡ [SlotSyncEngine] Successfully synced ${member.user.tag} (All 6 Slots Checked & Managed).`);
    } catch (err) {
        console.error(`Error in syncUserSlotsAndRoles for ${member?.id}:`, err.message);
    }
}
