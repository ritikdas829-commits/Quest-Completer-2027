/**
 * autoquestRunner.js — Background AutoQuest Checker & Runner
 * Location: src/quest/autoquestRunner.js
 */

import { getAutoquestUsers } from './autoquestStore.js';
import { runAutoquestForUser } from './questExecution.js';

export async function checkAndRunAutoquests(client, guildId, prefix = ';') {
    const userIds = getAutoquestUsers();
    if (!userIds || userIds.length === 0) return;

    // Fetch active quests using a dummy client or active slots
    try {
        const tokenStore = client.tokenStore;
        if (!tokenStore) return;

        // Example check: fetch latest quests from Discord API via a general method or helper
        // (Assuming client has a global quest fetcher or we check per user slot)
        for (const userId of userIds) {
            const active = await tokenStore.getActiveSlot(guildId, userId);
            if (!active) continue;
            
            const token = active.token || await tokenStore.get(guildId, userId, active.slot);
            if (!token) continue;

            const { QuestClient } = await import('./questClient.js');
            const qc = new QuestClient(token);
            const manager = await qc.fetchQuests();
            const validQuests = manager.filterQuestsValid();

            for (const quest of validQuests) {
                // Run autoquest for uncompleted valid quests
                await runAutoquestForUser(userId, quest, tokenStore, client, guildId, prefix);
            }
        }
    } catch (err) {
        console.error('[AutoQuestRunner] Error checking quests:', err.message);
    }
}
