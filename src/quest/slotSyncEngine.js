/**
 * slotSyncEngine.js - Automated Slot & Role Synchronization Engine
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
        const roles = getRoles(guild.id);
        
        // Fetch slot details and progression state
        const slotData = await getProgressiveSlots(member);
        const { invites, boosts, isTrialActive } = slotData;

        // 1. Check if user unlocked higher tiers (2/5/10 Invites or 1/2 Boosts)
        const hasSlot2 = invites >= 2;
        const hasSlot3 = invites >= 5;
        const hasSlot4 = invites >= 10;
        const hasSlot5 = invites >= 15 || boosts >= 1;
        const hasSlot6 = boosts >= 2;

        const hasAnyProgressiveTier = hasSlot2 || hasSlot3 || hasSlot4 || hasSlot5 || hasSlot6;

        // 2. AUTO-REMOVE TRIAL ROLE if higher progressive tier achieved
        if (hasAnyProgressiveTier && roles.ROLE_TRIAL && member.roles.cache.has(roles.ROLE_TRIAL)) {
            try {
                await member.roles.remove(roles.ROLE_TRIAL);
                console.log(`🧹 Auto-removed Trial Role from ${member.user.tag} (Unlocked progressive tier).`);
            } catch (err) {
                console.error(`Failed to remove Trial Role for ${member.user.tag}:`, err.message);
            }
        }

        // 3. AUTO-ASSIGN PROGRESSIVE ROLES based on invites/boosts
        if (hasSlot2 && roles.ROLE_SLOT_2 && !member.roles.cache.has(roles.ROLE_SLOT_2)) {
            await member.roles.add(roles.ROLE_SLOT_2).catch(() => {});
        }
        if (hasSlot3 && roles.ROLE_SLOT_3 && !member.roles.cache.has(roles.ROLE_SLOT_3)) {
            await member.roles.add(roles.ROLE_SLOT_3).catch(() => {});
        }
        if (hasSlot4 && roles.ROLE_SLOT_4 && !member.roles.cache.has(roles.ROLE_SLOT_4)) {
            await member.roles.add(roles.ROLE_SLOT_4).catch(() => {});
        }
        if (hasSlot5 && roles.ROLE_1_BOOST && !member.roles.cache.has(roles.ROLE_1_BOOST)) {
            await member.roles.add(roles.ROLE_1_BOOST).catch(() => {});
        }
        if (hasSlot6 && roles.ROLE_2_BOOST && !member.roles.cache.has(roles.ROLE_2_BOOST)) {
            await member.roles.add(roles.ROLE_2_BOOST).catch(() => {});
        }

        console.log(`⚡ [SlotSyncEngine] Successfully synced ${member.user.tag} (${slotData.slotsToShow} slots active).`);
    } catch (err) {
        console.error(`Error in syncUserSlotsAndRoles for ${member?.id}:`, err.message);
    }
}
