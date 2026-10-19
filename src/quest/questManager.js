
import { Quest } from './quest.js';

const QuestTaskConfigType = {
    WATCH_VIDEO: 'WATCH_VIDEO',
    PLAY_ON_DESKTOP: 'PLAY_ON_DESKTOP',
    STREAM_ON_DESKTOP: 'STREAM_ON_DESKTOP',
    PLAY_ACTIVITY: 'PLAY_ACTIVITY',
    WATCH_VIDEO_ON_MOBILE: 'WATCH_VIDEO_ON_MOBILE',
};

export class QuestManager {
    #quests = new Map();
    client;

    constructor(client, quests = []) {
        this.client = client;
        quests.forEach((quest) => this.#quests.set(quest.id, quest));
    }

    static fromResponse(client, response) {
        const questsArray = Array.isArray(response)
            ? response
            : (response?.quests || response?.items || []);

        return new QuestManager(
            client,
            questsArray.map((quest) => Quest.create(quest)),
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

    upsert(quest) {
        this.#quests.set(quest.id, quest);
    }

    remove(id) {
        return this.#quests.delete(id);
    }

    clear() {
        this.#quests.clear();
    }

    hasQuest(id) {
        return this.#quests.has(id);
    }

    getExpired(date = new Date()) {
        return this.list().filter((quest) => quest.isExpired(date));
    }

    getCompleted() {
        return this.list().filter((quest) => quest.isCompleted());
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
                quest.id !== '1412491570820812933' &&
                !quest.isCompleted() &&
                !quest.isExpired(),
        );
    }

    async claimRewards(log = console.log, targetQuestId = null) {
        const writeLog = (message) => {
            log(message);
        };

        // Refresh status before attempting any claim.
        try {
            const fresh = await this.client.get('/quests/@me');
            const freshQuests = Array.isArray(fresh)
                ? fresh
                : (fresh?.quests || fresh?.items || []);

            for (const item of freshQuests) {
                const existing = this.#quests.get(item.id);

                if (existing && item.user_status) {
                    existing.updateUserStatus(item.user_status);
                }
            }
        } catch (error) {
            writeLog(
                `[Claim] Could not refresh quest status: ${error.message}`,
            );

            // Do not claim using potentially stale state.
            return 0;
        }

        const claimable = this.getClaimable().filter(
            (quest) => !targetQuestId || quest.id === targetQuestId,
        );

        if (!claimable.length) {
            writeLog('[Claim] No verified, unexpired claimable quest found.');
            return 0;
        }

        let confirmedCount = 0;

        for (const quest of claimable) {
            const name =
                quest.config?.messages?.quest_name || quest.id;

            try {
                const response = await this.client.post(
                    `/quests/${quest.id}/claim-reward`,
                );

                /*
                 * A non-throwing response alone does not prove that the
                 * reward was granted. Refresh and inspect server status.
                 */
                const fresh = await this.client.get('/quests/@me');
                const freshQuests = Array.isArray(fresh)
                    ? fresh
                    : (fresh?.quests || fresh?.items || []);

                const updated = freshQuests.find(
                    (item) => item.id === quest.id,
                );

                if (updated?.user_status) {
                    quest.updateUserStatus(updated.user_status);
                }

                if (quest.hasClaimedRewards()) {
                    confirmedCount++;
                    writeLog(
                        `[Claim] Server status confirms claimed: "${name}".`,
                    );
                } else {
                    writeLog(
                        `[Claim] Claim not verified for "${name}". ` +
                        'The refreshed status does not confirm a claim.',
                    );
                }
            } catch (error) {
                if (isExpiredError(error)) {
                    writeLog(
                        `[Claim] "${name}" has expired; claim stopped.`,
                    );
                } else {
                    writeLog(
                        `[Claim] Failed for "${name}": ${error.message}`,
                    );
                }
            }
        }

        return confirmedCount;
    }

    async acceptQuest(questId) {
        const quest = this.get(questId);

        if (!quest) {
            throw new Error('QUEST_NOT_FOUND');
        }

        if (quest.isExpired()) {
            throw new Error('QUEST_EXPIRED');
        }

        const response = await this.client.post(
            `/quests/${questId}/enroll`,
            {
                location: 11,
                is_targeted: false,
                metadata_raw: null,
            },
        );

        quest.updateUserStatus(extractStatus(response));
        return quest;
    }

    #timeout(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    async #refreshQuestStatus(quest) {
        try {
            const fresh = await this.client.get('/quests/@me');
            const freshQuests = Array.isArray(fresh)
                ? fresh
                : (fresh?.quests || fresh?.items || []);

            const updated = freshQuests.find(
                (item) => item.id === quest.id,
            );

            if (updated?.user_status) {
                quest.updateUserStatus(updated.user_status);
            }

            return Boolean(updated);
        } catch {
            return false;
        }
    }

    async doingQuest(quest, log = console.log) {
        const name =
            quest.config?.messages?.quest_name || quest.id;

        if (quest.isExpired()) {
            log(`[Quest] "${name}" has expired. Not starting.`);
            return false;
        }

        if (quest.isCompleted()) {
            log(`[Quest] "${name}" is already marked completed.`);
            return true;
        }

        if (!quest.isEnrolledQuest()) {
            log(`[Quest] Enrolling in "${name}"...`);

            try {
                await this.acceptQuest(quest.id);
            } catch (error) {
                if (isExpiredError(error)) {
                    log(`[Quest] "${name}" has expired.`);
                } else {
                    log(`[Quest] Enrollment failed: ${error.message}`);
                }

                return false;
            }
        }

        if (quest.isExpired()) {
            log(`[Quest] "${name}" expired before execution.`);
            return false;
        }

        const taskConfig =
            quest.config.task_config ??
            quest.config.task_config_v2;

        if (!taskConfig) {
            log(`[FAIL] "${name}": task configuration is missing.`);
            return false;
        }

        const tasks = taskConfig.tasks ?? {};
        const taskKeys = Object.keys(tasks);

        log(`[INFO] "${name}": task keys = [${taskKeys.join(', ')}]`);

        const taskName = Object.values(QuestTaskConfigType).find(
            (type) => tasks[type] != null,
        );

        if (!taskName) {
            log(`[FAIL] "${name}": no supported task type found.`);
            return false;
        }

        const task = tasks[taskName];
        const target = Number(task.target);
        const eventName = task.event_name ?? task.type ?? taskName;

        if (!Number.isFinite(target) || target <= 0) {
            log(`[FAIL] "${name}": invalid task target.`);
            return false;
        }

        if (
            taskName === 'WATCH_VIDEO' ||
            taskName === 'WATCH_VIDEO_ON_MOBILE'
        ) {
            /*
             * This branch only reports completion after the server
             * response or refreshed quest status confirms it.
             */
            let lastResponse = null;

            try {
                lastResponse = await this.client.post(
                    `/quests/${quest.id}/video-progress`,
                    { timestamp: target },
                );
            } catch (error) {
                if (isExpiredError(error)) {
                    log(`[Quest] "${name}" has expired.`);
                } else {
                    log(`[Quest] Progress request failed: ${error.message}`);
                }

                return false;
            }

            if (
                lastResponse?.user_status
            ) {
                quest.updateUserStatus(lastResponse.user_status);
            }

            await this.#refreshQuestStatus(quest);

            if (
                lastResponse?.completed_at ||
                lastResponse?.user_status?.completed_at ||
                quest.isCompleted()
            ) {
                log(`[Quest] "${name}" completion confirmed by server.`);
                return true;
            }

            log(`[Quest] "${name}" completion is not confirmed.`);
            return false;
        }

        if (taskName === 'PLAY_ON_DESKTOP') {
            log(
                `[Quest] "${name}" needs to be completed through ` +
                'the supported Discord desktop experience.',
            );

            return false;
        }

        if (taskName === 'STREAM_ON_DESKTOP') {
            log(
                `[Quest] "${name}" requires the supported desktop streaming experience.`,
            );

            return false;
        }

        if (taskName === 'PLAY_ACTIVITY') {
            log(
                `[Quest] "${name}" requires the supported Discord activity.`,
            );

            return false;
        }

        log(`[Quest] Unsupported task type: ${taskName}`);
        return false;
    }
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
        response.user_status
    ) {
        return response.user_status;
    }

    return response;
}

function readProgress(quest, eventName, taskName) {
    const progress = quest.userStatus?.progress;

    if (!progress) return 0;

    const byEvent = eventName
        ? progress[eventName]?.value
        : undefined;

    const byTask = progress[taskName]?.value;

    return Number(byEvent ?? byTask ?? 0) || 0;
}
