/**
 * questCommands.js - QuestAll, QuestList, TokenCheck, AutoQuest Runner Support, Live % Tracker & 'q' Shortcut
 * Location: src/commands/questCommands.js
 */

import {
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
    SectionBuilder, ThumbnailBuilder, MessageFlags, SlashCommandBuilder
} from 'discord.js';
import { QuestClient } from '../quest/questClient.js';
import { disableAutoquest } from '../quest/autoquestStore.js';
import { PREFIX } from '../utils/config.js';
import { getEmojis } from '../quest/emoji.js';

// ── Helper: Get active token for user from 5-Slot Store ────────────────────
async function getActiveToken(guildId, userId, tokenStore) {
    if (!tokenStore) return null;
    const active = await tokenStore.getActiveSlot(guildId, userId);
    if (!active) return null;
    return active.token || await tokenStore.get(guildId, userId, active.slot);
}

// ── Helper: Safe Thumbnail Asset Extractor with Fixed Template Literal ────
function getThumbUrl(cfg, questId) {
    if (!cfg || !questId) return null;
    const assets = cfg.assets || {};
    const keys = ['hero', 'quest_bar_hero', 'game_tile', 'logotype'];

    for (const key of keys) {
        const raw = assets[key];
        if (!raw || typeof raw !== 'string') continue;
        const asset = raw.trim();
        if (!asset) continue;

        if (asset.startsWith('http')) return asset;
        if (asset.startsWith('quests/')) return `https://cdn.discordapp.com/${asset}`;
        return `https://cdn.discordapp.com/quests/${questId}/${asset}`;
    }
    return null;
}

// ── UI Cards with 100% Dynamic Custom Emojis ──────────────────────────────

async function buildLinkPrompt(prefix, guildId = 'global') {
    const EMOJI = await getEmojis(guildId);
    const c = new ContainerBuilder().setAccentColor(0xFEE75C);
    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `# ${EMOJI.link || '🔗'} Token Required\nYou need to link your Discord token in a slot before using quest commands.\n\nUse \`${prefix}link\` to open your 5-slot account panel and link a token.`,
        ),
    );
    return { components: [c], flags: MessageFlags.IsComponentsV2 };
}

async function buildNoQuestsCard(guildId = 'global') {
    const EMOJI = await getEmojis(guildId);
    const c = new ContainerBuilder().setAccentColor(0x4F545C);
    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `# ${EMOJI.search || '🔍'} No Quests Available\n\n` +
            `${EMOJI.list || '📑'} There are no active, uncompleted quests on your active slot account right now.\n\n` +
            `${EMOJI.gear || '⚙️'} New quests drop periodically — check back later!\n\n` +
            `-# ${EMOJI.bell || '🔔'} Use \`${PREFIX}autoquest\` to auto-complete quests when they drop`
        ),
    );
    return { components: [c], flags: MessageFlags.IsComponentsV2 };
}

async function buildExpiredTokenCard(prefix, guildId = 'global') {
    const EMOJI = await getEmojis(guildId);
    const c = new ContainerBuilder().setAccentColor(0xED4245);
    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `# ${EMOJI.error || '❌'} Token Expired\nYour saved token on the active slot was rejected by Discord — it has likely expired.\n\n**Your active slot token has been removed.** Re-link using \`${prefix}link\`.`,
        ),
    );
    return { components: [c], flags: MessageFlags.IsComponentsV2 };
}

async function buildErrorCard(err, prefix, guildId = 'global') {
    const EMOJI = await getEmojis(guildId);
    const msg = err?.message ?? String(err);
    const is401 = msg.includes('401');
    const c = new ContainerBuilder().setAccentColor(0xED4245);
    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            is401
                ? `# ${EMOJI.error || '❌'} Invalid or Expired Token\nRe-link your token using \`${prefix}link\`.`
                : `# ${EMOJI.error || '❌'} Error\n${msg.slice(0, 800)}`,
        ),
    );
    return { components: [c], flags: MessageFlags.IsComponentsV2 };
}

