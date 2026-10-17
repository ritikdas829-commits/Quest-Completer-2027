/**
 * roleStore.js - 4 Roles Per Guild - MongoDB Persistent - Multi Server Safe
 * Location: src/quest/roleStore.js
 */

import { getCollection } from '../utils/mongo.js';
import fs from 'fs';
import path from 'path';

const STORE_PATH = './data/roles.json';
const COLLECTION_NAME = 'roles_data';
const COLLECTION_INVITES = 'invites_data';

const DEFAULT_ROLES = {
    ROLE_2_INVITES: null, // Role 1: 2 Invites - Slot 2
    ROLE_5_INVITES: null, // Role 2: 5 Invites - Slot 3
    ROLE_1_BOOST: null,   // Role 3: 10 Invites OR 1 Boost - Slot 4
    ROLE_2_BOOST: null,   // Role 4: 2 Boosts - Slot 5 - Full
};

const memoryCache = new Map();
let isCacheLoaded = false;

function ensureDataFolder() {
    try {
        const dir = path.dirname(STORE_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    } catch {}
}

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
    if (!guildId || !key) return null;
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
    } catch {}
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
    } catch {}
    return roles;
}

export async function checkAndUpdateRoles(guild, userId, inviteCount = 0) {
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return;
    
    const roles = getRoles(guild.id);
    if (!inviteCount) {
        try {
            const col = await getCollection(COLLECTION_INVITES);
            const t = col ? await col.findOne({ guildId: guild.id, userId }) : null;
            inviteCount = t?.count || 0;
        } catch { inviteCount = 0; }
    }
    
    const boostCount = guild.premiumSubscriptionCount || (member.premiumSince ? 1 : 0);

    try {
        if (roles.ROLE_2_INVITES) {
            if (inviteCount >= 2 && !member.roles.cache.has(roles.ROLE_2_INVITES)) {
                await member.roles.add(roles.ROLE_2_INVITES).catch(() => {});
            } else if (inviteCount < 2 && member.roles.cache.has(roles.ROLE_2_INVITES) && boostCount < 1) {
                await member.roles.remove(roles.ROLE_2_INVITES).catch(() => {});
            }
        }
        
        if (roles.ROLE_5_INVITES) {
            if (inviteCount >= 5 && !member.roles.cache.has(roles.ROLE_5_INVITES)) {
                await member.roles.add(roles.ROLE_5_INVITES).catch(() => {});
            } else if (inviteCount < 5 && member.roles.cache.has(roles.ROLE_5_INVITES) && boostCount < 1) {
                await member.roles.remove(roles.ROLE_5_INVITES).catch(() => {});
            }
        }
        
        if (roles.ROLE_1_BOOST) {
            if ((inviteCount >= 10 || boostCount >= 1) && !member.roles.cache.has(roles.ROLE_1_BOOST)) {
                await member.roles.add(roles.ROLE_1_BOOST).catch(() => {});
            } else if (inviteCount < 10 && boostCount < 1 && member.roles.cache.has(roles.ROLE_1_BOOST)) {
                await member.roles.remove(roles.ROLE_1_BOOST).catch(() => {});
            }
        }
        
        if (roles.ROLE_2_BOOST) {
            if (boostCount >= 2 && !member.roles.cache.has(roles.ROLE_2_BOOST)) {
                await member.roles.add(roles.ROLE_2_BOOST).catch(() => {});
            } else if (boostCount < 2 && member.roles.cache.has(roles.ROLE_2_BOOST)) {
                await member.roles.remove(roles.ROLE_2_BOOST).catch(() => {});
            }
        }
    } catch (e) {
        console.error("checkAndUpdateRoles error:", e.message);
    }
}

export async function isSlotUnlocked(guild, userId, slotNum) {
    if (slotNum === 1) return true;
    
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return false;
    
    const roles = getRoles(guild.id);
    let invites = 0;
    try {
        const col = await getCollection(COLLECTION_INVITES);
        const tracker = col ? await col.findOne({ guildId: guild.id, userId }) : null;
        invites = tracker?.count || 0;
    } catch {}
    
    const boostCount = guild.premiumSubscriptionCount || (member.premiumSince ? 1 : 0);
    
    if (slotNum === 2) return invites >= 2 || member.roles.cache.has(roles.ROLE_2_INVITES);
    if (slotNum === 3) return invites >= 5 || member.roles.cache.has(roles.ROLE_5_INVITES);
    if (slotNum === 4) return invites >= 10 || boostCount >= 1 || member.roles.cache.has(roles.ROLE_1_BOOST);
    if (slotNum === 5) return boostCount >= 2 || member.roles.cache.has(roles.ROLE_2_BOOST);
    
    return false;
}
