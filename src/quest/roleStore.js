/**
 * roleStore.js - 4 Roles Per Guild - MongoDB Persistent - Multi Server Safe
 * Location: src/quest/roleStore.js
 * 
 * Saves per guild: guildId -> 4 roles
 * Reset safe, crash safe, multi server
 */

import { getCollection } from '../utils/mongo.js';
import InviteTracker from '../models/InviteTracker.js';
import fs from 'fs';
import path from 'path';

const STORE_PATH = './data/roles.json';
const COLLECTION_NAME = 'roles_data';

const DEFAULT_ROLES = {
    ROLE_2_INVITES: null, // Role 1: 2 Invites - Slot 2
    ROLE_5_INVITES: null, // Role 2: 5 Invites - Slot 3
    ROLE_1_BOOST: null,   // Role 3: 10 Invites OR 1 Boost - Slot 4 (1 Boost = 1-4)
    ROLE_2_BOOST: null,   // Role 4: 2 Boosts - Slot 5 - Full (2 Boosts = 1-5)
};

const memoryCache = new Map(); // guildId -> roles
let isCacheLoaded = false;

function ensureDataFolder() {
    try {
        const dir = path.dirname(STORE_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    } catch {}
}

// Load all guild roles from MongoDB to memory
async function preloadCache() {
    try {
        const col = await getCollection(COLLECTION_NAME);
        if (!col) return;
        const allDocs = await col.find({}).toArray();
        allDocs.forEach(doc => {
            if (doc.guildId && doc.roles) {
                memoryCache.set(doc.guildId, { ...DEFAULT_ROLES, ...doc.roles });
            }
        });
        isCacheLoaded = true;
        console.log(`⚡ Roles cache loaded - ${memoryCache.size} guilds - Multi Server`);
    } catch (err) {
        console.error("Roles preload error:", err.message);
    }
}

export function getRoles(guildId = null) {
    ensureDataFolder();
    
    if (guildId) {
        if (memoryCache.has(guildId)) {
            return { ...DEFAULT_ROLES, ...memoryCache.get(guildId) };
        }
        try {
            if (fs.existsSync(STORE_PATH)) {
                const data = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
                if (data[guildId]) return { ...DEFAULT_ROLES, ...data[guildId] };
                if (!guildId) return { ...DEFAULT_ROLES, ...data };
            }
        } catch {}
        return { ...DEFAULT_ROLES };
    } else {
        try {
            if (fs.existsSync(STORE_PATH)) {
                const data = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
                return { ...DEFAULT_ROLES, ...data };
            }
        } catch {}
        return { ...DEFAULT_ROLES };
    }
}

export async function getRolesAsync(guildId) {
    if (!isCacheLoaded) await preloadCache();
    return getRoles(guildId);
}

export async function setRole(guildId, key, roleId) {
    if (!guildId || !key) {
        console.error("❌ setRole: guildId and key required");
        return null;
    }
    
    ensureDataFolder();
    let roles = getRoles(guildId);
    roles[key] = roleId;

    memoryCache.set(guildId, roles);

    try {
        let fileData = {};
        if (fs.existsSync(STORE_PATH)) {
            fileData = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
        }
        fileData[guildId] = roles;
        fs.writeFileSync(STORE_PATH, JSON.stringify(fileData, null, 2));
    } catch (err) {
        console.error("File save error:", err.message);
    }

    try {
        const col = await getCollection(COLLECTION_NAME);
        if (col) {
            await col.updateOne(
                { guildId },
                { $set: { guildId, roles, updatedAt: new Date() } },
                { upsert: true }
            );
        }
    } catch (err) {
        console.error("MongoDB setRole error:", err.message);
    }

    console.log(`✅ Role set [${guildId}] ${key}: ${roleId} - Persistent`);
    return roles;
}

export async function removeRole(guildId, key) {
    if (!guildId || !key) return null;
    
    ensureDataFolder();
    let roles = getRoles(guildId);
    roles[key] = null;

    memoryCache.set(guildId, roles);

    try {
        let fileData = {};
        if (fs.existsSync(STORE_PATH)) {
            fileData = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
        }
        fileData[guildId] = roles;
        fs.writeFileSync(STORE_PATH, JSON.stringify(fileData, null, 2));
    } catch {}

    try {
        const col = await getCollection(COLLECTION_NAME);
        if (col) {
            await col.updateOne(
                { guildId },
                { $set: { guildId, roles, updatedAt: new Date() } },
                { upsert: true }
            );
        }
    } catch (err) {
        console.error("MongoDB removeRole error:", err.message);
    }

    console.log(`🗑️ Role removed [${guildId}] ${key} - Persistent`);
    return roles;
}

export async function syncRolesFromDB() {
    try {
        const col = await getCollection(COLLECTION_NAME);
        if (!col) return null;
        const allDocs = await col.find({}).toArray();
        
        ensureDataFolder();
        let fileData = {};
        try {
            if (fs.existsSync(STORE_PATH)) {
                fileData = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
            }
        } catch {}

        allDocs.forEach(doc => {
            if (doc.guildId && doc.roles) {
                memoryCache.set(doc.guildId, { ...DEFAULT_ROLES, ...doc.roles });
                fileData[doc.guildId] = { ...DEFAULT_ROLES, ...doc.roles };
            }
        });

        try {
            fs.writeFileSync(STORE_PATH, JSON.stringify(fileData, null, 2));
        } catch {}

        console.log(`🔄 Roles synced from MongoDB - ${memoryCache.size} guilds - Multi Server Safe`);
        isCacheLoaded = true;
        return memoryCache;
    } catch (err) {
        console.error("Sync roles error:", err.message);
        return null;
    }
}

// ── AUTOMATED ROLE & ACCESS LOGIC ──

export async function checkAndUpdateRoles(guild, userId, inviteCount = 0) {
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return;
    
    const roles = getRoles(guild.id);
    if (!inviteCount) {
        const t = await InviteTracker.findOne({ guildId: guild.id, userId }).catch(() => null);
        inviteCount = t?.invites || 0;
    }
    
    const boostCount = guild.premiumSubscriptionCount || (member.premiumSince ? 1 : 0);

    // 2 Boosts = Full Access (Slots 1-5)
    if (boostCount >= 2) {
        if (roles.ROLE_2_BOOST && !member.roles.cache.has(roles.ROLE_2_BOOST)) await member.roles.add(roles.ROLE_2_BOOST).catch(() => {});
        if (roles.ROLE_1_BOOST && !member.roles.cache.has(roles.ROLE_1_BOOST)) await member.roles.add(roles.ROLE_1_BOOST).catch(() => {});
        if (roles.ROLE_5_INVITES && !member.roles.cache.has(roles.ROLE_5_INVITES)) await member.roles.add(roles.ROLE_5_INVITES).catch(() => {});
        if (roles.ROLE_2_INVITES && !member.roles.cache.has(roles.ROLE_2_INVITES)) await member.roles.add(roles.ROLE_2_INVITES).catch(() => {});
        return;
    }
    
    // 1 Boost = Slots 1-4
    if (boostCount >= 1) {
        if (roles.ROLE_1_BOOST && !member.roles.cache.has(roles.ROLE_1_BOOST)) await member.roles.add(roles.ROLE_1_BOOST).catch(() => {});
        if (roles.ROLE_5_INVITES && !member.roles.cache.has(roles.ROLE_5_INVITES)) await member.roles.add(roles.ROLE_5_INVITES).catch(() => {});
        if (roles.ROLE_2_INVITES && !member.roles.cache.has(roles.ROLE_2_INVITES)) await member.roles.add(roles.ROLE_2_INVITES).catch(() => {});
        return;
    }

    // Incremental Invites Logic
    if (roles.ROLE_2_INVITES) {
        if (inviteCount >= 2 && !member.roles.cache.has(roles.ROLE_2_INVITES)) await member.roles.add(roles.ROLE_2_INVITES).catch(() => {});
        if (inviteCount < 2 && member.roles.cache.has(roles.ROLE_2_INVITES)) await member.roles.remove(roles.ROLE_2_INVITES).catch(() => {});
    }
    
    if (roles.ROLE_5_INVITES) {
        if (inviteCount >= 5 && !member.roles.cache.has(roles.ROLE_5_INVITES)) await member.roles.add(roles.ROLE_5_INVITES).catch(() => {});
        if (inviteCount < 5 && member.roles.cache.has(roles.ROLE_5_INVITES)) await member.roles.remove(roles.ROLE_5_INVITES).catch(() => {});
    }
    
    if (roles.ROLE_1_BOOST && member.roles.cache.has(roles.ROLE_1_BOOST) && inviteCount < 10) {
        await member.roles.remove(roles.ROLE_1_BOOST).catch(() => {});
    }
    
    if (roles.ROLE_2_BOOST && member.roles.cache.has(roles.ROLE_2_BOOST)) {
        await member.roles.remove(roles.ROLE_2_BOOST).catch(() => {});
    }
}

export async function isSlotUnlocked(guild, userId, slotNum) {
    if (slotNum === 1) return true; // Slot 1 is always free
    
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return false;
    
    const roles = getRoles(guild.id);
    const tracker = await InviteTracker.findOne({ guildId: guild.id, userId }).catch(() => null);
    const invites = tracker?.invites || 0;
    const boostCount = guild.premiumSubscriptionCount || (member.premiumSince ? 1 : 0);
    
    if (boostCount >= 2) return true;
    if (boostCount >= 1 && slotNum <= 4) return true;
    
    if (slotNum === 2) return invites >= 2 || member.roles.cache.has(roles.ROLE_2_INVITES);
    if (slotNum === 3) return invites >= 5 || member.roles.cache.has(roles.ROLE_5_INVITES);
    if (slotNum === 4) return invites >= 10 || member.roles.cache.has(roles.ROLE_1_BOOST);
    if (slotNum === 5) return false; // Slot 5 only 2 boosts
    
    return false;
}

// Legacy support - no guildId
export function setRoleLegacy(key, roleId) {
    return setRole('global', key, roleId);
}
export function removeRoleLegacy(key) {
    return removeRole('global', key);
}