async function buildQuestInfoCard(quest, phase, claimed = 0, failReason = '', percent = 0, guildId = 'global') {
    const EMOJI = await getEmojis(guildId);
    const cfg  = quest.config;
    const msgs = cfg.messages;
    const thumbUrl = getThumbUrl(cfg, quest.id);

    const TASK_META = {
        PLAY_ON_DESKTOP:       { icon: EMOJI.desktop || '🖥️', label: 'Play on Desktop' },
        WATCH_VIDEO:           { icon: EMOJI.video || '🎬', label: 'Watch Video' },
        STREAM_ON_DESKTOP:     { icon: EMOJI.stream || '📺', label: 'Stream on Desktop' },
        PLAY_ACTIVITY:         { icon: EMOJI.activity || '🎮', label: 'Play Activity' },
        WATCH_VIDEO_ON_MOBILE: { icon: EMOJI.mobile || '📱', label: 'Watch Video on Mobile' },
    };

    const taskLines = Object.entries((cfg.task_config ?? cfg.task_config_v2)?.tasks ?? {}).map(([type, task]) => {
        const meta = TASK_META[type] ?? { icon: EMOJI.gear || '⚙️', label: type };
        let dur = '';
        if (type === 'PLAY_ON_DESKTOP' || type === 'STREAM_ON_DESKTOP') {
            dur = `  •  **${Math.ceil(task.target / 60)} min**`;
        } else if (type === 'WATCH_VIDEO' || type === 'WATCH_VIDEO_ON_MOBILE') {
            const s = task.target;
            dur = s >= 60 ? `  •  **${Math.ceil(s / 60)} min**` : `  •  **${s}s**`;
        }
        return `${meta.icon} ${meta.label}${dur}${phase === 'done' ? `  ${EMOJI.success || '✅'}` : ''}`;
    });

    const rewardLines = (cfg.rewards_config?.rewards ?? []).map((r) => {
        const rName = r.messages?.name || 'Exclusive Reward';
        if (r.orb_quantity) return `**${r.orb_quantity} Orbs** ${EMOJI.orbs || '✨'}`;
        if (r.quantity) return `**${r.quantity}d Nitro**`;
        return `**${rName}**`;
    });

    const expiresEpoch = Math.floor(new Date(cfg.expires_at).getTime() / 1000);
    const daysLeft = Math.max(0, Math.ceil((new Date(cfg.expires_at).getTime() - Date.now()) / 86400000));

    const currentPercent = Math.min(100, Math.max(0, Math.floor(percent)));
    const filledBlocks = Math.floor(currentPercent / 10);
    const emptyBlocks = 10 - filledBlocks;
    const progressBar = '`' + '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks) + '`' + `  **${currentPercent}%**`;

    const PHASE = {
        starting: { color: 0x5865F2, title: `${EMOJI.loading || '⚙️'}  Solving Quest...`,  bar: progressBar + '  —  *Working on it...*' },
        done:     { color: 0x57F287, title: `${EMOJI.success || '✅'}  Quest Complete!`,    bar: '`██████████`  **100%**' },
        failed:   { color: 0xED4245, title: `${EMOJI.error || '❌'}  Quest Failed`,       bar: '' },
    };

    const p = PHASE[phase];
    const progressText = phase === 'failed' && failReason
        ? `\`░░░░░░░░░░\`  **0%**\n\`\`\`\n${failReason.slice(0, 300)}\n\`\`\``
        : p.bar;

    const footerNote = phase === 'done' && claimed > 0
        ? `-# ${EMOJI.gift || '🎁'} ${claimed} reward(s) claimed`
        : phase === 'starting'
        ? `-# Quest Bot  •  Please wait...`
        : phase === 'failed'
        ? `-# Requires manual completion in the Discord app`
        : '';

    const c = new ContainerBuilder().setAccentColor(p.color);
    const section = new SectionBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `# ${p.title}\n### ${msgs.quest_name}\n*${msgs.game_title}*  •  ${msgs.game_publisher}`,
        )
    );

    if (thumbUrl) {
        section.setThumbnailAccessory(new ThumbnailBuilder().setURL(thumbUrl));
    }

    c.addSectionComponents(section);
    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `${EMOJI.task || '📋'} **Task**\n${taskLines.join('\n') || '*Unknown task*'}\n\n` +
            `${EMOJI.expire || '📅'} **Expires**  <t:${expiresEpoch}:R>  *(${daysLeft}d left)*\n\n` +
            `${EMOJI.stats || '📊'} **Progress**\n${progressText}\n\n` +
            `${EMOJI.reward || '🎁'} **Reward**\n${rewardLines.join('\n') || '*No rewards listed*'}`,
        ),
    );

    if (footerNote) {
        c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(footerNote));
    }

    return { components: [c], flags: MessageFlags.IsComponentsV2 };
}

