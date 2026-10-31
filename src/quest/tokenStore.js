/**
 * tokenStore.js — Upgraded Multi-Slot MongoDB Token Store (Supports up to 10 Slots)
 * Location: src/quest/tokenStore.js
 */

import * as crypto from 'node:crypto';
import mongoose from 'mongoose';

const ALGORITHM = 'aes-256-gcm';

// Upgraded Schema — Supports up to 10 slots
const userTokenSchema = new mongoose.Schema({
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    slot: { type: Number, required: true, min: 1, max: 10, index: true }, // Changed max from 5 to 10
    encryptedData: { type: String, required: true },
    username: { type: String, default: '' },
    linkedUserId: { type: String, default: '' },
    avatar: { type: String, default: '' },
    isActive: { type: Boolean, default: false },
    linkedAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

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
        const activeSecret = secret || process.env.TOKEN_ENCRYPTION_SECRET || process.env.DISCORD_TOKEN;
        
        if (!activeSecret) {
            console.warn("⚠️ TokenStore secret not set - Use TOKEN_ENCRYPTION_SECRET env");
        }
        
        const finalSecret = activeSecret || 'default-secret-change-me';
        this.key = deriveKey(finalSecret);
        this.cache = new Map();
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
                    username: doc.username || '',
                    linkedUserId: doc.linkedUserId || doc.userId,
                    avatar: doc.avatar || '',
                    isActive: doc.isActive || false
                });
            }
            console.log(`🔑 Loaded ${docs.length} encrypted token(s) — ${new Set(docs.map(d=>d.guildId)).size} guilds — Multi server persistent`);
        } catch (err) {
            console.error('❌ Error loading tokens from MongoDB:', err.message);
        }
    }

    // ── ROBUST GET ACTIVE SLOT WITH CROSS-GUILD & RESTART FALLBACK ──

    async getActiveSlot(guildId, userId) {
        try {
            if (!userId) return null;
            const targetGuild = guildId || 'global';

            let activeDoc = await TokenModel.findOne({ guildId: targetGuild, userId, isActive: true });
            
            if (!activeDoc && targetGuild !== 'global') {
                activeDoc = await TokenModel.findOne({ guildId: 'global', userId, isActive: true });
            }

            if (!activeDoc) {
                activeDoc = await TokenModel.findOne({ userId, isActive: true });
            }

            if (!activeDoc) {
                activeDoc = await TokenModel.findOne({ guildId: targetGuild, userId }).sort({ slot: 1 });
            }
            if (!activeDoc && targetGuild !== 'global') {
                activeDoc = await TokenModel.findOne({ guildId: 'global', userId }).sort({ slot: 1 });
            }
            if (!activeDoc) {
                activeDoc = await TokenModel.findOne({ userId }).sort({ slot: 1 });
            }

            if (!activeDoc) return null;

            const token = decrypt(activeDoc.encryptedData, this.key);
            return {
                slot: activeDoc.slot,
                token: token,
                username: activeDoc.username,
                linkedUserId: activeDoc.linkedUserId || userId,
                isActive: activeDoc.isActive,
                guildId: activeDoc.guildId
            };
        } catch (err) {
            console.error(`❌ Error fetching active slot for [${guildId}] ${userId}:`, err.message);
            return null;
        }
    }

    async getActiveToken(guildId, userId) {
        const active = await this.getActiveSlot(guildId, userId);
        return active ? active.token : null;
    }

    async getAllSlots(guildId, userId) {
        try {
            const targetGuild = guildId || 'global';
            let docs = await TokenModel.find({ guildId: targetGuild, userId }).sort({ slot: 1 });
            if (docs.length === 0 && targetGuild !== 'global') {
                docs = await TokenModel.find({ guildId: 'global', userId }).sort({ slot: 1 });
            }
            if (docs.length === 0) {
                docs = await TokenModel.find({ userId }).sort({ slot: 1 });
            }

            return docs.map(doc => ({
                slot: doc.slot,
                username: doc.username || 'Unknown',
                linkedUserId: doc.linkedUserId || userId,
                avatar: doc.avatar || null,
                isActive: doc.isActive || false,
                linkedAt: doc.linkedAt || new Date()
            }));
        } catch (err) {
            console.error(`❌ Error getting all slots for [${guildId}] ${userId}:`, err.message);
            return [];
        }
    }

    async saveSlot({ guildId, ownerId, slot, token, linkedUserId = '', username = '', avatar = '', isActive = false }) {
        try {
            if (!ownerId || !slot) return false;
            if (slot < 1 || slot > 10) return false; // Allowed up to 10 slots

            const targetGuild = guildId || 'global';
            const userId = ownerId;
            
            if (isActive) {
                await TokenModel.updateMany({ userId }, { isActive: false });
            }

            const existingCount = await TokenModel.countDocuments({ guildId: targetGuild, userId });
            if (existingCount === 0 && !isActive) {
                isActive = true;
            }

            const encrypted = encrypt(token, this.key);
            const cacheKey = this.makeCacheKey(targetGuild, userId, slot);
            this.cache.set(cacheKey, { encryptedData: encrypted, username, linkedUserId, avatar, isActive });

            await TokenModel.findOneAndUpdate(
                { guildId: targetGuild, userId, slot },
                { encryptedData: encrypted, username, linkedUserId, avatar, isActive, linkedAt: new Date(), updatedAt: new Date() },
                { upsert: true, new: true }
            );

            console.log(`✅ Token saved [${targetGuild}] ${userId} slot ${slot} — Encrypted — Persistent`);
            return true;
        } catch (err) {
            console.error(`❌ Error saving slot [${guildId}] ${userId} slot ${slot}:`, err.message);
            return false;
        }
    }

    async removeSlot(guildId, userId, slot) {
        try {
            const targetGuild = guildId || 'global';
            const cacheKey = this.makeCacheKey(targetGuild, userId, slot);
            const existed = this.cache.has(cacheKey);
            this.cache.delete(cacheKey);
            await TokenModel.findOneAndDelete({ guildId: targetGuild, userId, slot });
            
            const remaining = await TokenModel.findOne({ userId }).sort({ slot: 1 });
            if (remaining) {
                await TokenModel.findOneAndUpdate({ guildId: remaining.guildId, userId, slot: remaining.slot }, { isActive: true });
            }

            console.log(`🗑️ Token removed [${targetGuild}] ${userId} slot ${slot}`);
            return existed;
        } catch (err) {
            console.error(`❌ Error removing slot [${guildId}] ${userId} slot ${slot}:`, err.message);
            return false;
        }
    }

    async setActiveSlot(guildId, userId, slot) {
        try {
            const targetGuild = guildId || 'global';
            await TokenModel.updateMany({ userId }, { isActive: false });
            await TokenModel.findOneAndUpdate({ guildId: targetGuild, userId, slot }, { isActive: true });
            
            for (const [key, val] of this.cache.entries()) {
                if (key.includes(`_${userId}_slot_`)) {
                    val.isActive = key === this.makeCacheKey(targetGuild, userId, slot);
                }
            }
            console.log(`⭐ Active slot set to #${slot} for [${targetGuild}] ${userId}`);
            return true;
        } catch (err) {
            console.error(`❌ Error setting active slot:`, err.message);
            return false;
        }
    }

    async save(guildId, userId, slot, token, username = '') {
        return await this.saveSlot({ guildId, ownerId: userId, slot, token, username });
    }

    async saveOld(userId, token) {
        return this.save('global', userId, 1, token);
    }

    get(guildId, userId, slot) {
        try {
            const targetGuild = guildId || 'global';
            const cacheKey = this.makeCacheKey(targetGuild, userId, slot);
            let cached = this.cache.get(cacheKey);
            
            if (!cached) {
                for (const [k, v] of this.cache.entries()) {
                    if (k.endsWith(`_${userId}_slot_${slot}`)) { cached = v; break; }
                }
            }

            if (!cached) return null;
            const raw = typeof cached === 'string' ? cached : cached.encryptedData;
            return decrypt(raw, this.key);
        } catch {
            return null;
        }
    }

    getOld(userId) {
        return this.get('global', userId, 1);
    }

    getUsername(guildId, userId, slot) {
        const targetGuild = guildId || 'global';
        const cacheKey = this.makeCacheKey(targetGuild, userId, slot);
        const cached = this.cache.get(cacheKey);
        if (!cached) return '';
        return cached.username || '';
    }

    async remove(guildId, userId, slot) {
        return await this.removeSlot(guildId, userId, slot);
    }

    async removeOld(userId) {
        return this.remove('global', userId, 1);
    }

    has(guildId, userId, slot) {
        const targetGuild = guildId || 'global';
        const cacheKey = this.makeCacheKey(targetGuild, userId, slot);
        if (this.cache.has(cacheKey)) return true;
        
        for (const k of this.cache.keys()) {
            if (k.endsWith(`_${userId}_slot_${slot}`)) return true;
        }
        return false;
    }

    hasOld(userId) {
        return this.has('global', userId, 1);
    }

    getUserSlots(guildId, userId) {
        const slots = [];
        for (let i = 1; i <= 10; i++) { // Support up to 10 slots
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
}

export function createTokenStore(secret) {
    const sec = secret || process.env.TOKEN_ENCRYPTION_SECRET || process.env.DISCORD_TOKEN || 'default-secret';
    return new TokenStore(sec);
}

export function makeTokenStore(secret) {
    return createTokenStore(secret);
}
