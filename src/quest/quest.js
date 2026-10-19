
/**
 * quest.js — Quest Model Class
 * Location: src/quest/quest.js
 *
 * Features:
 * - Quest status management
 * - Task progress calculation
 * - Multiple progress data formats
 * - Enrollment, expiration and reward status
 */

export class Quest {
    #data;

    constructor(data) {
        this.#data = data;
    }

    static create(data) {
        return new Quest(data);
    }

    get id() {
        return this.#data.id;
    }

    get config() {
        return this.#data.config ?? {};
    }

    get userStatus() {
        return this.#data.user_status ?? null;
    }

    get targetedContent() {
        return this.#data.targeted_content;
    }

    get preview() {
        return this.#data.preview;
    }

    isExpired(reference = new Date()) {
        const expiresAt = this.config?.expires_at;

        if (!expiresAt) return false;

        const expiry = new Date(expiresAt).getTime();

        if (!Number.isFinite(expiry)) return false;

        return reference.getTime() > expiry;
    }

    isCompleted() {
        return Boolean(this.userStatus?.completed_at);
    }

    isEnrolledQuest() {
        return Boolean(this.userStatus?.enrolled_at);
    }

    hasClaimedRewards() {
        return Boolean(this.userStatus?.claimed_at);
    }

    /**
     * Get progress percentage for one task.
     */
    getTaskProgress(taskType, taskConfig = {}) {
        if (this.isCompleted()) return 100;

        const status = this.userStatus;

        if (!status) return 0;

        const target = Number(taskConfig?.target ?? 1);

        if (!Number.isFinite(target) || target <= 0) {
            return 0;
        }

        const eventName =
            taskConfig?.event_name ??
            taskConfig?.type ??
            taskType;

        const progress = status.progress ?? {};
        const details = status.details ?? {};

        const candidates = [
            details[taskType]?.progress,
            details[taskType]?.value,
            details[eventName]?.progress,
            details[eventName]?.value,

            progress[eventName]?.value,
            progress[eventName]?.progress,
            progress[eventName],

            progress[taskType]?.value,
            progress[taskType]?.progress,
            progress[taskType],
        ];

        let current = 0;

        for (const candidate of candidates) {
            if (candidate === undefined || candidate === null) {
                continue;
            }

            const rawValue =
                typeof candidate === 'object'
                    ? candidate.value ?? candidate.progress
                    : candidate;

            if (rawValue === undefined || rawValue === null) {
                continue;
            }

            const number = Number(rawValue);

            if (Number.isFinite(number)) {
                current = Math.max(0, number);
                break;
            }
        }

        // Support a separate stream-progress field if present.
        if (
            taskType === 'STREAM_ON_DESKTOP' &&
            status.stream_progress_seconds != null
        ) {
            const streamProgress = Number(
                status.stream_progress_seconds
            );

            if (Number.isFinite(streamProgress)) {
                current = Math.max(current, streamProgress);
            }
        }

        return Math.min(
            100,
            Math.floor((current / target) * 100)
        );
    }

    /**
     * Estimate overall quest progress using the average
     * of its task percentages.
     *
     * This is an estimate, not Discord's confirmed
     * internal overall-progress calculation.
     */
    getProgress() {
        if (this.isCompleted()) return 100;

        const tasks =
            this.config?.task_config?.tasks ??
            this.config?.task_config_v2?.tasks ??
            {};

        const entries = Object.entries(tasks);

        if (!entries.length) return 0;

        let total = 0;
        let count = 0;

        for (const [taskType, taskConfig] of entries) {
            const percentage = this.getTaskProgress(
                taskType,
                taskConfig
            );

            total += percentage;
            count++;
        }

        return count
            ? Math.floor(total / count)
            : 0;
    }

    /**
     * Update quest status from a fresh API response.
     */
    updateUserStatus(userStatus) {
        if (!userStatus || typeof userStatus !== 'object') {
            return;
        }

        this.#data.user_status = userStatus;
    }
}
