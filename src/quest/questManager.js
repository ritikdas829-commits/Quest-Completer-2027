import { Quest } from './quest.js';

const EXCLUDED_QUEST_ID = '1412491570820812933';

const SUPPORTED_TASK_TYPES = new Set([
    'WATCH_VIDEO',
    'PLAY_ON_DESKTOP',
    'STREAM_ON_DESKTOP',
    'PLAY_ACTIVITY',
    'WATCH_VIDEO_ON_MOBILE',
]);

function getQuestArray(response) {
    if (Array.isArray(response)) {
        return response;
    }

    const quests = response?.quests ?? response?.items;

    return Array.isArray(quests) ? quests : null;
}

function isExpiredError(error) {
    return (
        Number(error?.code) === 260017 ||
        /quest has expired/i.test(
            String(error?.message ?? error),
        )
    );
}

function extractStatus(response) {
    if (
        response &&
        typeof response === 'object' &&
        response.user_status &&
        typeof response.user_status === 'object'
    ) {
        return response.user_status;
    }

    return response;
}

function safeLog(log, message) {
    try {
        log(message);
    } catch {
        // A logging failure must not break quest handling.
    }
}

export class QuestManager {
    #quests = new Map();

    client;

    constructor(client, quests = []) {
        this.client = client;

        for (const quest of quests) {
            if (quest?.id) {
                this.#quests.set(quest.id, quest);
            }
        }
    }

    // ------------------------------------------
    // CREATE / COLLECTION
    // ------------------------------------------

    static fromResponse(client, response) {
        const quests = getQuestArray(response);

        if (!quests) {
            throw new Error(
                'INVALID_RESPONSE: Quest list is missing.',
            );
        }

        return new QuestManager(
            client,
            quests.map((item) => Quest.create(item)),
        );
    }

    [Symbol.iterator]() {
        return this.#quests.values();
    }

    get size() {
        return this.#quests.size;
    }

    list() {
        return Array.from(this.#quests.values());
    }

    get(id) {
        return this.#quests.get(id);
    }

    hasQuest(id) {
        return this.#quests.has(id);
    }

    upsert(quest) {
        if (!quest?.id) {
            throw new Error('INVALID_QUEST: Quest ID is required.');
        }

        this.#quests.set(quest.id, quest);
        return quest;
    }

    remove(id) {
        return this.#quests.delete(id);
    }

    clear() {
        this.#quests.clear();
    }

    // ------------------------------------------
    // FILTERS
    // ------------------------------------------

    getExpired(date = new Date()) {
        return this.list().filter(
            (quest) => quest.isExpired(date),
        );
    }

    getCompleted() {
        return this.list().filter(
            (quest) => quest.isCompleted(),
        );
    }

    getClaimable() {
        return this.list().filter(
            (quest) =>
                quest.isCompleted() &&
                !quest.hasClaimedRewards() &&
                !quest.isExpired(),
        );
    }

    filterQuestsValid() {
        return this.list().filter(
            (quest) =>
                quest.id !== EXCLUDED_QUEST_ID &&
                !quest.isCompleted() &&
                !quest.isExpired(),
        );
    }

    // ------------------------------------------
    // REFRESH SERVER STATUS
    // ------------------------------------------

    async refreshStatuses() {
        const response = await this.client.get('/quests/@me');
        const quests = getQuestArray(response);

        if (!quests) {
            throw new Error(
                'INVALID_RESPONSE: Unable to read quest statuses.',
            );
        }

        const receivedIds = new Set();

        for (const item of quests) {
            if (!item?.id) continue;

            receivedIds.add(item.id);

            const existing = this.#quests.get(item.id);

            if (existing) {
                if (item.user_status) {
                    existing.updateUserStatus(item.user_status);
                }
            } else {
                this.#quests.set(item.id, Quest.create(item));
            }
        }

        return {
            refreshed: true,
            received: receivedIds.size,
        };
    }

    async #refreshOne(quest) {
        try {
            await this.refreshStatuses();

            return {
                success: true,
                quest: this.get(quest.id) ?? quest,
            };
        } catch (error) {
            return {
                success: false,
                quest,
                error,
            };
        }
    }

    // ------------------------------------------
    // CLAIM STATUS
    // ------------------------------------------

    async claimRewards(log = console.log, targetQuestId = null) {
        if (typeof log !== 'function') {
            log = console.log;
        }

        try {
            await this.refreshStatuses();
        } catch (error) {
            safeLog(
                log,
                `[Claim] Could not refresh server status: ${error.message}`,
            );

            return 0;
        }

        const claimable = this.getClaimable().filter(
            (quest) =>
                !targetQuestId || quest.id === targetQuestId,
        );

        if (!claimable.length) {
            safeLog(
                log,
                '[Claim] No verified, unexpired claimable quest found.',
            );

            return 0;
        }

        let confirmedCount = 0;

        for (const quest of claimable) {
            const name =
                quest.config?.messages?.quest_name || quest.id;

            if (
                quest.isExpired() ||
                !quest.isCompleted() ||
                quest.hasClaimedRewards()
            ) {
                safeLog(
                    log,
                    `[Claim] "${name}" is no longer eligible.`,
                );

                continue;
            }

            try {
                await this.client.post(
                    `/quests/${encodeURIComponent(quest.id)}/claim-reward`,
                );
            } catch (error) {
                safeLog(
                    log,
                    isExpiredError(error)
                        ? `[Claim] "${name}" has expired.`
                        : `[Claim] Request failed for "${name}": ${error.message}`,
                );

                continue;
            }

            const refreshed = await this.#refreshOne(quest);

            if (!refreshed.success) {
                safeLog(
                    log,
                    `[Claim] Could not verify the claim for "${name}".`,
                );

                continue;
            }

            if (refreshed.quest.hasClaimedRewards()) {
                confirmedCount++;

                safeLog(
                    log,
                    `[Claim] Server status confirms claimed: "${name}".`,
                );
            } else {
                safeLog(
                    log,
                    `[Claim] Reward status is unconfirmed for "${name}".`,
                );
            }
        }

        return confirmedCount;
    }

