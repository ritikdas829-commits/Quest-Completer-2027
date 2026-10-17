/**
 * slotSystem.js - 4 Roles Progressive - Multi Server - No Crash - FINAL
 * Location: src/quest/slotSystem.js
 * Logic: 
 * Slot1 Free, Slot2 2 Invite, Slot3 5 Invite, Slot4 10 Invite OR 1 Boost, Slot5 2 Boost
 * 2 slot show -> Role2 milega -> 3 show -> Role5 milega -> 4 show -> Role1Boost milega -> 5 show
 */

import { getRoles } from './roleStore.js';

export const SLOTS = {
    1: { label: 'Free Slot', need: 'Free', invites: 0, boosts: 0 },
    2: { label: '2 Invite Slot', need: '2 Invites', invites: 2, boosts: 0 },
    3: { label: '5 Invite Slot', need: '5 Invites', invites: 5, boosts: 0 },
    4: { label: '10 Invite OR 1 Boost Slot', need: '10 Invites OR 1 Boost', invites: 10, boosts: 1 },
    5: { label: '2 Boost Slot', need: '2 Boosts', invites: 0, boosts: 2 },
};

export function getCounts(member, inviteStore) {
    try {
        let invites = 0;
        if (inviteStore && typeof inviteStore.get === 'function') {
            invites = inviteStore.get(member.id) || 0;
        } else if (inviteStore && inviteStore[member.id] !== undefined) {
            invites = inviteStore[member.id];
        } else if (inviteStore && typeof inviteStore === 'number') {
            invites = inviteStore;
        } else {
            const roles = getRoles(member.guild?.id);
            if (roles.ROLE_1_BOOST && member.roles.cache.has(roles.ROLE_1_BOOST)) invites = Math.max(invites, 10);
            if (roles.ROLE_5_INVITES && member.roles.cache.has(roles.ROLE_5_INVITES)) invites = Math.max(invites, 5);
            else if (roles.ROLE_2_INVITES && member.roles.cache.has(roles.ROLE_2_INVITES)) invites = Math.max(invites, 2);
        }

        let boosts = 0;
        const roles = getRoles(member.guild?.id);
        if (member.premiumSince) boosts = 1;
        if (roles.ROLE_1_BOOST && member.roles.cache.has(roles.ROLE_1_BOOST)) boosts = Math.max(boosts, 1);
        if (roles.ROLE_2_BOOST && member.roles.cache.has(roles.ROLE_2_BOOST)) boosts = 2;

        return { invites, boosts };
    } catch (err) {
        console.error("getCounts error:", err.message);
        return { invites: 0, boosts: 0 };
    }
}

