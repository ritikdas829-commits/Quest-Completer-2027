/**
 * questRunner.js — Single Quest Execution & Safe Claim Logic (With Auto-Token Removal)
 * Location: src/quest/questRunner.js
 */

import { QuestClient } from './questClient.js';

export async function getActiveToken(guildId, userId, tokenStore) {
    if (!tokenStore) return null;

    const active = await tokenStore.getActiveSlot(guildId, userId);
    if (!active) return null;

    const token =
        active.token ||
        await tokenStore.get(guildId, userId, active.slot);

    return typeof token === 'string'
        ? token.trim().replace(/^['"]|['"]$/g, '')
        : token;
}

function isExpiredError(error) {
    return (
        Number(error?.code) === 260017 ||
        /quest has expired/i.test(String(error?.message ?? error))
    );
}

// 🛡️ Helper to check if token is invalid or unauthorized (expired / revoked / bad token)
function isInvalidTokenError(error) {
    const msg = String(error?.message ?? error).toLowerCase();
    const status = Number(error?.status || error?.statusCode || error?.code);
    return (
        status === 401 ||
        status === 403 ||
        msg.includes('unauthorized') ||
        msg.includes('invalid token') ||
        msg.includes('token expired')
    );
}

export async function runSingleQuest(
    guildId,
    userId,
    questId,
    tokenStore,
    logFn = console.log
) {
    const logs = [];

    const log = (message) => {
        const text = String(message);
        logs.push(text);
        logFn(text);
    };

    const result = (status, extra = {}) => ({
        success: false,
        claimed: false,
        status,
        logs,
        ...extra,
    });

    try {
        const activeSlotData = tokenStore ? await tokenStore.getActiveSlot(guildId, userId) : null;
        const token = await getActiveToken(
            guildId,
            userId,
            tokenStore
        );

        if (!token) {
            log('[Quest] No active token.');
            return result('no_token');
        }

        let client;
        let manager;

        try {
            client = new QuestClient(token);
            manager = await client.fetchQuests();
        } catch (error) {
            // If token itself is invalid/unauthorized on fetch, auto-remove it!
            if (isInvalidTokenError(error) && activeSlotData) {
                log(`[Auth] Token for slot #${activeSlotData.slot} is invalid or expired. Auto-removing from store.`);
                await tokenStore.removeSlot(guildId, userId, activeSlotData.slot);
                return result('token_invalid', { error: 'Token expired or invalid. Automatically removed from slot.' });
            }
            throw error;
        }

        const quest =
            manager.get(questId) ??
            manager.filterQuestsValid().find(
                (item) => item.id === questId
            );

        if (!quest) {
            log('[Quest] Quest not found or unavailable.');
            return result('not_found');
        }

        // Step 1: Execute the quest.
        let done;

        try {
            done = await manager.doingQuest(quest, log);
        } catch (error) {
            if (isExpiredError(error)) {
                log('[Quest] Quest expired. Execution stopped.');
                return result('expired', { quest });
            }

            if (isInvalidTokenError(error) && activeSlotData) {
                log(`[Auth] Token unauthorized during quest execution. Auto-removing slot #${activeSlotData.slot}.`);
                await tokenStore.removeSlot(guildId, userId, activeSlotData.slot);
                return result('token_invalid', { quest, error: 'Token became invalid. Slot auto-removed.' });
            }

            log(`[Quest] Execution failed: ${error.message}`);
            return result('failed', {
                quest,
                error: String(error?.message ?? error),
            });
        }

        if (done !== true) {
            log('[Quest] Completion not confirmed; claim skipped.');
            return result('unconfirmed', { quest });
        }

        // Step 2: Attempt the reward claim.
        let claimResult;

        try {
            claimResult = await manager.claimRewards(log, quest.id);
        } catch (error) {
            if (isExpiredError(error)) {
                log('[Quest] Server reports that the quest expired.');
                return result('expired', { quest });
            }

            if (isInvalidTokenError(error) && activeSlotData) {
                log(`[Auth] Token unauthorized during claim. Auto-removing slot #${activeSlotData.slot}.`);
                await tokenStore.removeSlot(guildId, userId, activeSlotData.slot);
                return result('token_invalid', { quest, error: 'Token expired during claim. Slot auto-removed.' });
            }

            log(`[Quest] Claim failed: ${error.message}`);
            return result('claim_failed', {
                quest,
                error: String(error?.message ?? error),
            });
        }

        const claimed =
            typeof claimResult === 'number' &&
            Number.isFinite(claimResult) &&
            claimResult > 0;

        if (!claimed) {
            log('[Quest] Reward claim is unverified.');
            return result('claim_unverified', {
                quest,
                claimResult,
            });
        }

        log('[Quest] Reward claim confirmed by claimRewards().');

        return {
            success: true,
            claimed: true,
            status: 'claimed',
            logs,
            quest,
            claimResult,
        };
    } catch (error) {
        log(`[Quest] Unexpected error: ${error.message}`);

        return result('failed', {
            error: String(error?.message ?? error),
        });
    }
}
