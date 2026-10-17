import mongoose from 'mongoose';

const schema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    roles: {
        ROLE_2_INVITES: { type: String, default: null },
        ROLE_5_INVITES: { type: String, default: null },
        ROLE_1_BOOST: { type: String, default: null },
        ROLE_2_BOOST: { type: String, default: null },
    },
    updatedAt: { type: Date, default: Date.now }
});

export default mongoose.models.RoleConfig || mongoose.model('RoleConfig', schema);