// ── Quest Runners Logic ────────────────────────────────────────────────    

async function runQuestAll(guildId, userId, tokenStore, send, prefix) {
    const token = await getActiveToken(guildId, userId, tokenStore);
    if (!token) { await send(await buildLinkPrompt(prefix, guildId)); return false; }

    const qc = new QuestClient(token);
    try {
        const manager = await qc.fetchQuests();
        const valid = manager.filterQuestsValid();
        if (valid.length === 0) { await send(await buildNoQuestsCard(guildId)); return false; }

        const progressMsgs = await Promise.all(valid.map((q) => buildQuestInfoCard(q, 'starting', 0, '', 0, guildId).then(card => send(card))));
        const questLogs = valid.map(() => []);

        const questResults = await Promise.allSettled(
            valid.map((quest, i) => {
                const progressMsg = progressMsgs[i];
                let lastPct = -1;

                const onProgress = async (done, total) => {
                    const pct = Math.min(100, Math.floor((done / total) * 100));
                    if (pct >= lastPct + 3 || pct === 100) {
                        lastPct = pct;
                        const card = await buildQuestInfoCard(quest, 'starting', 0, '', pct, guildId);
                        await progressMsg.edit(card).catch(() => {});
                    }
                };

                const log = (m) => { console.log(m); questLogs[i].push(m); };
                return manager.doingQuest(quest, log, onProgress);
            }),
        );

        const completed = valid.filter((_, i) => questResults[i].status === 'fulfilled' && questResults[i].value === true);
        const skipped   = valid.filter((_, i) => questResults[i].status === 'rejected' || (questResults[i].status === 'fulfilled' && questResults[i].value === false));

        await Promise.allSettled(skipped.map(async (q) => {
            const idx = valid.indexOf(q);
            const failLogs = questLogs[idx].filter(l => l.startsWith('[FAIL]'));
            const reason = questResults[idx].status === 'rejected'
                ? questResults[idx].reason?.message ?? 'Unknown error'
                : failLogs.slice(-2).join('\n') || questLogs[idx].slice(-3).join('\n') || 'Could not be completed automatically.';
            const card = await buildQuestInfoCard(q, 'failed', 0, reason, 0, guildId);
            return progressMsgs[idx].edit(card);
        }));

        if (completed.length === 0) {
            const EMOJI = await getEmojis(guildId);
            const c = new ContainerBuilder().setAccentColor(0xFEE75C);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${EMOJI.warn || '⚠️'} No Quests Auto-Completed\nAll quests require manual completion via the Discord desktop or mobile app.`));
            await send({ components: [c], flags: MessageFlags.IsComponentsV2 });
            return false;
        }

        let totalClaimed = 0;
        for (const q of completed) {
            const cCount = await manager.claimRewards(console.log, q.id).catch(() => 0);
            totalClaimed += cCount;
        }
        const claimed = totalClaimed;
        const claimedPer = completed.length > 0 ? Math.floor(claimed / completed.length) : 0;

        await Promise.allSettled(completed.map(async (q, i) => {
            const idx = valid.indexOf(q);
            const card = await buildQuestInfoCard(q, 'done', i === 0 ? claimed : claimedPer, '', 100, guildId);
            return progressMsgs[idx].edit(card);
        }));
        return true;

    } catch (err) {
        const msg = err?.message ?? String(err);
        if (msg.includes('401')) {
            const active = await tokenStore.getActiveSlot(guildId, userId);
            if (active) await tokenStore.removeSlot(guildId, userId, active.slot);
            disableAutoquest(userId);
            await send(await buildExpiredTokenCard(prefix, guildId)).catch(() => {});
        } else {
            await send(await buildErrorCard(err, prefix, guildId)).catch(() => {});
        }
        return false;
    }
}

async function runQuestList(guildId, userId, tokenStore, send, prefix) {
    const token = await getActiveToken(guildId, userId, tokenStore);
    if (!token) { await send(await buildLinkPrompt(prefix, guildId)); return; }

    const qc = new QuestClient(token);
    try {
        const manager = await qc.fetchQuests();
        const all = manager.list();
        if (all.length === 0) { await send(await buildNoQuestsCard(guildId)); return; }

        const EMOJI = await getEmojis(guildId);
        const TASK_META = {
            PLAY_ON_DESKTOP:       { icon: EMOJI.desktop || '🖥️', label: 'Play on Desktop' },
            WATCH_VIDEO:           { icon: EMOJI.video || '🎬', label: 'Watch Video' },
            STREAM_ON_DESKTOP:     { icon: EMOJI.stream || '📺', label: 'Stream on Desktop' },
            PLAY_ACTIVITY:         { icon: EMOJI.activity || '🎮', label: 'Play Activity' },
            WATCH_VIDEO_ON_MOBILE: { icon: EMOJI.mobile || '📱', label: 'Watch Video on Mobile' },
        };

        for (const q of all.slice(0, 10)) {
            const cfg = q.config;
            const msgs = cfg.messages;
            const thumbUrl = getThumbUrl(cfg, q.id);
            const expiresEpoch = Math.floor(new Date(cfg.expires_at).getTime() / 1000);
            const daysLeft = Math.max(0, Math.ceil((new Date(cfg.expires_at).getTime() - Date.now()) / 86400000));

            const st = q.isCompleted() ? { color: 0x57F287, icon: EMOJI.success || '✅', label: 'Completed' }
                : q.isExpired()        ? { color: 0xED4245, icon: EMOJI.error || '🔴', label: 'Expired' }
                : q.isEnrolledQuest()  ? { color: 0xFEE75C, icon: EMOJI.loading || '⏳', label: 'In Progress' }
                :                        { color: 0x5865F2, icon: EMOJI.dot || '🔵', label: 'Available' };

            const taskLines = Object.entries((cfg.task_config ?? cfg.task_config_v2)?.tasks ?? {}).map(([type, task]) => {
                const meta = TASK_META[type] ?? { icon: EMOJI.gear || '⚙️', label: type };
                let dur = '';
                if (type === 'PLAY_ON_DESKTOP' || type === 'STREAM_ON_DESKTOP') dur = `  •  **${Math.ceil(task.target / 60)} min**`;
                else if (type === 'WATCH_VIDEO' || type === 'WATCH_VIDEO_ON_MOBILE') {
                    const s = task.target;
                    dur = s >= 60 ? `  •  **${Math.ceil(s / 60)} min**` : `  •  **${s}s**`;
                }
                return `${meta.icon} ${meta.label}${dur}`;
            });

            const rewardLines = (cfg.rewards_config?.rewards ?? []).map((r) => {
                const rName = r.messages?.name || 'Exclusive Reward';
                if (r.orb_quantity) return `**${r.orb_quantity} Orbs** ${EMOJI.orbs || '✨'}`;
                if (r.quantity) return `**${r.quantity}d Nitro**`;
                return `**${rName}**`;
            });

            const c = new ContainerBuilder().setAccentColor(st.color);
            const section = new SectionBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `# ${st.icon}  ${msgs.quest_name}\n*${msgs.game_title}*  •  ${msgs.game_publisher}`,
                )
            );

            if (thumbUrl) section.setThumbnailAccessory(new ThumbnailBuilder().setURL(thumbUrl));

            c.addSectionComponents(section);
            c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
            c.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `${EMOJI.stats || '📊'} **Status:** ${st.label}   ${EMOJI.expire || '📅'} **Expires:** <t:${expiresEpoch}:R> *(${daysLeft}d)*\n\n` +
                    `${EMOJI.task || '📋'} **Task**\n${taskLines.join('\n') || '*Unknown*'}\n\n` +
                    `${EMOJI.reward || '🎁'} **Reward**\n${rewardLines.join('\n') || '*No rewards listed*'}`,
                ),
            );
            await send({ components: [c], flags: MessageFlags.IsComponentsV2 });
        }

        if (all.length > 10) {
            const c = new ContainerBuilder().setAccentColor(0x4F545C);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# …and **${all.length - 10}** more quest(s) not shown.`));
            await send({ components: [c], flags: MessageFlags.IsComponentsV2 });
        }

    } catch (err) {
        await send(await buildErrorCard(err, prefix, guildId)).catch(() => {});
    }
}

