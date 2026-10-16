// 📍 FILE 3 UPGRADED: src/quest/tokenStore.js
// Tera wala code hi hai — Bas guildId + slot add kiya — Multi server + 5 slots — Same encryption

import * as crypto from 'node:crypto';
import mongoose from 'mongoose';

const ALGORITHM = 'aes-256-gcm';

// UPGRADED SCHEMA — Per guild + per user + per slot (1-5) — Multi server + multi user
const userTokenSchema = new mongoose.Schema({
    guildId: { type: String, required: true, index: true }, // ✅ Added: Per server
    userId: { type: String, required: true, index: true }, // Per user
    slot: { type: Number, required: true, min: 1, max: 5, index: true }, // ✅ Added: 1-5 slots
    encryptedData: { type: String, required: true },
    username: { type: String, default: '' }, // Optional: For display
    linkedAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Composite unique: 1 guild + 1 user + 1 slot = 1 token — Multi server + 5 slots safe
userTokenSchema.index({ guildId: 1, userId: 1, slot: 1 }, { unique: true });

const TokenModel = mongoose.models.UserToken || mongoose.model('UserToken', userTokenSchema);

function deriveKey(secret) {
    return crypto.createHash('sha256').update(secret).digest();
}

function encrypt(text, key) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return JSON.stringify({
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
        data: encrypted.toString('hex'),
    });
}

function decrypt(stored, key) {
    try {
        const { iv, tag, data } = JSON.parse(stored);
        const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));
        decipher.setAuthTag(Buffer.from(tag, 'hex'));
        return decipher.update(Buffer.from(data, 'hex')) + decipher.final('utf8');
    } catch {
        return null;
    }
}

export class TokenStore {
    constructor(secret) {
        if (!secret) {
            console.warn("⚠️ TokenStore secret not set - Use TOKEN_ENCRYPTION_SECRET env");
            secret = process.env.TOKEN_ENCRYPTION_SECRET || 'default-secret-change-me';
        }
        this.key = deriveKey(secret);
        this.cache = new Map(); // Key: guildId_userId_slot
        this.loadIntoCache();
    }

    makeCacheKey(guildId, userId, slot) {
        return `${guildId}_${userId}_slot_${slot}`;
    }

    async loadIntoCache() {
        try {
            const docs = await TokenModel.find({});
            for (const doc of docs) {
                const cacheKey = this.makeCacheKey(doc.guildId, doc.userId, doc.slot);
                this.cache.set(cacheKey, {
                    encryptedData: doc.encryptedData,
                    username: doc.username || ''
                });
            }
            console.log(`🔑 Loaded ${docs.length} encrypted token(s) — ${new Set(docs.map(d=>d.guildId)).size} guilds — Multi server`);
        } catch (err) {
            console.error('❌ Error loading tokens from MongoDB:', err.message);
        }
    }

    // UPGRADED SAVE — Per guild + per slot — Same encryption
    async save(guildId, userId, slot, token, username = '') {
        try {
            if (!guildId ||!userId ||!slot) {
                console.error("❌ save: guildId, userId, slot required");
                return false;
            }
            if (slot < 1 || slot > 5) {
                console.error("❌ save: slot must be 1-5");
                return false;
            }
            const encrypted = encrypt(token, this.key);
            const cacheKey = this.makeCacheKey(guildId, userId, slot);
            this.cache.set(cacheKey, { encryptedData: encrypted, username });
            this.cache.set(`${cacheKey}_username`, username);

            await TokenModel.findOneAndUpdate(
                { guildId, userId, slot },
                { encryptedData: encrypted, username, linkedAt: new Date(), updatedAt: new Date() },
                { upsert: true, new: true }
            );
            console.log(`✅ Token saved [${guildId}] ${userId} slot ${slot} — Encrypted — Persistent`);
            return true;
        } catch (err) {
            console.error(`❌ Error saving token [${guildId}] ${userId} slot ${slot}:`, err.message);
            return false;
        }
    }

    // OLD SAVE SUPPORT — For backward compatibility — guildId = global, slot = 1
    async saveOld(userId, token) {
        return this.save('global', userId, 1, token);
    }

    // UPGRADED GET — Per guild + per slot — Same decryption
    get(guildId, userId, slot) {
        try {
            const cacheKey = this.makeCacheKey(guildId, userId, slot);
            const cached = this.cache.get(cacheKey);
            if (!cached) return null;
            const raw = typeof cached === 'string'? cached : cached.encryptedData;
            return decrypt(raw, this.key);
        } catch {
            return null;
        }
    }

