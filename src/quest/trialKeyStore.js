/**
 * trialKeyStore.js - Advanced Key Generation with Owner & Admin Limits
 * Location: src/quest/trialKeyStore.js
 */

import fs from 'fs';
import path from 'path';

const filePath = path.resolve('data/trialKeys.json');

if (!fs.existsSync(path.dirname(filePath))) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function loadData() {
    if (!fs.existsSync(filePath)) return { users: {}, keys: {}, adminLimits: {} };
    try {
        const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (!raw.adminLimits) raw.adminLimits = {};
        return raw;
    } catch {
        return { users: {}, keys: {}, adminLimits: {} };
    }
}

function saveData(data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function generateKeyString() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const segment = () => Array.from({length: 4}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `${segment()}-${segment()}-${segment()}`;
}

// Set or update an admin's creation limit (e.g., 4 keys)
export async function setAdminKeyLimit(adminId, maxKeys) {
    const db = loadData();
    if (!db.adminLimits[adminId]) {
        db.adminLimits[adminId] = { maxKeys: 4, usedKeys: 0 };
    }
    db.adminLimits[adminId].maxKeys = maxKeys;
    saveData(db);
}

// Generate key with strict role & limit checks
export async function generateKeyByRole(userId, guildOwnerId, targetUserId = null, requestedDays = 30) {
    const db = loadData();
    const isOwner = (userId === guildOwnerId);

    let durationDays = requestedDays;

    if (!isOwner) {
        // Normal admin logic: Check if admin has limit set
        if (!db.adminLimits[userId]) {
            // Default limit for admins if not explicitly set (e.g., 4 keys)
            db.adminLimits[userId] = { maxKeys: 4, usedKeys: 0 };
        }

        const adminData = db.adminLimits[userId];

        if (adminData.usedKeys >= adminData.maxKeys) {
            return { success: false, message: `Aapki key generation limit khatam ho chuki hai! (${adminData.usedKeys}/${adminData.maxKeys} keys used)` };
        }

        // Admins cannot give more than 30 days or lifetime keys
        if (requestedDays > 30 || requestedDays <= 0) {
            durationDays = 30; // Force maximum 30 days for admins
        }

        adminData.usedKeys += 1;
    } else {
        // Owner can set lifetime or any custom days freely
        durationDays = requestedDays; 
    }

    const key = generateKeyString();
    db.keys[key] = {
        assignedTo: targetUserId,
        type: isOwner ? 'owner_custom' : 'admin_generated',
        durationDays: durationDays, // Owner can make lifetime (-1 or 365+), admins max 30d
        redeemed: false,
        createdAt: Date.now()
    };

    saveData(db);
    return { success: true, key, remaining: isOwner ? 'Unlimited (Owner)' : `${db.adminLimits[userId].maxKeys - db.adminLimits[userId].usedKeys} left` };
}
