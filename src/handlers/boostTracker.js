/**
 * boostTracker.js - Precise Boost Role Management - Multi Server - No Crash
 * Location: src/handlers/boostTracker.js
 */

import { getRoles } from '../quest/roleStore.js';
import { syncUserSlotsAndRoles } from '../quest/slotSyncEngine.js';

function getBoostRoles(guild) {
    try {
        const stored = getRoles(guild.id);
        const roles = {};
        if (stored?.ROLE_1_BOOST) {
            const r = guild.roles.cache.get(stored.ROLE_1_BOOST);
            if (r) roles.ROLE_1_BOOST = r;
        }
        if (stored?.ROLE_2_BOOST) {
            const r = guild.roles.cache.get(stored.ROLE_2_BOOST);
            if (r) roles.ROLE_2_BOOST = r;
        }
        return roles;
    } catch {
        return {};
    }
}

/**
 * Accurately determines user boost level without misassigning dual boost roles
 */
function getBoostCount(member) {
    try {
        if (!member) return 0;

        const isBoosting = Boolean(member.premiumSince);
        if (!isBoosting) return 0;

        const roles = getRoles(member.guild?.id);
        
        // If user explicitly has 2 Boost role already assigned manually/by bot
        if (roles?.ROLE_2_BOOST && member.roles.cache.has(roles.ROLE_2_BOOST)) {
            return 2;
        }

        // Default active boost count for a single server booster
        return 1;
    } catch {
        return 0;
    }
}

async function sendSafeDM(member, message) {
    try { 
        await member.send(message); 
    } catch {}
}

export async function handleBoostAdd(member) {
    if (!member || member.user.bot) return;
    try {
        const guild = member.guild;
        const boostRoles = getBoostRoles(guild);
        const boosts = getBoostCount(member);

        // 🟢 Exactly 1 Boost Case
        if (boosts === 1 && boostRoles.ROLE_1_BOOST) {
            // Remove 2 Boost role if mistakenly assigned
            if (boostRoles.ROLE_2_BOOST && member.roles.cache.has(boostRoles.ROLE_2_BOOST.id)) {
                await member.roles.remove(boostRoles.ROLE_2_BOOST).catch(() => {});
            }

            if (!member.roles.cache.has(boostRoles.ROLE_1_BOOST.id)) {
                await member.roles.add(boostRoles.ROLE_1_BOOST).catch(() => {});
                await sendSafeDM(member, `💎 Thank you for boosting ${guild.name}! **${boostRoles.ROLE_1_BOOST.name}** unlocked.`);
            }
        }

        // 👑 2 Boost Case
        if (boosts >= 2 && boostRoles.ROLE_2_BOOST) {
            if (!member.roles.cache.has(boostRoles.ROLE_2_BOOST.id)) {
                await member.roles.add(boostRoles.ROLE_2_BOOST).catch(() => {});
                await sendSafeDM(member, `👑 Double booster! **${boostRoles.ROLE_2_BOOST.name}** unlocked - Full Access!`);
            }
        }

        // Trigger slot & role sync to remove trial role automatically
        if (typeof syncUserSlotsAndRoles === 'function') {
            await syncUserSlotsAndRoles(member, guild.client).catch(() => {});
        }

    } catch (err) {
        console.error(`Boost add error ${member.id}:`, err.message);
    }
}

export async function handleBoostRemove(member) {
    if (!member || member.user.bot) return;
    try {
        const guild = member.guild;
        const boostRoles = getBoostRoles(guild);

        // If user stopped boosting completely, strip all boost roles
        if (!member.premiumSince) {
            const rolesToRemove = [];
            if (boostRoles.ROLE_1_BOOST && member.roles.cache.has(boostRoles.ROLE_1_BOOST.id)) {
                rolesToRemove.push(boostRoles.ROLE_1_BOOST.id);
            }
            if (boostRoles.ROLE_2_BOOST && member.roles.cache.has(boostRoles.ROLE_2_BOOST.id)) {
                rolesToRemove.push(boostRoles.ROLE_2_BOOST.id);
            }

            if (rolesToRemove.length > 0) {
                await member.roles.remove(rolesToRemove).catch(() => {});
                await sendSafeDM(member, `🔒 Your boost expired on **${guild.name}**. Boost roles have been removed.`);
            }
        }

        // Trigger slot sync engine to re-lock slots if required
        if (typeof syncUserSlotsAndRoles === 'function') {
            await syncUserSlotsAndRoles(member, guild.client).catch(() => {});
        }

    } catch (err) {
        console.error(`Boost remove error ${member.id}:`, err.message);
    }
}

export async function handleBoostUpdate(oldMember, newMember) {
    if (!oldMember || !newMember || newMember.user.bot) return;
    try {
        const hadBoost = Boolean(oldMember.premiumSince);
        const hasBoost = Boolean(newMember.premiumSince);
        
        if (!hadBoost && hasBoost) {
            await handleBoostAdd(newMember);
        } else if (hadBoost && !hasBoost) {
            await handleBoostRemove(newMember);
        } else if (hadBoost && hasBoost) {
            const oldBoosts = getBoostCount(oldMember);
            const newBoosts = getBoostCount(newMember);
            
            if (newBoosts > oldBoosts) {
                await handleBoostAdd(newMember);
            } else if (newBoosts < oldBoosts) {
                await handleBoostRemove(newMember);
            }
        }
    } catch (err) {
        console.error("Boost update error:", err.message);
    }
}
