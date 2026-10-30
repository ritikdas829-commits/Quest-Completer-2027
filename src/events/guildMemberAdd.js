/**
 * guildMemberAdd.js — Handles Member Joins & Invite Tracking
 * Location: src/events/guildMemberAdd.js
 */

import { Events } from 'discord.js';
import { handleInviteJoin } from '../handlers/inviteTracker.js';

export default {
    name: Events.GuildMemberAdd,
    once: false,
    async execute(member) {
        try {
            await handleInviteJoin(member);
        } catch (err) {
            console.error('❌ Error in guildMemberAdd event:', err);
        }
    }
};
