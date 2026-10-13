import * as crypto from 'node:crypto';
import mongoose from 'mongoose';

const ALGORITHM = 'aes-256-gcm';

// Mongoose Schema for encrypted tokens in MongoDB
const userTokenSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    encryptedData: { type: String, required: true },
    linkedAt: { type: Date, default: Date.now }
});

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
        this.key = deriveKey(secret);
        this.cache = new Map();
        this.loadIntoCache();
    }

    async loadIntoCache() {
        try {
            const docs = await TokenModel.find({});
            for (const doc of docs) {
                this.cache.set(doc.userId, doc.encryptedData);
            }
            console.log(`🔑 Loaded ${this.cache.size} encrypted token(s) into memory cache.`);
        } catch (err) {
            console.error('❌ Error loading tokens from MongoDB:', err);
        }
    }

    async save(userId, token) {
        const encrypted = encrypt(token, this.key);
        this.cache.set(userId, encrypted);
        try {
            await TokenModel.findOneAndUpdate(
                { userId },
                { encryptedData: encrypted, linkedAt: new Date() },
                { upsert: true, new: true }
            );
        } catch (err) {
            console.error(`❌ Error saving token for user ${userId}:`, err);
        }
    }

    get(userId) {
        const raw = this.cache.get(userId);
        if (!raw) return null;
        return decrypt(raw, this.key);
    }

    async remove(userId) {
        const existed = this.cache.has(userId);
        this.cache.delete(userId);
        try {
            await TokenModel.findOneAndDelete({ userId });
        } catch (err) {
            console.error(`❌ Error removing token for user ${userId}:`, err);
        }
        return existed;
    }

    has(userId) {
        return this.cache.has(userId);
    }

    get size() {
        return this.cache.size;
    }

    listUserIds() {
        return Array.from(this.cache.keys());
    }
}
