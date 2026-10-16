/**
 * roleStore.js - 4 Roles Database - Stores Role IDs
 * Location: src/quest/roleStore.js
 * Saves to: ./data/roles.json
 */

import fs from 'fs';
import path from 'path';

const STORE_PATH = './data/roles.json';

const DEFAULT_ROLES = {
    ROLE_2_INVITES: null, // Role 1: 2 Invites - Slot 2 unlock
    ROLE_5_INVITES: null, // Role 2: 5 Invites - Slot 3 - 3 Slot Access - 4 slots visible
    ROLE_1_BOOST: null,   // Role 3: 1 Boost - Slot 4 - 4 slots to 5 slots visible
    ROLE_2_BOOST: null,   // Role 4: 2 Boosts - Slot 5 - Full 5 slots access
};

function ensureDataFolder() {
    const dir = path.dirname(STORE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function getRoles() {
    ensureDataFolder();
    try {
        if (fs.existsSync(STORE_PATH)) {
            const data = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
            return { ...DEFAULT_ROLES, ...data };
        }
    } catch {}
    return { ...DEFAULT_ROLES };
}

export function setRole(key, roleId) {
    ensureDataFolder();
    const roles = getRoles();
    roles[key] = roleId;
    fs.writeFileSync(STORE_PATH, JSON.stringify(roles, null, 2));
    return roles;
}

export function removeRole(key) {
    ensureDataFolder();
    const roles = getRoles();
    roles[key] = null;
    fs.writeFileSync(STORE_PATH, JSON.stringify(roles, null, 2));
    return roles;
}