async function runTokenCheck(guildId, userId, tokenStore, replyFn, prefix) {
    const token = await getActiveToken(guildId, userId, tokenStore);
    const EMOJI = await getEmojis(guildId);
    if (!token) {
        const c = new ContainerBuilder().setAccentColor(0xFEE75C);
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${EMOJI.warn || '⚠️'} No Active Slot Token\nYou don't have an active token set in your slots. Use \`${prefix}link\` to configure your slots.`));
        await replyFn({ components: [c], flags: MessageFlags.IsComponentsV2 });
        return;
    }

    let valid = false, accountName = '';
    try {
        const res = await fetch('https://discord.com/api/v10/users/@me', { headers: { Authorization: token } });
        valid = res.ok;
        if (res.ok) {
            const data = await res.json();
            accountName = data.global_name || data.username || '';
        }
    } catch { valid = false; }

    const c = new ContainerBuilder().setAccentColor(valid ? 0x57F287 : 0xED4245);
    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            valid
                ? `# ${EMOJI.success || '✅'} Token is Valid\nActive slot linked as **"${accountName}"**.\n\nYour active token is working correctly.`
                : `# ${EMOJI.error || '❌'} Token Invalid or Expired\nYour active slot token was rejected by Discord.\nUse \`${prefix}link\` to manage and update your slots.`,
        ),
    );
    await replyFn({ components: [c], flags: MessageFlags.IsComponentsV2 });
    if (!valid) {
        const active = await tokenStore.getActiveSlot(guildId, userId);
        if (active) await tokenStore.removeSlot(guildId, userId, active.slot);
    }
}

