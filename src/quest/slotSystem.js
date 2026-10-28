/**
 * slotSystem.js - Trial & Progressive Post-Trial Slot Management
 * Location: src/quest/slotSystem.js
 */

import { getRoles } from './roleStore.js';
import { getUserInvites } from '../handlers/inviteTracker.js';
import fs from 'fs';
import path from 'path';

const filePath = path.resolve('data/trialKeys.json');

function loadUserData(userId) {
    if (!fs.existsSync(filePath)) return null;
    try {
        const db = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return db.users?.[userId] || null;
    } catch {
        return null;
    }
}

export const SLOTS = {
    1: { label: 'Trial / Free Slot', need: 'Trial Active or Free', invites: 0, boosts: 0 },
    2: { label: '2 Invite Slot', need: '2 Invites', invites: 2, boosts: 0 },
    3: { label: '5 Invite Slot', need: '5 Invites', invites: 5, boosts: 0 },
    4: { label: '15 Invite OR 1 Boost Slot', need: '15 Invites OR 1 Boost', invites: 15, boosts: 1 },
    5: { label: '2 Boost Slot', need: '2 Boosts', invites: 0, boosts: 2 },
};

export async function getCounts(member) {
    try {
        if (!member || !member.guild) return { invites: 0, boosts: 0 };

        const guildId = member.guild.id;
        const userId = member.id;

        let invites = await getUserInvites(userId, guildId);
        let boosts = 0;
        const roles = getRoles(guildId);
        
        if (member.premiumSince) boosts = 1;
        if (roles.ROLE_1_BOOST && member.roles.cache.has(roles.ROLE_1_BOOST)) boosts = Math.max(boosts, 1);
        if (roles.ROLE_2_BOOST && member.roles.cache.has(roles.ROLE_2_BOOST)) boosts = 2;

        return { invites, boosts };
    } catch (err) {
        console.error("getCounts error:", err.message);
        return { invites: 0, boosts: 0 };
    }
}

export async function getProgressiveSlots(member) {
    try {
        const guildId = member?.guild?.id || 'global';
        const userId = member?.id;
        const roles = getRoles(guildId);
        const userData = loadUserData(userId);

        // Check if user's 30-day trial is currently active
        const isTrialActive = userData && userData.active && (userData.expiresAt === null || userData.expiresAt > Date.now());

        const { invites, boosts } = await getCounts(member);

        // 🛑 RULE: Agar Trial Active hai, toh sirf 1 Slot dikhega!
        if (isTrialActive) {
            return {
                slots: [{
                    slot: 1,
                    ...SLOTS[1],
                    can: true,
                    reason: 'Active 30-Day Trial (Slot #1 Unlocked)',
                    needRoleId: '',
                    currentInvites: invites,
                    currentBoosts: boosts,
                }],
                invites,
                boosts,
                slotsToShow: 1,
                isTrialActive: true
            };
        }

        // 🚀 Trial Expired / Normal Progressive System (Invites & Boosts rules)
        const hasRole2 = invites >= 2;
        const hasRole5 = invites >= 5;
        const hasBoost1 = invites >= 15 || boosts >= 1; // 15 invites OR 1 Boost unlocks Slot 4
        const hasBoost2 = boosts >= 2;                 // 2 Boosts unlocks Slot 5

        let unlockedCount = 1;
        if (hasRole2) unlockedCount = 2;
        if (hasRole5) unlockedCount = 3;
        if (hasBoost1) unlockedCount = 4;
        if (hasBoost2) unlockedCount = 5;

        const slotsToShow = Math.min(5, unlockedCount + (unlockedCount < 5 ? 1 : 0));

        const slots = [];
        for (let i = 1; i <= slotsToShow; i++) {
            let can = false;
            let reason = '';

            if (i === 1) {
                can = true;
                reason = 'Free Slot Unlocked';
            } else if (i === 2) {
                can = hasRole2;
                reason = hasRole2 ? 'Unlocked (2 Invites)' : `Need 2 Invites (You have ${invites}/2)`;
            } else if (i === 3) {
                can = hasRole5;
                reason = hasRole5 ? 'Unlocked (5 Invites)' : `Need 5 Invites (You have ${invites}/5)`;
            } else if (i === 4) {
                can = hasBoost1;
                reason = hasBoost1 ? 'Unlocked (15 Invites or 1 Boost)' : `Need 15 Invites or 1 Boost (You have ${invites}/15 invites, ${boosts}/1 boost)`;
            } else if (i === 5) {
                can = hasBoost2;
                reason = hasBoost2 ? 'Unlocked (2 Boosts - Full Access)' : `Need 2 Boosts (You have ${boosts}/2 boosts)`;
            }

            slots.push({
                slot: i,
                ...SLOTS[i],
                can,
                reason,
                currentInvites: invites,
                currentBoosts: boosts,
            });
        }

        return { slots, invites, boosts, slotsToShow, isTrialActive: false };
    } catch (err) {
        console.error("getProgressiveSlots error:", err.message);
        return { 
            slots: [{ slot: 1, ...SLOTS[1], can: true, reason: 'Free', currentInvites: 0, currentBoosts: 0 }], 
            invites: 0, boosts: 0, slotsToShow: 1, isTrialActive: false 
        };
    }
}
