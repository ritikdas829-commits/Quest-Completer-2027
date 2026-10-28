/**
 * suspiciousActivity.js — Activity Cooldown & Ban Prevention Security Module
 * Location: src/quest/suspiciousActivity.js
 */

const activeCooldowns = new Map(); // Stores userId -> expiry timestamp

export function checkActivityCooldown(userId) {
    const expiry = activeCooldowns.get(userId);
    if (!expiry) return { active: false, remaining: 0 };
    
    const now = Date.now();
    if (now >= expiry) {
        activeCooldowns.delete(userId);
        return { active: false, remaining: 0 };
    }
    
    const remainingMs = expiry - now;
    const remainingMins = Math.ceil(remainingMs / (60 * 1000));
    return { active: true, remaining: remainingMins };
}

export function setActivityCooldown(userId, hours = 2) {
    const expiry = Date.now() + hours * 60 * 60 * 1000;
    activeCooldowns.set(userId, expiry);
}

export function clearActivityCooldown(userId) {
    activeCooldowns.delete(userId);
}