// ── Exports ────────────────────────────────────────────────────────────────

export const questAllCmd = {
    data: new SlashCommandBuilder().setName('questall').setDescription('Complete all quests at once'),
    prefix: 'questall',
    async execute(interaction, client) {
        await interaction.deferReply();
        await runQuestAll(interaction.guild?.id || 'global', interaction.user.id, client.tokenStore, (opts) => interaction.followUp(opts), PREFIX);
    },
    async prefixExecute(message, _args, client) {
        await runQuestAll(message.guild?.id || 'global', message.author.id, client.tokenStore, (opts) => message.channel.send(opts), PREFIX);
    },
};

export const qCmd = {
    data: new SlashCommandBuilder().setName('q').setDescription('Complete all quests at once (Shortcut)'),
    prefix: 'q',
    async execute(interaction, client) {
        await interaction.deferReply();
        await runQuestAll(interaction.guild?.id || 'global', interaction.user.id, client.tokenStore, (opts) => interaction.followUp(opts), PREFIX);
    },
    async prefixExecute(message, _args, client) {
        await runQuestAll(message.guild?.id || 'global', message.author.id, client.tokenStore, (opts) => message.channel.send(opts), PREFIX);
    },
};

export const questListCmd = {
    data: new SlashCommandBuilder().setName('questlist').setDescription('List all Discord quests and their status'),
    prefix: 'questlist',
    async execute(interaction, client) {
        await interaction.deferReply();
        await runQuestList(interaction.guild?.id || 'global', interaction.user.id, client.tokenStore, (opts) => interaction.followUp(opts), PREFIX);
    },
    async prefixExecute(message, _args, client) {
        await runQuestList(message.guild?.id || 'global', message.author.id, client.tokenStore, (opts) => message.channel.send(opts), PREFIX);
    },
};