export async function getProgressiveSlots(member, inviteStore) {
    try {
        const guildId = member.guild?.id || 'global';
        const roles = getRoles(guildId);
        const { invites, boosts } = getCounts(member, inviteStore);
        
        const hasRole2 = roles.ROLE_2_INVITES ? member.roles.cache.has(roles.ROLE_2_INVITES) || invites >= 2 : invites >= 2;
        const hasRole5 = roles.ROLE_5_INVITES ? member.roles.cache.has(roles.ROLE_5_INVITES) || invites >= 5 : invites >= 5;
        const hasBoost1 = roles.ROLE_1_BOOST ? member.roles.cache.has(roles.ROLE_1_BOOST) || boosts >= 1 || invites >= 10 : boosts >= 1 || invites >= 10;
        const hasBoost2 = roles.ROLE_2_BOOST ? member.roles.cache.has(roles.ROLE_2_BOOST) || boosts >= 2 : boosts >= 2;

        let slotsToShow = 2;
        let stage = '';

        if (!hasRole2) {
            slotsToShow = 2;
            stage = 'No role - 2 slots: Free + 2 invite locked';
        } else if (hasRole2 && !hasRole5) {
            slotsToShow = 3;
            stage = 'Slot 2 access (2 invites) - 3 slots: 2 access + 3rd 5 invite locked';
        } else if (hasRole5 && !hasBoost1) {
            slotsToShow = 4;
            stage = 'Slot 3 access (5 invites) - 4 slots: 3 access + 4th 10 inv OR 1 boost locked';
        } else if (hasBoost1 && !hasBoost2) {
            slotsToShow = 5;
            stage = 'Slot 4 access (10 inv OR 1 boost) - 5 slots: 4 access + 5th 2 boosts locked';
        } else if (hasBoost2) {
            slotsToShow = 5;
            stage = 'Slot 5 access (2 boosts) - Full 5 slots!';
        }

        const slots = [];
        for (let i = 1; i <= slotsToShow; i++) {
            let can = false;
            let reason = '';
            let needRoleId = '';

            if (i === 1) {
                can = true;
                reason = 'Free - No role needed';
            } else if (i === 2) {
                can = hasRole2;
                needRoleId = roles.ROLE_2_INVITES || '';
                reason = hasRole2 ? '2 invites done - Role 1 unlocked' : `Need Role 1: 2 invites${needRoleId ? ` - <@&${needRoleId}>` : ''} - You have ${invites}/2`;
            } else if (i === 3) {
                can = hasRole5;
                needRoleId = roles.ROLE_5_INVITES || '';
                reason = hasRole5 ? '5 invites done - Role 2 unlocked' : `Need Role 2: 5 invites${needRoleId ? ` - <@&${needRoleId}>` : ''} - You have ${invites}/5`;
            } else if (i === 4) {
                can = hasBoost1;
                needRoleId = roles.ROLE_1_BOOST || '';
                reason = hasBoost1 ? '10 invites OR 1 boost done - Role 3 unlocked - 1 Boost = Slots 1-4 unlock!' : `Need Role 3: 10 invites OR 1 Boost${needRoleId ? ` - <@&${needRoleId}>` : ''} - You have ${invites}/10 invites, ${boosts}/1 boost - Do either one!`;
            } else if (i === 5) {
                can = hasBoost2;
                needRoleId = roles.ROLE_2_BOOST || '';
                reason = hasBoost2 ? '2 boosts done - Role 4 - Full access! - 2 Boost = Slots 1-5 unlock!' : `Need Role 4: 2 boosts${needRoleId ? ` - <@&${needRoleId}>` : ''} - 2 boosts required - You have ${boosts}/2`;
            }

            slots.push({
                slot: i,
                ...SLOTS[i],
                can,
                reason,
                needRoleId,
                currentInvites: invites,
                currentBoosts: boosts,
            });
        }

        return { slots, invites, boosts, slotsToShow, stage, hasRole2, hasRole5, hasBoost1, hasBoost2, roles };
    } catch (err) {
        console.error("getProgressiveSlots error:", err.message);
        return { slots: [{ slot: 1, ...SLOTS[1], can: true, reason: 'Free', needRoleId: '', currentInvites: 0, currentBoosts: 0 }], invites: 0, boosts: 0, slotsToShow: 2, stage: 'Error - 2 slots only', hasRole2: false, hasRole5: false, hasBoost1: false, hasBoost2: false, roles: getRoles() };
    }
}

export async function getMaxVisibleSlots(guild, userId) {
    try {
        if (!guild) return 2;
        const member = await guild.members.fetch(userId).catch(()=>null);
        if (!member) return 2;
        const roles = getRoles(guild.id);
        let max = 2;
        if (roles.ROLE_2_INVITES && member.roles.cache.has(roles.ROLE_2_INVITES)) max = 3;
        if (roles.ROLE_5_INVITES && member.roles.cache.has(roles.ROLE_5_INVITES)) max = 4;
        if (roles.ROLE_1_BOOST && member.roles.cache.has(roles.ROLE_1_BOOST)) max = 5;
        if (roles.ROLE_2_BOOST && member.roles.cache.has(roles.ROLE_2_BOOST)) max = 5;
        
        const { invites, boosts } = getCounts(member, 0);
        if (invites >= 2) max = Math.max(max, 3);
        if (invites >= 5) max = Math.max(max, 4);
        if (invites >= 10 || boosts >= 1) max = Math.max(max, 5);
        return max;
    } catch { return 2; }
}
