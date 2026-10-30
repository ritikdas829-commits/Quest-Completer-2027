/**
 * slotSystem.js - Strict Trial Only Slot #1 & Dynamic Role Progression (Fixed)
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
        // Fallback to local JSON storage
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
    1: { label: 'Free Slot (Trial / Base)', need: 'Free', invites: 0, boosts: 0 },
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

        let invites = 0;
        try {
            invites = await getUserInvites(userId, guildId);
        } catch {
            invites = 0;
        }

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
        if (!member) {
            return {
                slots: [],
                invites: 0,
                boosts: 0,
                slotsToShow: 1,
                isTrialActive: false,
                userProfile: null
            };
        }

        const guildId = member?.guild?.id || 'global';
        const userId = member?.id;
        const roles = getRoles(guildId);
        const userData = await loadUserData(userId);

        const { invites, boosts } = await getCounts(member);

        // Profile details for rendering in UI
        const userProfile = {
            id: member.user.id,
            username: member.user.username,
            avatar: member.user.displayAvatarURL({ extension: 'png', size: 256 }),
            createdTimestamp: member.user.createdTimestamp
        };

        // Dynamic Slot Role Checks (Invites / Boosts based)
        const hasRole2 = invites >= 2 || (roles.ROLE_SLOT_2 && member.roles.cache.has(roles.ROLE_SLOT_2));
        const hasRole5 = invites >= 5 || (roles.ROLE_SLOT_3 && member.roles.cache.has(roles.ROLE_SLOT_3));
        const hasRole10 = invites >= 10 || (roles.ROLE_SLOT_4 && member.roles.cache.has(roles.ROLE_SLOT_4));
        const hasBoost1 = invites >= 15 || boosts >= 1 || (roles.ROLE_1_BOOST && member.roles.cache.has(roles.ROLE_1_BOOST));
        const hasBoost2 = boosts >= 2 || (roles.ROLE_2_BOOST && member.roles.cache.has(roles.ROLE_2_BOOST));

        const hasHigherTier = hasRole2 || hasRole5 || hasRole10 || hasBoost1 || hasBoost2;

        // 🛡️ FIXED: NEVER touch key-based Trial role here. 
        // Only manage/strip slot-based roles if requirements are no longer met.
        try {
            if (roles.ROLE_SLOT_2 && member.roles.cache.has(roles.ROLE_SLOT_2) && invites < 2) {
                await member.roles.remove(roles.ROLE_SLOT_2).catch(() => {});
            }
            if (roles.ROLE_SLOT_3 && member.roles.cache.has(roles.ROLE_SLOT_3) && invites < 5) {
                await member.roles.remove(roles.ROLE_SLOT_3).catch(() => {});
            }
            if (roles.ROLE_SLOT_4 && member.roles.cache.has(roles.ROLE_SLOT_4) && invites < 10) {
                await member.roles.remove(roles.ROLE_SLOT_4).catch(() => {});
            }
            if (roles.ROLE_1_BOOST && member.roles.cache.has(roles.ROLE_1_BOOST) && boosts < 1 && invites < 15) {
                await member.roles.remove(roles.ROLE_1_BOOST).catch(() => {});
            }
            if (roles.ROLE_2_BOOST && member.roles.cache.has(roles.ROLE_2_BOOST) && boosts < 2) {
                await member.roles.remove(roles.ROLE_2_BOOST).catch(() => {});
            }
        } catch (e) {
            console.error("Failed to manage slot roles:", e.message);
        }

        // Check if user has active trial AND no higher slot roles
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
                alreadyClaimed: true,
                userProfile
            };
        }

        // 🚀 RULE 2: NON-TRIAL / UPGRADED PROGRESSIVE SLOTS
        let unlockedCount = 0;
        if (hasRole2) unlockedCount = 2;
        if (hasRole5) unlockedCount = 3;
        if (hasRole10) unlockedCount = 4;
        if (hasBoost1) unlockedCount = 5;
        if (hasBoost2) unlockedCount = 6;

        const slots = [];

        // Always push Slot #1 as Free Slot
        slots.push({
            slot: 1,
            label: 'Free Slot',
            can: true,
            need: 'Free',
            reason: 'Base free slot available for everyone.'
        });

        // Dynamic unlocking logic based on Invites & Boosts
        if (unlockedCount >= 2) {
            slots.push({ slot: 2, label: 'Slot 2 (2 Invites)', can: true, need: '2 Invites', reason: 'Unlocked via 2 Invites Role' });
        } else {
            slots.push({ slot: 2, label: 'Slot 2 (2 Invites)', can: false, need: '2 Invites', reason: 'Requires 2 Invites or Role' });
        }

        if (unlockedCount >= 3) {
            slots.push({ slot: 3, label: 'Slot 3 (5 Invites)', can: true, need: '5 Invites', reason: 'Unlocked via 5 Invites Role' });
        } else if (unlockedCount >= 2) {
            slots.push({ slot: 3, label: 'Slot 3 (5 Invites)', can: false, need: '5 Invites', reason: 'Requires 5 Invites' });
        }

        if (unlockedCount >= 4) {
            slots.push({ slot: 4, label: 'Slot 4 (10 Invites)', can: true, need: '10 Invites', reason: 'Unlocked via 10 Invites Role' });
        } else if (unlockedCount >= 3) {
            slots.push({ slot: 4, label: 'Slot 4 (10 Invites)', can: false, need: '10 Invites', reason: 'Requires 10 Invites' });
        }

        if (unlockedCount >= 5) {
            slots.push({ slot: 5, label: 'Slot 5 (15 Inv / 1 Boost)', can: true, need: '1 Boost or 15 Invites', reason: 'Unlocked via 1 Boost Role' });
        } else if (unlockedCount >= 4) {
            slots.push({ slot: 5, label: 'Slot 5 (15 Inv / 1 Boost)', can: false, need: '1 Boost or 15 Invites', reason: 'Requires 1 Boost or 15 Invites' });
        }

        if (unlockedCount >= 6) {
            slots.push({ slot: 6, label: 'Slot 6 (2 Boosts)', can: true, need: '2 Boosts', reason: 'Unlocked via 2 Boost Role' });
        } else if (unlockedCount >= 5) {
            slots.push({ slot: 6, label: 'Slot 6 (2 Boosts)', can: false, need: '2 Boosts', reason: 'Requires 2 Boosts' });
        }

        return { 
            slots, 
            invites, 
            boosts, 
            slotsToShow: slots.length, 
            isTrial/false,
            isTrialActive: false,
            alreadyClaimed: userData?.claimedTrial || false,
            userProfile
        };

    } catch (err) {
        console.error("getProgressiveSlots error:", err.message);
        return { 
            slots: [{ slot: 1, ...SLOTS[1], can: false, reason: 'Error loading slots', currentInvites: 0, currentBoosts: 0 }], 
            invites: 0, 
            boosts: 0, 
            slotsToShow: 1, 
            isTrialActive: false,
            userProfile: null
        };
    }
}