export const tokenCheckCmd = {
    data: new SlashCommandBuilder().setName('tokencheck').setDescription('Check whether your saved Discord token is still valid'),
    prefix: 'tokencheck',
    async execute(interaction, client) {
        await interaction.deferReply({ flags: 64 });
        await runTokenCheck(interaction.guild?.id || 'global', interaction.user.id, client.tokenStore, (opts) => interaction.editReply(opts), PREFIX);
    },
    async prefixExecute(message, _args, client) {
        await runTokenCheck(message.guild?.id || 'global', message.author.id, client.tokenStore, (opts) => message.reply(opts), PREFIX);
    },
};

export async function runAutoquestForUser(userId, quest, tokenStore, discordClient, guildId = 'global') {
    const active = await tokenStore.getActiveSlot(guildId, userId);
    if (!active) { disableAutoquest(userId); return; }
    const token = active.token || await tokenStore.get(guildId, userId, active.slot);
    if (!token) { disableAutoquest(userId); return; }

    const { QuestClient: QC } = await import('../quest/questClient.js');
    const { Quest: Q } = await import('../quest/quest.js');
    const qc = new QC(token);
    const logs = [];
    const log = (m) => { console.log(`[AutoQuest:${userId}]`, m); logs.push(m); };

    try {
        const manager = await qc.fetchQuests();
        let live = manager.get(quest.id);
        if (!live) {
            live = Q.create({ id: quest.id, config: quest.config, user_status: null, targeted_content: quest.targetedContent, preview: quest.preview });
        }
        if (live.isCompleted() || live.isExpired()) return;

        await manager.doingQuest(live, log);

        let claimManager = manager;
        try { claimManager = await qc.fetchQuests(); } catch { if (!manager.hasQuest(live.id)) manager.upsert(live); }

        const claimed = await claimManager.claimRewards(log, live.id).catch(() => 0);
        const EMOJI = await getEmojis(guildId);

        try {
            const user = await discordClient.users.fetch(userId);
            const dm = await user.createDM();
            const c = new ContainerBuilder().setAccentColor(0x57F287);
            c.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `# ${EMOJI.robot || '🤖'} Auto-Quest Complete!\n**${live.config.messages.quest_name}** has been completed automatically on your active slot.\n${claimed > 0 ? `${EMOJI.reward || '🎁'} **${claimed}** reward(s) claimed.\n` : ''}\nUse \`${PREFIX}autoquest\` to disable.`,
                ),
            );
            await dm.send({ components: [c], flags: MessageFlags.IsComponentsV2 });
        } catch {}

    } catch (err) {
        const msg = err?.message ?? String(err);
        console.error(`[AutoQuest:${userId}] Error:`, msg);
        if (msg.includes('401')) {
            await tokenStore.removeSlot(guildId, userId, active.slot);
            disableAutoquest(userId);
            try {
                const user = await discordClient.users.fetch(userId);
                const dm = await user.createDM();
                const EMOJI = await getEmojis(guildId);
                const c = new ContainerBuilder().setAccentColor(0xED4245);
                c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${EMOJI.warn || '🤖'} Auto-Quest Paused\nYour active slot token expired. Run \`${PREFIX}link\` to re-configure slots.`));
                await dm.send({ components: [c], flags: MessageFlags.IsComponentsV2 });
            } catch {}
        }
    }
}