    // ------------------------------------------
    // ENROLLMENT
    // ------------------------------------------

    async acceptQuest(questId) {
        const quest = this.get(questId);

        if (!quest) {
            throw new Error('QUEST_NOT_FOUND');
        }

        if (quest.isExpired()) {
            throw new Error('QUEST_EXPIRED');
        }

        if (quest.isEnrolledQuest()) {
            return quest;
        }

        const response = await this.client.post(
            `/quests/${encodeURIComponent(questId)}/enroll`,
            {
                location: 11,
                is_targeted: false,
                metadata_raw: null,
            }
        );

        const status = extractStatus(response);

        if (
            status &&
            typeof status === 'object' &&
            !Array.isArray(status)
        ) {
            quest.updateUserStatus(status);
        }

        const refreshed = await this.#refreshOne(quest);

        if (!refreshed.success) {
            throw new Error(
                'ENROLLMENT_UNVERIFIED: Could not refresh quest status.',
            );
        }

        if (!refreshed.quest.isEnrolledQuest()) {
            throw new Error(
                'ENROLLMENT_UNVERIFIED: Server status does not confirm enrollment.',
            );
        }

        return refreshed.quest;
    }

    // ------------------------------------------
    // TASK EXECUTION
    // ------------------------------------------

    async doingQuest(quest, log = console.log) {
        if (typeof log !== 'function') {
            log = console.log;
        }

        if (!quest) {
            safeLog(log, '[Quest] Quest was not found.');
            return false;
        }

        const name =
            quest.config?.messages?.quest_name || quest.id;

        const refreshed = await this.#refreshOne(quest);

        if (!refreshed.success) {
            safeLog(
                log,
                `[Quest] Could not refresh "${name}": ${refreshed.error.message}`,
            );

            return false;
        }

        quest = refreshed.quest;

        if (quest.isExpired()) {
            safeLog(
                log,
                `[Quest] "${name}" has expired. Not starting.`,
            );

            return false;
        }

        if (quest.hasClaimedRewards()) {
            safeLog(
                log,
                `[Quest] "${name}" is already claimed.`,
            );

            return true;
        }

        if (quest.isCompleted()) {
            safeLog(
                log,
                `[Quest] "${name}" is completed. Reward claim status is separate.`,
            );

            return true;
        }

        // Auto-enroll if not enrolled
        if (!quest.isEnrolledQuest()) {
            safeLog(log, `[Quest] Enrolling in "${name}"...`);
            try {
                quest = await this.acceptQuest(quest.id);
            } catch (error) {
                safeLog(
                    log,
                    `[Quest] Enrollment failed for "${name}": ${error.message}`
                );
                return false;
            }
        }

        const taskConfig =
            quest.config?.task_config ??
            quest.config?.task_config_v2;

        const tasks = taskConfig?.tasks;

        if (!tasks || typeof tasks !== 'object') {
            safeLog(
                log,
                `[Quest] "${name}" has no task configuration.`,
            );

            return false;
        }

        const taskTypes = Object.keys(tasks);

        safeLog(
            log,
            `[Quest] Task types: ${taskTypes.join(', ') || 'none'}`,
        );

        // Find active supported task
        const taskName = taskTypes.find((type) => SUPPORTED_TASK_TYPES.has(type));

        if (!taskName) {
            safeLog(
                log,
                `[Quest] "${name}" has no supported task type.`,
            );

            return false;
        }

        // ------------------------------------------
        // VIDEO / MOBILE VIDEO PROGRESSION
        // ------------------------------------------
        if (
            taskName === 'WATCH_VIDEO' ||
            taskName === 'WATCH_VIDEO_ON_MOBILE'
        ) {
            safeLog(log, `[Quest] Sending video progress for "${name}"...`);

            const task = tasks[taskName];
            const target = Number(task?.target ?? 30);

            try {
                // Send video progress request
                const progressRes = await this.client.post(
                    `/quests/${encodeURIComponent(quest.id)}/video-progress`,
                    { timestamp: target }
                );

                const status = extractStatus(progressRes);

                if (status) {
                    quest.updateUserStatus(status);
                }

                // Verify status after sending progress
                const doubleCheck = await this.#refreshOne(quest);

                if (doubleCheck.quest.isCompleted()) {
                    safeLog(
                        log,
                        `[Quest] "${name}" completion confirmed by server!`,
                    );
                    return true;
                }

                safeLog(
                    log,
                    `[Quest] Progress sent, but completion is not yet confirmed by server.`,
                );
                return false;
            } catch (error) {
                safeLog(
                    log,
                    isExpiredError(error)
                        ? `[Quest] "${name}" has expired.`
                        : `[Quest] Video progress request failed: ${error.message}`
                );
                return false;
            }
        }

        // For desktop/stream/activity tasks that require actual application client
        safeLog(
            log,
            `[Quest] Task type "${taskName}" requires native Discord client activity.`,
        );

        return false;
    }
}
