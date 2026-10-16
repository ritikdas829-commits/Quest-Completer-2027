/**
 * roleStore.js - 4 Roles Per Guild - MongoDB Persistent - Multi Server Safe
 * Location: src/quest/roleStore.js
 * 
 * Saves per guild: guildId -> 4 roles
 * Reset safe, crash safe, multi server
 */

import { getCollection } from '../utils/mongo.js';
import fs from 'fs';
import path from 'path';

const STORE_PATH = './data/roles.json';
const COLLECTION_NAME = 'roles_data';

const DEFAULT_ROLES = {
    ROLE_2_INVITES: null, // Role 1: 2 Invites - Slot 2
    ROLE_5_INVITES: null, // Role 2: 5 Invites - Slot 3 - 3 Slot Access
    ROLE_1_BOOST: null,   // Role 3: 1 Boost - Slot 4
    ROLE_2_BOOST: null,   // Role 4: 2 Boosts - Slot 5 - Full
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
        // Per guild - memory first
        if (memoryCache.has(guildId)) {
            return { ...DEFAULT_ROLES, ...memoryCache.get(guildId) };
        }
        // File fallback for single guild mode
        try {
            if (fs.existsSync(STORE_PATH)) {
                const data = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
                // If file has guildId structure or flat
                if (data[guildId]) return { ...DEFAULT_ROLES, ...data[guildId] };
                if (!guildId) return { ...DEFAULT_ROLES, ...data };
            }
        } catch {}
        return { ...DEFAULT_ROLES };
    } else {
        // No guildId - legacy mode - try file
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

    // 1. Memory
    memoryCache.set(guildId, roles);

    // 2. File backup (per guild structure)
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

    // 3. MongoDB - Persistent - Multi server safe
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

// Legacy support - no guildId
export function setRoleLegacy(key, roleId) {
    return setRole('global', key, roleId);
}
export function removeRoleLegacy(key) {
    return removeRole('global', key);
}
