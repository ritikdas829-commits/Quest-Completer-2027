/**
 * boostTracker.js - Precise Boost Role Management without interfering with trial/premium expiry
 * Location: src/handlers/boostTracker.js
 */

import { getRoles } from '../quest/roleStore.js';
import { getEmojis } from '../quest/emoji.js';

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
 * Accurately determines user boost level and strictly validates active status
 */
function getBoostCount(member) {
    try {
        if (!member) return 0;

        const isBoosting = Boolean(member.premiumSince);
        if (!isBoosting) return 0;

        const roles = getRoles(member.guild?.id);
        
        if (roles?.ROLE_2_BOOST && member.roles.cache.has(roles.ROLE_2_BOOST)) {
            return 2;
        }

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
        const EMOJI = await getEmojis(guild.id || 'global');

        if (!member.premiumSince || boosts === 0) {
            await handleBoostRemove(member);
            return;
        }

        // 1 Boost Case
        if (boosts === 1 && boostRoles.ROLE_1_BOOST) {
            if (boostRoles.ROLE_2_BOOST && member.roles.cache.has(boostRoles.ROLE_2_BOOST.id)) {
                await member.roles.remove(boostRoles.ROLE_2_BOOST).catch(() => {});
            }

            if (!member.roles.cache.has(boostRoles.ROLE_1_BOOST.id)) {
                await member.roles.add(boostRoles.ROLE_1_BOOST).catch(() => {});
                await sendSafeDM(member, `${EMOJI.success || '💎'} Thank you for boosting **${guild.name}**! **${boostRoles.ROLE_1_BOOST.name}** role unlocked.`);
            }
        }

        // 2 or More Boosts Case
        if (boosts >= 2 && boostRoles.ROLE_2_BOOST) {
            if (!member.roles.cache.has(boostRoles.ROLE_2_BOOST.id)) {
                await member.roles.add(boostRoles.ROLE_2_BOOST).catch(() => {});
                await sendSafeDM(member, `${EMOJI.crown || '👑'} Double booster detected! **${boostRoles.ROLE_2_BOOST.name}** unlocked - Full Access!`);
            }
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
        const EMOJI = await getEmojis(guild.id || 'global');

        const isStillBoosting = Boolean(member.premiumSince);

        if (!isStillBoosting) {
            const rolesToRemove = [];
            if (boostRoles.ROLE_1_BOOST && member.roles.cache.has(boostRoles.ROLE_1_BOOST.id)) {
                rolesToRemove.push(boostRoles.ROLE_1_BOOST.id);
            }
            if (boostRoles.ROLE_2_BOOST && member.roles.cache.has(boostRoles.ROLE_2_BOOST.id)) {
                rolesToRemove.push(boostRoles.ROLE_2_BOOST.id);
            }

            if (rolesToRemove.length > 0) {
                await member.roles.remove(rolesToRemove).catch(() => {});
                await sendSafeDM(member, `${EMOJI.lock || '🔒'} Your boost expired on **${guild.name}**. Boost roles have been automatically removed.`);
            }
        } else {
            const boosts = getBoostCount(member);
            if (boosts === 1 && boostRoles.ROLE_2_BOOST && member.roles.cache.has(boostRoles.ROLE_2_BOOST.id)) {
                await member.roles.remove(boostRoles.ROLE_2_BOOST).catch(() => {});
                if (boostRoles.ROLE_1_BOOST && !member.roles.cache.has(boostRoles.ROLE_1_BOOST.id)) {
                    await member.roles.add(boostRoles.ROLE_1_BOOST).catch(() => {});
                }
            }
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
            
            if (newBoosts !== oldBoosts) {
                if (newBoosts > oldBoosts) {
                    await handleBoostAdd(newMember);
                } else {
                    await handleBoostRemove(newMember);
                }
            }
        }
    } catch (err) {
        console.error("Boost update error:", err.message);
    }
}