    // OLD GET SUPPORT
    getOld(userId) {
        return this.get('global', userId, 1);
    }

    getUsername(guildId, userId, slot) {
        const cacheKey = this.makeCacheKey(guildId, userId, slot);
        const cached = this.cache.get(cacheKey);
        if (!cached) return '';
        if (typeof cached === 'object' && cached.username) return cached.username;
        const usernameKey = `${cacheKey}_username`;
        return this.cache.get(usernameKey) || '';
    }

    async remove(guildId, userId, slot) {
        try {
            const cacheKey = this.makeCacheKey(guildId, userId, slot);
            const existed = this.cache.has(cacheKey);
            this.cache.delete(cacheKey);
            this.cache.delete(`${cacheKey}_username`);
            await TokenModel.findOneAndDelete({ guildId, userId, slot });
            console.log(`🗑️ Token removed [${guildId}] ${userId} slot ${slot}`);
            return existed;
        } catch (err) {
            console.error(`❌ Error removing token [${guildId}] ${userId} slot ${slot}:`, err.message);
            return false;
        }
    }

    // OLD REMOVE SUPPORT
    async removeOld(userId) {
        return this.remove('global', userId, 1);
    }

    has(guildId, userId, slot) {
        const cacheKey = this.makeCacheKey(guildId, userId, slot);
        return this.cache.has(cacheKey);
    }

    hasOld(userId) {
        return this.has('global', userId, 1);
    }

    // NEW: Get all slots for a user in a guild
    getUserSlots(guildId, userId) {
        const slots = [];
        for (let i = 1; i <= 5; i++) {
            if (this.has(guildId, userId, i)) slots.push(i);
        }
        return slots;
    }

    countUserSlots(guildId, userId) {
        return this.getUserSlots(guildId, userId).length;
    }

    get size() {
        return this.cache.size;
    }

    listUserIds(guildId = null) {
        if (!guildId) {
            return Array.from(this.cache.keys()).filter(k =>!k.includes('_username'));
        }
        return Array.from(this.cache.keys())
          .filter(k => k.startsWith(`${guildId}_`) &&!k.includes('_username'))
          .map(k => {
                const parts = k.split('_');
                return parts[1];
            });
    }

    // For your old code compatibility — createTokenStore() wrapper
    getStoreForOldCode() {
        const self = this;
        return {
            get: (key) => {
                // Key format: guildId_userId_slot_N
                if (key.includes('_slot_')) {
                    const [left, right] = key.split('_slot_');
                    const leftParts = left.split('_');
                    const guildId = leftParts[0];
                    const userId = leftParts[1];
                    const slot = parseInt(right);
                    return self.get(guildId, userId, slot);
                }
                return self.getOld(key);
            },
            save: (key, value) => {
                if (key.includes('_slot_')) {
                    const [left, right] = key.split('_slot_');
                    const leftParts = left.split('_');
                    const guildId = leftParts[0];
                    const userId = leftParts[1];
                    const slot = parseInt(right);
                    const username = self.getUsername(guildId, userId, slot) || '';
                    return self.save(guildId, userId, slot, value, username);
                }
                return self.saveOld(key, value);
            },
            remove: (key) => {
                if (key.includes('_slot_')) {
                    const [left, right] = key.split('_slot_');
                    const leftParts = left.split('_');
                    const guildId = leftParts[0];
                    const userId = leftParts[1];
                    const slot = parseInt(right);
                    return self.remove(guildId, userId, slot);
                }
                return self.removeOld(key);
            },
            has: (key) => {
                if (key.includes('_slot_')) {
                    const [left, right] = key.split('_slot_');
                    const leftParts = left.split('_');
                    const guildId = leftParts[0];
                    const userId = leftParts[1];
                    const slot = parseInt(right);
                    return self.has(guildId, userId, slot);
                }
                return self.hasOld(key);
            }
        };
    }
}

export function createTokenStore(secret) {
    const sec = secret || process.env.TOKEN_ENCRYPTION_SECRET || process.env.TOKEN_SECRET || 'default-secret';
    return new TokenStore(sec);
}

export function makeTokenStore(secret) {
    return createTokenStore(secret);
}
