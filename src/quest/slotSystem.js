/**
 * slotSystem.js - Strict Trial Only Slot #1 & Dynamic Role Progression
 * Location: src/quest/slotSystem.js
 */

import { getRoles } from './roleStore.js';
import { getUserInvites } from '../handlers/inviteTracker.js';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

const userTrialSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    claimedTrial: { type: Boolean, default: false },
    active: { type: Boolean, default: false },
    expiresAt: { type: Number, default: null }
});
const UserTrial = mongoose.models.UserTrial || mongoose.model('UserTrial', userTrialSchema);

const filePath = path.resolve('data/trialKeys.json');

async function loadUserData(userId) {
    try {
        const mongoUser = await UserTrial.findOne({ userId });
        if (mongoUser) {
            return {
                claimedTrial: mongoUser.claimedTrial,
                active: mongoUser.active,
                expiresAt: mongoUser.expiresAt
            };
        }
    } catch (err) {
        // Fallback to JSON
    }

    if (!fs.existsSync(filePath)) return null;
    try {
        const db = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return db.users?.[userId] || null;
    } catch {
        return null;
    }
}

export const SLOTS = {
    1: { label: 'Trial Slot', need: 'Trial Active Only', invites: 0, boosts: 0 },
    2: { label: '2 Invite Slot', need: '2 Invites Required', invites: 2, boosts: 0 },
    3: { label: '5 Invite Slot', need: '5 Invites Required', invites: 5, boosts: 0 },
    4: { label: '10 Invite Slot', need: '10 Invites Required', invites: 10, boosts: 0 },
    5: { label: '15 Invite OR 1 Boost Slot', need: '15 Invites or 1 Boost Required', invites: 15, boosts: 1 },
    6: { label: '2 Boost Slot', need: '2 Boosts Required', invites: 0, boosts: 2 },
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
        const userData = await loadUserData(userId);

        const { invites, boosts } = await getCounts(member);

        // Dynamic Role Checks
        const hasRole2 = invites >= 2 || (roles.ROLE_SLOT_2 && member.roles.cache.has(roles.ROLE_SLOT_2));
        const hasRole5 = invites >= 5 || (roles.ROLE_SLOT_3 && member.roles.cache.has(roles.ROLE_SLOT_3));
        const hasRole10 = invites >= 10 || (roles.ROLE_SLOT_4 && member.roles.cache.has(roles.ROLE_SLOT_4));
        const hasBoost1 = invites >= 15 || boosts >= 1 || (roles.ROLE_1_BOOST && member.roles.cache.has(roles.ROLE_1_BOOST));
        const hasBoost2 = boosts >= 2 || (roles.ROLE_2_BOOST && member.roles.cache.has(roles.ROLE_2_BOOST));

        const hasHigherTier = hasRole2 || hasRole5 || hasRole10 || hasBoost1 || hasBoost2;

        // 🔄 AUTO-STRIP TRIAL ROLE IF HIGHER TIER ACQUIRED
        if (hasHigherTier && roles.ROLE_TRIAL && member.roles.cache.has(roles.ROLE_TRIAL)) {
            try {
                await member.roles.remove(roles.ROLE_TRIAL);
            } catch (e) {
                console.error("Failed to strip trial role:", e.message);
            }
        }

        // Check if user has active trial AND no higher roles
        const isTrialActive = userData && userData.active && (userData.expiresAt === null || userData.expiresAt > Date.now()) && !hasHigherTier;

        // 🛑 RULE 1: STRICTLY TRIAL USER - ONLY 1 SLOT SHOW
        if (isTrialActive) {
            return {
                slots: [{
                    slot: 1,
                    ...SLOTS[1],
                    can: true,
                    reason: 'Trial Active (Slot #1 Unlocked)',
                    needRoleId: roles.ROLE_TRIAL || '',
                    currentInvites: invites,
                    currentBoosts: boosts,
                }],
                invites,
                boosts,
                slotsToShow: 1,
                isTrialActive: true,
                alreadyClaimed: true
            };
        }

        // 🚀 RULE 2: NON-TRIAL / UPGRADED PROGRESSIVE SLOTS (Slot 1 Trial Hata Ke)
        let unlockedCount = 0;
        if (hasRole2) unlockedCount = 2;
        if (hasRole5) unlockedCount = 3;
        if (hasRole10) unlockedCount = 4;
        if (hasBoost1) unlockedCount = 5;
        if (hasBoost2) unlockedCount = 6;

        const slots = [];

        // Dynamic unlocking logic based on Invites & Boosts
        if (unlockedCount >= 2) {
            slots.push({ slot: 1, label: 'Slot 1 (2 Invites)', can: true, reason: 'Unlocked via 2 Invites Role' });
            slots.push({ slot: 2, label: 'Slot 2 (2 Invites)', can: true, reason: 'Unlocked via 2 Invites Role' });
        }
        if (unlockedCount >= 3) slots.push({ slot: 3, label: 'Slot 3 (5 Invites)', can: true, reason: 'Unlocked via 5 Invites Role' });
        if (unlockedCount >= 4) slots.push({ slot: 4, label: 'Slot 4 (10 Invites)', can: true, reason: 'Unlocked via 10 Invites Role' });
        if (unlockedCount >= 5) slots.push({ slot: 5, label: 'Slot 5 (15 Invites / 1 Boost)', can: true, reason: 'Unlocked via 1 Boost Role' });
        if (unlockedCount >= 6) slots.push({ slot: 6, label: 'Slot 6 (2 Boosts)', can: true, reason: 'Unlocked via 2 Boost Role' });

        // If user has 0 slots unlocked and no trial
        if (slots.length === 0) {
            slots.push({
                slot: 1,
                label: 'Locked Slot',
                can: false,
                reason: 'Need 2 Invites to unlock your first slot (No Active Trial)',
                currentInvites: invites,
                currentBoosts: boosts
            });
        }

        return { 
            slots, 
            invites, 
            boosts, 
            slotsToShow: slots.length, 
            isTrialActive: false,
            alreadyClaimed: userData?.claimedTrial || false 
        };

    } catch (err) {
        console.error("getProgressiveSlots error:", err.message);
        return { 
            slots: [{ slot: 1, ...SLOTS[1], can: false, reason: 'Error loading slots', currentInvites: 0, currentBoosts: 0 }], 
            invites: 0, boosts: 0, slotsToShow: 1, isTrialActive: false 
        };
    }
}
