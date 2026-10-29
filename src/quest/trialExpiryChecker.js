/**
 * trialExpiryChecker.js - Automatically checks and removes expired trial/premium roles
 * Location: src/quest/trialExpiryChecker.js
 */

import mongoose from 'mongoose';
import { getRolesAsync } from './roleStore.js';

const userTrialSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    claimedTrial: { type: Boolean, default: false },
    active: { type: Boolean, default: false },
    expiresAt: { type: Number, default: null },
    durationDays: { type: Number, default: 30 },
    unlockedSlots: { type: [Number], default: [1] }
});

const UserTrial = mongoose.models.UserTrial || mongoose.model('UserTrial', userTrialSchema);

export function startTrialExpiryChecker(client) {
    // Har 10 minute mein check karega ki kisika trial expire hua ya nahi
    setInterval(async () => {
        try {
            const now = Date.now();
            // Find users whose trial is active but expiresAt time has passed
            const expiredUsers = await UserTrial.find({
                active: true,
                expiresAt: { $ne: null, $lte: now }
            });

            if (!expiredUsers || expiredUsers.length === 0) return;

            for (const userDoc of expiredUsers) {
                const userId = userDoc.userId;

                // Mark user inactive in MongoDB and reset slots/duration
                userDoc.active = false;
                userDoc.unlockedSlots = [1]; // Reset slots
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
