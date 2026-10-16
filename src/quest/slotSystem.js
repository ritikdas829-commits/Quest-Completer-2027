/**
 * slotSystem.js - 4 Roles Progressive - Multi Server - No Crash
 * Location: src/quest/slotSystem.js
 */

import { getRoles } from './roleStore.js';

export const SLOTS = {
    1: { label: 'Free Slot', need: 'Free', invites: 0, boosts: 0 },
    2: { label: '2 Invite Slot', need: '2 Invites', invites: 2, boosts: 0 },
    3: { label: '5 Invite Slot', need: '5 Invite per', invites: 5, boosts: 0 },
    4: { label: '1 Boost Slot', need: '1 Boost', invites: 0, boosts: 1 },
    5: { label: '2 Boost Slot', need: '2 Boosts', invites: 0, boosts: 2 },
};

export function getCounts(member, inviteStore) {
    try {
        let invites = 0;
        if (inviteStore && typeof inviteStore.get === 'function') {
            invites = inviteStore.get(member.id) || 0;
        } else if (inviteStore && inviteStore[member.id] !== undefined) {
            invites = inviteStore[member.id];
        } else {
            const roles = getRoles(member.guild?.id);
            if (roles.ROLE_5_INVITES && member.roles.cache.has(roles.ROLE_5_INVITES)) invites = 5;
            else if (roles.ROLE_2_INVITES && member.roles.cache.has(roles.ROLE_2_INVITES)) invites = 2;
        }

        let boosts = 0;
        const roles = getRoles(member.guild?.id);
        if (member.premiumSince) boosts = 1;
        if (roles.ROLE_1_BOOST && member.roles.cache.has(roles.ROLE_1_BOOST)) boosts = Math.max(boosts, 1);
        if (roles.ROLE_2_BOOST && member.roles.cache.has(roles.ROLE_2_BOOST)) boosts = 2;
        if (roles.ROLE_1_BOOST && member.premiumSince && member.roles.cache.has(roles.ROLE_1_BOOST)) boosts = 2;

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
        const hasBoost1 = roles.ROLE_1_BOOST ? member.roles.cache.has(roles.ROLE_1_BOOST) || boosts >= 1 || Boolean(member.premiumSince) : boosts >= 1 || Boolean(member.premiumSince);
        const hasBoost2 = roles.ROLE_2_BOOST ? member.roles.cache.has(roles.ROLE_2_BOOST) || boosts >= 2 : boosts >= 2;

        let slotsToShow = 2;
        let stage = '';

        if (!hasRole2) {
            slotsToShow = 2;
            stage = 'No role - 2 slots: Free + 2 invite';
        } else if (hasRole2 && !hasRole5) {
            slotsToShow = 3;
            stage = 'Invite access (2) - 3 slots: 2 access + 3rd 5 invite per';
        } else if (hasRole5 && !hasBoost1) {
            slotsToShow = 4;
            stage = '3 slot access (5) - 4 slots visible - Say boost';
        } else if (hasBoost1 && !hasBoost2) {
            slotsToShow = 5;
            stage = '1 boost - 5 slots visible - 5th needs 2 boosts';
        } else if (hasBoost2) {
            slotsToShow = 5;
            stage = '2 boosts - Full 5 slots access!';
        }

        const slots = [];
        for (let i = 1; i <= slotsToShow; i++) {
            let can = false;
            let reason = '';
            let needRoleId = '';

            if (i === 1) {
                can = true;
                reason = 'Free - No role';
            } else if (i === 2) {
                can = hasRole2;
                needRoleId = roles.ROLE_2_INVITES || '';
                reason = hasRole2 ? '2 invites done - Role 1' : `Need Role 1: 2 invites${needRoleId ? ` - <@&${needRoleId}>` : ''} - You have ${invites}`;
            } else if (i === 3) {
                can = hasRole5;
                needRoleId = roles.ROLE_5_INVITES || '';
                reason = hasRole5 ? '5 invites done - Role 2' : `Need Role 2: 5 invite per${needRoleId ? ` - <@&${needRoleId}>` : ''} - You have ${invites}`;
            } else if (i === 4) {
                can = hasBoost1;
                needRoleId = roles.ROLE_1_BOOST || '';
                reason = hasBoost1 ? '1 boost done - Role 3' : `Need Role 3: 1 boost${needRoleId ? ` - <@&${needRoleId}>` : ''} - Say boost - You have ${boosts}`;
            } else if (i === 5) {
                can = hasBoost2;
                needRoleId = roles.ROLE_2_BOOST || '';
                reason = hasBoost2 ? '2 boosts done - Role 4 - Full' : `Need Role 4: 2 boosts${needRoleId ? ` - <@&${needRoleId}>` : ''} - 2 boosts required - You have ${boosts}`;
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
        return { slots: [{ slot: 1, ...SLOTS[1], can: true, reason: 'Free', needRoleId: '', currentInvites: 0, currentBoosts: 0 }], invites: 0, boosts: 0, slotsToShow: 1, stage: 'Error - Free slot only', hasRole2: false, hasRole5: false, hasBoost1: false, hasBoost2: false, roles: getRoles() };
    }
}
