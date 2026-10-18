/**
 * questRunner.js — Single Quest Execution & Safe Claim Logic
 * Location: src/quest/questRunner.js
 */

import { QuestClient } from './questClient.js';

/**
 * Fetch active token for the user from tokenStore
 */
export async function getActiveToken(guildId, userId, tokenStore) {
    if (!tokenStore) return null;
    const active = await tokenStore.getActiveSlot(guildId, userId);
    if (!active) return null;
    return active.token || await tokenStore.get(guildId, userId, active.slot);
}

/**
 * Executes a single quest for a given user and attempts to claim rewards
 */
export async function runSingleQuest(guildId, userId, questId, tokenStore, logFn = console.log) {
    const token = await getActiveToken(guildId, userId, tokenStore);
    if (!token) throw new Error('NO_TOKEN');

    const qc = new QuestClient(token);
    const manager = await qc.fetchQuests();
    const quest = manager.get(questId) || manager.filterQuestsValid().find(q => q.id === questId);

    if (!quest) throw new Error('QUEST_NOT_FOUND');

    const logs = [];
    const log = (m) => { logs.push(m); logFn(m); };

    // Execute quest progression
    const done = await manager.doingQuest(quest, log);
    if (!done) return { success: false, logs, quest };

    // Claim rewards specifically for this targeted quest ID
    const claimed = await manager.claimRewards(log, quest.id).catch(() => 0);
    return { success: true, claimed: claimed > 0, logs, quest };
}
