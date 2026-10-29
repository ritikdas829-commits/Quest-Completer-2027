/**
 * trialExpiryChecker.js - Bulletproof expiry checker with strict safety filters
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
            
            // 🛑 Ultimate Safety Filter: Sirf active users jinpar expiry date hai, aur jo lifetime/unlimited nahi hain
            const activeUsers = await UserTrial.find({
                active: true,
                expiresAt: { $ne: null, $lte: now }
            });

            if (!activeUsers || activeUsers.length === 0) return;

            for (const userDoc of activeUsers) {
                const duration = userDoc.durationDays;
                
                // 🛡️ Extra Code-Level Guard: Agar duration 'lifetime' ya '-1' hai, toh galti se bhi expire mat karo
                if (duration === 'lifetime' || duration === -1 || duration === 'unlimited') {
                    continue;
                }

                // Agar expiresAt abhi ke time se zyada hai, toh skip karo
                if (!userDoc.expiresAt || userDoc.expiresAt > now) continue;

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
                        const premiumRoleId = configuredRoles.ROLE_PREMIUM || configuredRoles.ROLE_2_BOOST;

                        // Remove Trial Role if present
                        if (trialRoleId && member.roles.cache.has(trialRoleId)) {
                            await member.roles.remove(trialRoleId).catch(() => {});
                        }

                        // Remove Premium Role if present
                        if (premiumRoleId && member.roles.cache.has(premiumRoleId)) {
                            await member.roles.remove(premiumRoleId).catch(() => {});
                        }

                        // Notify user in DM about expiration
                        try {
                            const targetUser = await client.users.fetch(userId);
                            await targetUser.send(
                                `⏳ **Your Trial / Premium Access Has Expired!**\n\n` +
                                `Your active duration has ended, and your trial role has been automatically removed from the server. ` +
                                `You can redeem a new key or purchase premium to regain full access.`
                            );
                        } catch {}

                        console.log(`[Expiry Handler] Successfully removed expired roles for user ID: ${userId}`);
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
