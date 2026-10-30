/**
 * trialExpiryChecker.js - Bulletproof expiry checker (Safe - Only removes Trial role)
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
    slot: { type: Number, default: 1 }
});

const UserTrial = mongoose.models.UserTrial || mongoose.model('UserTrial', userTrialSchema);

export function startTrialExpiryChecker(client) {
    // Har 10 minute mein check karega
    setInterval(async () => {
        try {
            const now = Date.now();
            
            // Sabhi active users ko fetch karo jinki expiry set hai
            const activeUsers = await UserTrial.find({
                active: true,
                expiresAt: { $ne: null }
            });

            if (!activeUsers || activeUsers.length === 0) return;

            for (const userDoc of activeUsers) {
                const duration = userDoc.durationDays;
                
                // 🛡️ Extra Code-Level Guard: Agar duration 'lifetime' ya '-1' hai, toh galti se bhi expire mat karo
                if (duration === 'lifetime' || duration === -1 || duration === 'unlimited') {
                    continue;
                }

                let expiryTime = userDoc.expiresAt;

                // 🔄 UNIT FIX: Agar expiresAt seconds mein hai (10 digits), toh use milliseconds mein convert karo
                if (expiryTime && expiryTime < 10000000000) {
                    expiryTime = expiryTime * 1000;
                }

                // Agar expiry time abhi ke time ($now) se zyada hai, matlab abhi time bacha hai, toh skip karo
                if (expiryTime && expiryTime > now) continue;

                const userId = userDoc.userId;

                // Mark user inactive in MongoDB
                userDoc.active = false;
                await userDoc.save();

                // Remove role from all guilds where the bot and user are present
                for (const [guildId, guild] of client.guilds.cache) {
                    try {
                        const member = await guild.members.fetch(userId).catch(() => null);
                        if (!member) continue;

                        const configuredRoles = await getRolesAsync(guildId);
                        const trialRoleId = configuredRoles.ROLE_TRIAL;

                        // 🔒 SAFE: Only remove Trial Role. NEVER touch Boost or Premium roles here!
                        if (trialRoleId && member.roles.cache.has(trialRoleId)) {
                            await member.roles.remove(trialRoleId).catch(() => {});
                        }

                        // Notify user in DM about expiration
                        try {
                            const targetUser = await client.users.fetch(userId);
                            await targetUser.send(
                                `⏳ **Your Trial Access Has Expired!**\n\n` +
                                `Your 30-day free trial duration has ended, and the trial role has been automatically removed from the server. ` +
                                `You can redeem a new key or boost the server to regain full access.`
                            );
                        } catch {}

                        console.log(`[Expiry Handler] Successfully removed expired trial role for user ID: ${userId}`);
                    } catch (err) {
                        console.error(`[Expiry Handler Error] Guild ${guildId}:`, err.message);
                    }
                }
            }
        } catch (err) {
            console.error('Error in trial expiry checker interval:', err.message);
        }
    }, 10 * 60 * 1000); // Check every 10 minutes
}
