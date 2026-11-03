/**
 * slotSystem.js - Strict Step-by-Step Progressive Slot Unlock System (FIXED FOR ALL 6 SLOTS)
 * Location: src/quest/slotSystem.js
 */

import { getRoles } from './roleStore.js';
import { getUserInvites } from '../handlers/inviteTracker.js';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const userTrialSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    claimedTrial: { type: Boolean, default: false },
    active: { type: Boolean, default: false },
    expiresAt: { type: Number, default: null },
    type: { type: String, default: 'trial' },
    slot: { type: Number, default: 1 }
});
const UserTrial = mongoose.models.UserTrial || mongoose.model('UserTrial', userTrialSchema);

const filePath = path.join(__dirname, '../../data/trialKeys.json');

async function loadUserData(userId) {
    try {
        const mongoUser = await UserTrial.findOne({ userId });
        if (mongoUser) {
            return {
                claimedTrial: mongoUser.claimedTrial,
                active: mongoUser.active,
                expiresAt: mongoUser.expiresAt,
                type: mongoUser.type,
                slot: mongoUser.slot || 1
            };
        }
    } catch (err) {}

    if (!fs.existsSync(filePath)) return null;
    try {
        const db = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return db.users?.[userId] || null;
    } catch {
        return null;
    }
}

export const SLOTS = {
    1: { label: 'Free Slot', need: 'Free', invites: 0, boosts: 0 },
    2: { label: 'Slot 2 (2 Invites)', need: '2 Invites', invites: 2, boosts: 0 },
    3: { label: 'Slot 3 (5 Invites)', need: '5 Invites', invites: 5, boosts: 0 },
    4: { label: 'Slot 4 (10 Invites)', need: '10 Invites', invites: 10, boosts: 0 },
    5: { label: 'Slot 5 (15 Inv / 1 Boost)', need: '1 Boost or 15 Invites', invites: 15, boosts: 1 },
    6: { label: 'Slot 6 (2 Boosts)', need: '2 Boosts', invites: 0, boosts: 2 },
};

export async function getCounts(member) {
    try {
        if (!member || !member.guild) return { invites: 0, boosts: 0 };

        const guildId = member.guild.id;
        const userId = member.id;

        let invites = 0;
        try {
            invites = await getUserInvites(userId, guildId) || 0;
        } catch {
            invites = 0;
        }

        let boosts = 0;
        const roles = getRoles(guildId) || {};
        
        if (member.premiumSince) boosts = Math.max(boosts, 1);
        if (roles.ROLE_1_BOOST && member.roles.cache.has(roles.ROLE_1_BOOST)) boosts = Math.max(boosts, 1);
        if (roles.ROLE_2_BOOST && member.roles.cache.has(roles.ROLE_2_BOOST)) boosts = Math.max(boosts, 2);

        return { invites, boosts };
    } catch (err) {
        return { invites: 0, boosts: 0 };
    }
}

