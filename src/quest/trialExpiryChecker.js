/**
 * trialExpiryChecker.js - Bulletproof Expiry Checker with Premium/Trial Support & Safety Buffer
 * Location: src/quest/trialExpiryChecker.js
 */

import mongoose from 'mongoose';
import { getRolesAsync } from './roleStore.js';

const userTrialSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    claimedTrial: { type: Boolean, default: false },
    active: { type: Boolean, default: false },
    expiresAt: { type: Number, default: null },
    durationDays: { type: mongoose.Schema.Types.Mixed, default: 30 },
    slot: { type: Number, default: 1 },
    type: { type: String, default: 'trial' }
});

const UserTrial = mongoose.models.UserTrial || mongoose.model('UserTrial', userTrialSchema);

export function startTrialExpiryChecker(client) {
    async function check() {
        try {
            const now = Date.now();
            
            // Fetch all active users with an expiry set
            const activeUsers = await UserTrial.find({
                active: true,
                expiresAt: { $ne: null }
            });

            if (!activeUsers || activeUsers.length === 0) return;

            for (const userDoc of activeUsers) {
                const duration = String(userDoc.durationDays || '').toLowerCase();
                
                // 🛡️ Skip lifetime / unlimited durations
                if (['lifetime', 'unlimited', '-1'].includes(duration) || userDoc.durationDays === -1) {
                    continue;
                }

                let expiryTime = userDoc.expiresAt;

                // 🔄 UNIT FIX: Convert seconds to milliseconds if necessary
                if (expiryTime && expiryTime < 10000000000) {
                    expiryTime = expiryTime * 1000;
                }

                // 🛑 SAFETY BUFFER: Only remove if expired by at least 2 minutes to prevent race conditions
                if (!expiryTime || expiryTime > now - 2 * 60 * 1000) {
                    continue;
                }

                const userId = userDoc.userId;
                const isPremium = userDoc.type === 'premium' || (!userDoc.type && userDoc.slot > 1);

                // Mark user inactive in MongoDB
                userDoc.active = false;
                await userDoc.save();

                let removed = false;

                // Remove role from all guilds where the bot and user are present
                for (const [guildId, guild] of client.guilds.cache) {
                    try {
                        const member = await guild.members.fetch(userId).catch(() => null);
                        if (!member) continue;

                        const roles = await getRolesAsync(guildId);
                        
                        // Handle both Trial and Premium role removal accurately
                        const trialRole = roles.ROLE_TRIAL;
                        const premiumRole = roles.ROLE_PREMIUM;

                        if (trialRole && member.roles.cache.has(trialRole)) {
                            await member.roles.remove(trialRole).catch(() => {});
                            removed = true;
                        }
                        
                        if (isPremium && premiumRole && member.roles.cache.has(premiumRole)) {
                            await member.roles.remove(premiumRole).catch(() => {});
                            removed = true;
                        }
                    } catch (err) {
                        console.error(`[Expiry Handler Error] Guild ${guildId}:`, err.message);
                    }
                }

                // 📬 DM sent ONLY ONCE outside the guild loop
                if (removed) {
                    try {
                        const targetUser = await client.users.fetch(userId);
                        const typeText = isPremium ? 'Premium' : 'Trial';
                        await targetUser.send(
                            `⏳ **Your ${typeText} Access Has Expired!**\n\n` +
                            `Your access duration has ended, and the role has been automatically removed from the server. ` +
                            `You can redeem a new key to continue.`
                        );
                    } catch {}

                    console.log(`[Expiry Handler] Successfully removed expired ${typeText.toLowerCase()} role for user ID: ${userId} | Expiry was: ${new Date(expiryTime).toISOString()}`);
                }
            }
        } catch (err) {
            console.error('Error in trial expiry checker interval:', err.message);
        }
    }

    // Run once on startup, then every 10 minutes
    check();
    setInterval(check, 10 * 60 * 1000);
}
