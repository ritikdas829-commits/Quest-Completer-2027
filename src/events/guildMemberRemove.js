/**
 * guildMemberRemove.js — Handles Member Leaves & Invite Tracking Updates
 * Location: src/events/guildMemberRemove.js
 */

import { Events } from 'discord.js';
import { handleInviteLeave } from '../handlers/inviteTracker.js';

export default {
    name: Events.GuildMemberRemove,
    once: false,
    async execute(member) {
        try {
            await handleInviteLeave(member);
        } catch (err) {
            console.error('❌ Error in guildMemberRemove event:', err);
        }
    }
};