export async function getProgressiveSlots(member) {
    try {
        if (!member) {
            return {
                slots: Array.from({ length: 6 }, (_, i) => ({
                    slot: i + 1,
                    ...SLOTS[i + 1],
                    can: i === 0,
                    reason: i === 0 ? 'Base Slot' : 'Requires Guild Access'
                })),
                invites: 0,
                boosts: 0,
                slotsToShow: 6,
                isTrialActive: false,
                userProfile: null
            };
        }

        const guildId = member?.guild?.id || 'global';
        const userId = member?.id;
        const roles = getRoles(guildId) || {};
        const userData = await loadUserData(userId);

        const { invites, boosts } = await getCounts(member);

        const userProfile = {
            id: member.user.id,
            username: member.user.username,
            avatar: member.user.displayAvatarURL({ extension: 'png', size: 256 }),
            createdTimestamp: member.user.createdTimestamp
        };

        // Milestone Checks
        const hasRole2 = invites >= 2 || (roles.ROLE_2_INVITES && member.roles.cache.has(roles.ROLE_2_INVITES)) || (roles.ROLE_SLOT_2 && member.roles.cache.has(roles.ROLE_SLOT_2));
        const hasRole5 = invites >= 5 || (roles.ROLE_5_INVITES && member.roles.cache.has(roles.ROLE_5_INVITES)) || (roles.ROLE_SLOT_3 && member.roles.cache.has(roles.ROLE_SLOT_3));
        const hasRole10 = invites >= 10 || (roles.ROLE_10_INVITES && member.roles.cache.has(roles.ROLE_10_INVITES)) || (roles.ROLE_SLOT_4 && member.roles.cache.has(roles.ROLE_SLOT_4));
        const hasBoost1 = invites >= 15 || boosts >= 1 || (roles.ROLE_1_BOOST && member.roles.cache.has(roles.ROLE_1_BOOST)) || (roles.ROLE_SLOT_5 && member.roles.cache.has(roles.ROLE_SLOT_5));
        const hasBoost2 = boosts >= 2 || (roles.ROLE_2_BOOST && member.roles.cache.has(roles.ROLE_2_BOOST)) || (roles.ROLE_SLOT_6 && member.roles.cache.has(roles.ROLE_SLOT_6));

        const hasHigherTier = hasRole2 || hasRole5 || hasRole10 || hasBoost1 || hasBoost2;
        const isTrialActive = userData && userData.active && (userData.expiresAt === null || userData.expiresAt > Date.now()) && !hasHigherTier;

        // RULE 1: Trial User logic
        if (isTrialActive) {
            const unlockedSlot = userData.slot || 1;
            const slots = Array.from({ length: 6 }, (_, i) => {
                const sNum = i + 1;
                const isUnlocked = sNum <= unlockedSlot;
                return {
                    slot: sNum,
                    ...SLOTS[sNum],
                    can: isUnlocked,
                    reason: isUnlocked ? `Trial Active (Slot #${sNum} Unlocked)` : 'Locked (Requires Higher Tier)'
                };
            });

            return {
                slots,
                invites,
                boosts,
                slotsToShow: 6,
                isTrialActive: true,
                alreadyClaimed: true,
                userProfile
            };
        }

        // RULE 2: Calculate max unlocked slots
        let unlockedCount = 1; 
        if (hasRole2) unlockedCount = 2;
        if (hasRole5) unlockedCount = 3;
        if (hasRole10) unlockedCount = 4;
        if (hasBoost1) unlockedCount = 5;
        if (hasBoost2) unlockedCount = 6;

        // Build all 6 slots with correct permission evaluation
        const slots = [
            {
                slot: 1,
                ...SLOTS[1],
                can: true,
                reason: 'Base free slot available for everyone.'
            },
            {
                slot: 2,
                ...SLOTS[2],
                can: unlockedCount >= 2,
                reason: unlockedCount >= 2 ? 'Unlocked via 2 Invites' : 'Requires 2 Invites'
            },
            {
                slot: 3,
                ...SLOTS[3],
                can: unlockedCount >= 3,
                reason: unlockedCount >= 3 ? 'Unlocked via 5 Invites' : 'Requires 5 Invites'
            },
            {
                slot: 4,
                ...SLOTS[4],
                can: unlockedCount >= 4,
                reason: unlockedCount >= 4 ? 'Unlocked via 10 Invites' : 'Requires 10 Invites'
            },
            {
                slot: 5,
                ...SLOTS[5],
                can: unlockedCount >= 5,
                reason: unlockedCount >= 5 ? 'Unlocked via 1 Boost or 15 Invites' : 'Requires 1 Boost or 15 Invites'
            },
            {
                slot: 6,
                ...SLOTS[6],
                can: unlockedCount >= 6,
                reason: unlockedCount >= 6 ? 'Unlocked via 2 Boosts' : 'Requires 2 Boosts'
            }
        ];

        return { 
            slots, 
            invites, 
            boosts, 
            slotsToShow: 6, 
            isTrialActive: false,
            alreadyClaimed: userData?.claimedTrial || false,
            userProfile
        };

    } catch (err) {
        console.error("getProgressiveSlots error:", err.message);
        return { 
            slots: Array.from({ length: 6 }, (_, i) => ({
                slot: i + 1,
                ...SLOTS[i + 1],
                can: i === 0,
                reason: i === 0 ? 'Fallback Base Slot' : 'System Fallback Locked'
            })), 
            invites: 0, 
            boosts: 0, 
            slotsToShow: 6, 
            isTrialActive: false,
            userProfile: null
        };
    }
}
