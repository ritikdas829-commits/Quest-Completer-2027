/**
 * trialKeyStore.js - MongoDB Based Key Generation, One-Time Trial & Status Tracking
 * Location: src/quest/trialKeyStore.js
 */

import mongoose from 'mongoose';

// Define Schemas for MongoDB
const adminLimitSchema = new mongoose.Schema({
    adminId: { type: String, required: true, unique: true },
    maxKeys: { type: Number, default: 4 },
    usedKeys: { type: Number, default: 0 }
});

const userTrialSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    claimedTrial: { type: Boolean, default: false },
    active: { type: Boolean, default: false },
    expiresAt: { type: Number, default: null },
    durationDays: { type: Number, default: 30 }
});

const keySchema = new mongoose.Schema({
    keyString: { type: String, required: true, unique: true },
    assignedTo: { type: String, default: null },
    type: { type: String, default: 'admin_generated' },
    durationDays: { type: Number, default: 30 },
    redeemed: { type: Boolean, default: false },
    createdAt: { type: Number, default: Date.now }
});

const AdminLimit = mongoose.models.AdminLimit || mongoose.model('AdminLimit', adminLimitSchema);
const UserTrial = mongoose.models.UserTrial || mongoose.model('UserTrial', userTrialSchema);
const KeyStore = mongoose.models.KeyStore || mongoose.model('KeyStore', keySchema);

function generateKeyString() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const segment = () => Array.from({length: 4}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `${segment()}-${segment()}-${segment()}`;
}

// Set or update an admin's creation limit in MongoDB
export async function setAdminKeyLimit(adminId, maxKeys) {
    let limitDoc = await AdminLimit.findOne({ adminId });
    if (!limitDoc) {
        limitDoc = new AdminLimit({ adminId, maxKeys: 4, usedKeys: 0 });
    }
    limitDoc.maxKeys = maxKeys;
    await limitDoc.save();
}

// Check User Trial Status & Remaining Days from MongoDB
export async function getUserTrialStatus(userId) {
    const userData = await UserTrial.findOne({ userId });

    if (!userData || !userData.active) {
        return { hasClaimed: false, active: false, daysRemaining: 0 };
    }

    if (userData.durationDays === -1) {
        return { hasClaimed: true, active: true, daysRemaining: 'Lifetime / Permanent' };
    }

    const now = Date.now();
    const expiresAt = userData.expiresAt;
    const diffMs = expiresAt - now;

    if (diffMs <= 0) {
        return { hasClaimed: true, active: false, daysRemaining: 0, expired: true };
    }

    const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return { hasClaimed: true, active: true, daysRemaining };
}

// Generate key with One-Time Trial restriction using MongoDB
export async function generateKeyByRole(userId, guildOwnerId, targetUserId = null, requestedDays = 30) {
    const isOwner = (userId === guildOwnerId);

    // 🛑 Check if target user has already claimed their 1-time trial
    if (targetUserId && targetUserId === userId && !isOwner) {
        let existingUser = await UserTrial.findOne({ userId });
        if (existingUser && existingUser.claimedTrial) {
            return { 
                success: false, 
                message: `❌ You have already claimed your **One-Time Free Trial**! You cannot generate another trial key.` 
            };
        }
    }

    let durationDays = requestedDays;
    let remainingText = '';

    if (!isOwner) {
        let adminData = await AdminLimit.findOne({ adminId: userId });
        if (!adminData) {
            adminData = new AdminLimit({ adminId: userId, maxKeys: 4, usedKeys: 0 });
            await adminData.save();
        }

        if (adminData.usedKeys >= adminData.maxKeys) {
            return { success: false, message: `Your key generation limit has been reached! (${adminData.usedKeys}/${adminData.maxKeys} keys used)` };
        }

        if (requestedDays > 30 || requestedDays <= 0) {
            durationDays = 30;
        }

        adminData.usedKeys += 1;
        await adminData.save();
        remainingText = `${adminData.maxKeys - adminData.usedKeys} left`;
    } else {
        durationDays = requestedDays;
        remainingText = 'Unlimited (Owner)';
    }

    const key = generateKeyString();
    await KeyStore.create({
        keyString: key,
        assignedTo: targetUserId,
        type: isOwner ? 'owner_custom' : 'admin_generated',
        durationDays: durationDays,
        redeemed: false,
        createdAt: Date.now()
    });

    // If it's a self-trial generation, mark that they have claimed their trial ticket
    if (targetUserId && targetUserId === userId) {
        await UserTrial.findOneAndUpdate(
            { userId },
            { $set: { claimedTrial: true } },
            { upsert: true, new: true }
        );
    }

    return { 
        success: true, 
        key, 
        remaining: remainingText 
    };
}
