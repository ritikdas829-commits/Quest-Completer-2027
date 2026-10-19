/**
 * quest.js — Quest Model Class — UPDATED with getProgress()
 * Location: src/quest/quest.js
 */
export class Quest {
    #data;

    constructor(data) {
        this.#data = data;
    }

    static create(data) {
        return new Quest(data);
    }

    get id() { return this.#data.id; }
    get config() { return this.#data.config; }
    get userStatus() { return this.#data.user_status; }
    get targetedContent() { return this.#data.targeted_content; }
    get preview() { return this.#data.preview; }

    isExpired(reference = new Date()) {
        return reference.getTime() > new Date(this.#data.config.expires_at).getTime();
    }

    isCompleted() {
        return Boolean(this.userStatus?.completed_at);
    }

    getProgress() {
        if (this.isCompleted()) return 100;

        const userStatus = this.userStatus;
        if (!userStatus) return 0;

        const tasks =
            this.config?.task_config?.tasks ??
            this.config?.task_config_v2?.tasks ??
            {};

        const taskEntries = Object.entries(tasks);

        if (taskEntries.length === 0) return 0;

        let totalProgress = 0;
        let validTasks = 0;

        for (const [taskType, taskData] of taskEntries) {
            const target = Number(taskData?.target ?? 1);

            const progress = Number(
                userStatus.details?.[taskType]?.progress ??
                userStatus.progress?.[taskType] ??
                0
            );

            if (!Number.isFinite(target) || target <= 0) continue;

            const safeProgress = Number.isFinite(progress)
                ? Math.max(0, progress)
                : 0;

            const percent = Math.min(
                100,
                (safeProgress / target) * 100
            );

            totalProgress += percent;
            validTasks++;
        }

        if (validTasks === 0) return 0;

        return Math.floor(totalProgress / validTasks);
    }

    isEnrolledQuest() {
        return Boolean(this.userStatus?.enrolled_at);
    }

    hasClaimedRewards() {
        return Boolean(this.userStatus?.claimed_at);
    }

    updateUserStatus(userStatus) {
        this.#data.user_status = userStatus;
    }
}
