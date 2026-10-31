/**
 * slotSystem.js - Clean 6-Slot Progressive Engine & Dynamic Unlock System
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
    1: { label: 'Free Slot (Base)', need: 'Free', invites: 0, boosts: 0 },
    2: { label: '2 Invite Slot', need: '2 Invites', invites: 2, boosts: 0 },
    3: { label: '5 Invite Slot', need: '5 Invites', invites: 5, boosts: 0 },
    4: { label: '10 Invite Slot', need: '10 Invites', invites: 10, boosts: 0 },
    5: { label: '15 Invite OR 1 Boost Slot', need: '15 Invites or 1 Boost', invites: 15, boosts: 1 },
    6: { label: '2 Boost Slot', need: '2 Boosts', invites: 0, boosts: 2 },
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
                slotsToShow: 6,
                isTrialActive: false,
                userProfile: null
            };
        }

        const guildId = member?.guild?.id || 'global';
        const userId = member?.id;
        const roles = getRoles(guildId);
        const userData = await loadUserData(userId);

        const { invites, boosts } = await getCounts(member);

        const userProfile = {
            id: member.user.id,
            username: member.user.username,
            avatar: member.user.displayAvatarURL({ extension: 'png', size: 256 }),
            createdTimestamp: member.user.createdTimestamp
        };

        // Precise Independent Tier Unlocks
        const hasSlot1 = true;
        const hasSlot2 = invites >= 2 || (roles.ROLE_SLOT_2 && member.roles.cache.has(roles.ROLE_SLOT_2));
        const hasSlot3 = invites >= 5 || (roles.ROLE_SLOT_3 && member.roles.cache.has(roles.ROLE_SLOT_3));
        const hasSlot4 = invites >= 10 || (roles.ROLE_SLOT_4 && member.roles.cache.has(roles.ROLE_SLOT_4));
        const hasSlot5 = invites >= 15 || boosts >= 1 || (roles.ROLE_1_BOOST && member.roles.cache.has(roles.ROLE_1_BOOST));
        const hasSlot6 = boosts >= 2 || (roles.ROLE_2_BOOST && member.roles.cache.has(roles.ROLE_2_BOOST));

        // Auto Role Revocation Check if Requirements Drop
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
            console.error("Role Sync Error:", e.message);
        }

        const isTrialActive = userData && userData.active && (userData.expiresAt === null || userData.expiresAt > Date.now());

        // Build All 6 Slots Dynamically Without Drop-offs
        const slots = [
            {
                slot: 1,
                label: 'Free Base Slot',
                can: true,
                need: 'Free',
                reason: 'Unlocked for all users'
            },
            {
                slot: 2,
                label: 'Slot 2 (2 Invites)',
                can: hasSlot2,
                need: '2 Invites Required',
                reason: hasSlot2 ? 'Unlocked via 2 Invites' : 'Requires 2 valid invites'
            },
            {
                slot: 3,
                label: 'Slot 3 (5 Invites)',
                can: hasSlot3,
                need: '5 Invites Required',
                reason: hasSlot3 ? 'Unlocked via 5 Invites' : 'Requires 5 valid invites'
            },
            {
                slot: 4,
                label: 'Slot 4 (10 Invites)',
                can: hasSlot4,
                need: '10 Invites Required',
                reason: hasSlot4 ? 'Unlocked via 10 Invites' : 'Requires 10 valid invites'
            },
            {
                slot: 5,
                label: 'Slot 5 (15 Inv / 1 Boost)',
                can: hasSlot5,
                need: '15 Invites or 1 Boost Required',
                reason: hasSlot5 ? 'Unlocked via 15 Invites / 1 Boost' : 'Requires 15 Invites or 1 Boost'
            },
            {
                slot: 6,
                label: 'Slot 6 (2 Boosts)',
                can: hasSlot6,
                need: '2 Boosts Required',
                reason: hasSlot6 ? 'Unlocked via 2 Server Boosts' : 'Requires 2 Server Boosts'
            }
        ];

        return { 
            slots, 
            invites, 
            boosts, 
            slotsToShow: slots.length, 
            isTrialActive,
            alreadyClaimed: userData?.claimedTrial || false,
            userProfile
        };

    } catch (err) {
        console.error("getProgressiveSlots Error:", err.message);
        return { 
            slots: [{ slot: 1, ...SLOTS[1], can: true, reason: 'Fallback Base Slot' }], 
            invites: 0, 
            boosts: 0, 
            slotsToShow: 1, 
            isTrialActive: false,
            userProfile: null
        };
    }
}
