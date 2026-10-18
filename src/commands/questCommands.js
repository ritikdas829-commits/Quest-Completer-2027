/**
 * questCommands.js - Interactive Quest Solver & Management System (Updated)
 * Location: src/commands/questCommands.js
 */

import {
    ContainerBuilder, TextDisplayBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    StringSelectMenuBuilder, MessageFlags, SlashCommandBuilder, SectionBuilder, ThumbnailBuilder, SeparatorBuilder, SeparatorSpacingSize
} from 'discord.js';
import { QuestClient } from '../quest/questClient.js';
import { enableAutoquest, disableAutoquest, isAutoquestEnabled } from '../quest/autoquestStore.js';
import { PREFIX } from '../utils/config.js';

// ── Helper: Get active token for user from 5-Slot Store ────────────────────
async function getActiveToken(guildId, userId, tokenStore) {
    if (!tokenStore) return null;
    const active = await tokenStore.getActiveSlot(guildId, userId);
    if (!active) return null;
    return active.token || await tokenStore.get(guildId, userId, active.slot);
}

// ── UI Cards (Errors & Prompts) ────────────────────────────────────────────

function buildLinkPrompt(prefix) {
    const c = new ContainerBuilder().setAccentColor(0xFEE75C);
    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `# 🔗 Token Required\nYou need to link your Discord token in a slot before using quest commands.\n\nUse \`${prefix}link\` to open your 5-slot account panel and link a token.`,
        ),
    );
    return { components: [c], flags: MessageFlags.IsComponentsV2 };
}

function buildNoQuestsCard() {
    const c = new ContainerBuilder().setAccentColor(0x4F545C);
    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `# 🔍 No Quests Available\nThere are no active, uncompleted quests on your active slot account right now.`,
        ),
    );
    return { components: [c], flags: MessageFlags.IsComponentsV2 };
}

function buildExpiredTokenCard(prefix) {
    const c = new ContainerBuilder().setAccentColor(0xED4245);
    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `# ❌ Token Expired\nYour saved token on the active slot was rejected by Discord — it has likely expired.\n\n**Your active slot token has been removed.** Re-link using \`${prefix}link\`.`,
        ),
    );
    return { components: [c], flags: MessageFlags.IsComponentsV2 };
}

function buildErrorCard(err, prefix) {
    const msg = err?.message ?? String(err);
    const is401 = msg.includes('401');
    const c = new ContainerBuilder().setAccentColor(0xED4245);
    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            is401
                ? `# ❌ Invalid or Expired Token\nRe-link your token using \`${prefix}link\`.`
                : `# ❌ Error\n${msg.slice(0, 800)}`,
        ),
    );
    return { components: [c], flags: MessageFlags.IsComponentsV2 };
}

/**
 * Modern Interactive Quest Solver Panel (Banner/Thumbnail + SelectMenu + Progress + Rewards + Buttons + Logs)
 */
function buildQuestSolverPanel(quest, allQuests, phase = 'ready', failReason = '') {
    const cfg = quest.config;
    const msgs = cfg.messages;
    const appId = cfg.application.id;
    const thumbUrl = `https://cdn.discordapp.com/app-assets/${appId}/quest-assets/${cfg.assets.game_tile}.png`;

    const enrolled = cfg.enrolled_at ? new Date(cfg.enrolled_at).toLocaleDateString() : 'N/A';
    const expiresEpoch = Math.floor(new Date(cfg.expires_at).getTime() / 1000);
    const daysLeft = Math.max(0, Math.ceil((new Date(cfg.expires_at).getTime() - Date.now()) / 86400000));

    const TASK_META = {
        PLAY_ON_DESKTOP:       { icon: '🖥️', label: 'Play on Desktop' },
        WATCH_VIDEO:           { icon: '🎬', label: 'Watch Video' },
        STREAM_ON_DESKTOP:     { icon: '📺', label: 'Stream on Desktop' },
        PLAY_ACTIVITY:         { icon: '🎮', label: 'Play Activity' },
        WATCH_VIDEO_ON_MOBILE: { icon: '📱', label: 'Watch Video on Mobile' },
    };

    const taskLines = Object.entries((cfg.task_config ?? cfg.task_config_v2)?.tasks ?? {}).map(([type, task]) => {
        const meta = TASK_META[type] ?? { icon: '⚙️', label: type };
        let dur = '';
        if (type === 'PLAY_ON_DESKTOP' || type === 'STREAM_ON_DESKTOP') {
            dur = `  •  **${Math.ceil(task.target / 60)} min**`;
        } else if (type === 'WATCH_VIDEO' || type === 'WATCH_VIDEO_ON_MOBILE') {
            const s = task.target;
            dur = s >= 60 ? `  •  **${Math.ceil(s / 60)} min**` : `  •  **${s}s**`;
        }
        return `${meta.icon} ${meta.label}${dur}`;
    });

    const rewardLines = cfg.rewards_config.rewards.map((r) => {
        let line = `**${r.messages.name}**`;
        if (r.orb_quantity) line += `  ✦ *(${r.orb_quantity} Orbs)*`;
        else if (r.quantity) line += `  *(${r.quantity}d Nitro)*`;
        return line;
    });

    const PHASE = {
        ready:    { color: 0x5865F2, title: '🛡️ Quest Solver', bar: '`░░░░░░░░░░`  **0%**' },
        starting: { color: 0x5865F2, title: '⚙️ Solving Quest...', bar: '`████░░░░░░`  **40%**  —  *Running...*' },
        done:     { color: 0x57F287, title: '✅ Quest Complete!', bar: '`██████████`  **100%**' },
        failed:   { color: 0xED4245, title: '❌ Quest Failed', bar: '' },
    };

    const p = PHASE[phase] || PHASE.ready;
    const progressText = phase === 'failed' && failReason
        ? `\`░░░░░░░░░░\`  **0%**\n\`\`\`\n${failReason.slice(0, 300)}\n\`\`\``
        : p.bar;

    const c1 = new ContainerBuilder().setAccentColor(p.color);

    // Section with Thumbnail/Banner Image (Jaise 2nd screenshot me hai)
    c1.addSectionComponents(
        new SectionBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `# ${p.title}\n\n` +
                    `• **Game:** ${msgs.game_title}\n` +
                    `• **Publisher:** ${msgs.game_publisher}\n` +
                    `• **Quest Name:** ${msgs.quest_name}\n` +
                    `• **Enrolled At:** ${enrolled}\n` +
                    `• **Expires At:** <t:${expiresEpoch}:R> *(${daysLeft}d left)*\n` +
                    `• **Progress:**\n  ${progressText}\n\n` +
                    `### Rewards:\n${rewardLines.join('\n') || '• No rewards listed'}\n\n` +
                    `### Tasks:\n${taskLines.join('\n') || '• Complete in-game tasks'}`
                ),
            )
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(thumbUrl || 'https://i.imgur.com/AfFp7pu.png')),
    );

    c1.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

    // Select Menu Dropdown (Banner ke theek niche saare active quests select karne ke liye)
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('quest_select_dropdown')
        .setPlaceholder(msgs.quest_name.slice(0, 100))
        .addOptions(
            allQuests.slice(0, 25).map((q) => {
                const qCfg = q.config;
                return {
                    label: qCfg.messages.quest_name.slice(0, 100),
                    description: qCfg.messages.game_title.slice(0, 100),
                    value: q.id,
                    default: q.id === quest.id,
                    emoji: '🎯',
                };
            }),
        );

    const selectRow = new ActionRowBuilder().addComponents(selectMenu);

    // Action Buttons (Start, Stop, Refresh, View Quest Link)
    const btnRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`quest_start_${quest.id}`).setLabel('Start').setStyle(ButtonStyle.Success).setEmoji('▶️'),
        new ButtonBuilder().setCustomId(`quest_stop_${quest.id}`).setLabel('Stop').setStyle(ButtonStyle.Danger).setEmoji('⏹️'),
        new ButtonBuilder().setCustomId('quest_refresh').setLabel('Refresh').setStyle(ButtonStyle.Secondary).setEmoji('🔄'),
        new ButtonBuilder().setURL('https://discord.com/quests').setLabel('View Quest').setStyle(ButtonStyle.Link).setEmoji('🔗')
    );

    // Quest Logs Container
    const c2 = new ContainerBuilder().setAccentColor(0x2B2D31);
    c2.addTextDisplayComponents(new TextDisplayBuilder().setContent('## 📄 Quest Logs'));
    c2.addTextDisplayComponents(new TextDisplayBuilder().setContent(`\`\`\`ansi\n🧭 Quest selected: ${msgs.quest_name} - ${msgs.game_title}\n\`\`\``));

    return {
        components: [c1, selectRow, btnRow, c2],
        flags: MessageFlags.IsComponentsV2,
    };
}

// ── Quest Runner (Interactive Panel with Select Menu & Buttons) ────────────

async function runQuestInteractive(guildId, userId, tokenStore, send, prefix) {
    const token = await getActiveToken(guildId, userId, tokenStore);
    if (!token) { await send(buildLinkPrompt(prefix)); return; }

    const qc = new QuestClient(token);
    try {
        const manager = await qc.fetchQuests();
        const valid = manager.filterQuestsValid();
        if (valid.length === 0) { await send(buildNoQuestsCard()); return; }

        let currentQuest = valid[0];
        const panelMsg = await send(buildQuestSolverPanel(currentQuest, valid, 'ready'));

        const collector = panelMsg.createMessageComponentCollector({
            filter: (i) => i.user.id === userId,
            time: 300_000, // 5 minutes active session
        });

        collector.on('collect', async (interaction) => {
            try {
                if (interaction.isStringSelectMenu() && interaction.customId === 'quest_select_dropdown') {
                    await interaction.deferUpdate();
                    const selectedId = interaction.values[0];
                    const found = valid.find(q => q.id === selectedId);
                    if (found) {
                        currentQuest = found;
                        await interaction.editReply(buildQuestSolverPanel(currentQuest, valid, 'ready'));
                    }
                } else if (interaction.isButton()) {
                    if (interaction.customId === 'quest_refresh') {
                        await interaction.deferUpdate();
                        const freshManager = await qc.fetchQuests().catch(() => manager);
                        const freshValid = freshManager.filterQuestsValid();
                        await interaction.editReply(buildQuestSolverPanel(currentQuest, freshValid.length ? freshValid : valid, 'ready'));
                    } else if (interaction.customId.startsWith('quest_start_')) {
                        await interaction.deferUpdate();
                        await interaction.editReply(buildQuestSolverPanel(currentQuest, valid, 'starting'));

                        const logs = [];
                        const log = (m) => { console.log(m); logs.push(m); };
                        const questDone = await manager.doingQuest(currentQuest, log);

                        if (!questDone) {
                            const failReason = logs.filter(l => l.startsWith('[FAIL]')).slice(-2).join('\n') || logs.slice(-3).join('\n') || 'Could not complete automatically.';
                            await interaction.editReply(buildQuestSolverPanel(currentQuest, valid, 'failed', failReason));
                        } else {
                            await manager.claimRewards(log).catch(() => 0);
                            await interaction.editReply(buildQuestSolverPanel(currentQuest, valid, 'done'));
                        }
                    } else if (interaction.customId.startsWith('quest_stop_')) {
                        await interaction.deferUpdate();
                        await interaction.editReply(buildQuestSolverPanel(currentQuest, valid, 'ready'));
                    }
                }
            } catch (err) {
                console.error("Interaction error:", err);
            }
        });

        collector.on('end', async () => {
            try {
                await panelMsg.edit({ components: [], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
            } catch {}
        });

    } catch (err) {
        const msg = err?.message ?? String(err);
        if (msg.includes('401')) {
            const active = await tokenStore.getActiveSlot(guildId, userId);
            if (active) await tokenStore.removeSlot(guildId, userId, active.slot);
            disableAutoquest(userId);
            await send(buildExpiredTokenCard(prefix)).catch(() => {});
        } else {
            await send(buildErrorCard(err, prefix)).catch(() => {});
        }
    }
}

async function runTokenCheck(guildId, userId, tokenStore, replyFn, prefix) {
    const token = await getActiveToken(guildId, userId, tokenStore);
    if (!token) {
        const c = new ContainerBuilder().setAccentColor(0xFEE75C);
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# No Active Slot Token\nYou don't have an active token set in your slots. Use \`${prefix}link\` to configure your slots.`));
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
                ? `# ✅ Token is Valid\nActive slot linked as **"${accountName}"**.\n\nYour active token is working correctly.`
                : `# ❌ Token Invalid or Expired\nYour active slot token was rejected by Discord.\nUse \`${prefix}link\` to manage and update your slots.`,
        ),
    );
    await replyFn({ components: [c], flags: MessageFlags.IsComponentsV2 });
    if (!valid) {
        const active = await tokenStore.getActiveSlot(guildId, userId);
        if (active) await tokenStore.removeSlot(guildId, userId, active.slot);
    }
}

async function runAutoquestToggle(guildId, userId, tokenStore, replyFn, prefix) {
    if (isAutoquestEnabled(userId)) {
        disableAutoquest(userId);
        const c = new ContainerBuilder().setAccentColor(0xFEE75C);
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# 🤖 Auto-Quest Disabled\nI'll no longer auto-run new quests for you.\nUse \`${prefix}autoquest\` again to turn it back on.`));
        await replyFn({ components: [c], flags: MessageFlags.IsComponentsV2 });
        return;
    }
    const token = await getActiveToken(guildId, userId, tokenStore);
    if (!token) {
        const c = new ContainerBuilder().setAccentColor(0xED4245);
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ❌ No Active Token\nAuto-Quest needs an active linked slot.\n\n**Use \`${prefix}link\` first** to select or add a token slot.`));
        await replyFn({ components: [c], flags: MessageFlags.IsComponentsV2 });
        return;
    }
    enableAutoquest(userId);
    const c = new ContainerBuilder().setAccentColor(0x57F287);
    c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `# 🤖 Auto-Quest Enabled!\nEvery new Discord quest that drops will be **auto-completed for you** using your active slot.\n\nI'll DM you a summary once each quest finishes.\n\nUse \`${prefix}autoquest\` again to turn this off.\n\n-# Keep your token fresh with \`${prefix}tokencheck\`.`,
        ),
    );
    await replyFn({ components: [c], flags: MessageFlags.IsComponentsV2 });
}

// ── Slash + Prefix exports ─────────────────────────────────────────────────

export const questCmd = {
    data: new SlashCommandBuilder().setName('quest').setDescription('Open interactive quest solver panel'),
    prefix: ['quest', 'q'],
    async execute(interaction, client) {
        await interaction.deferReply();
        await runQuestInteractive(interaction.guild.id, interaction.user.id, client.tokenStore, (opts) => interaction.followUp(opts), PREFIX);
    },
    async prefixExecute(message, _args, client) {
        await runQuestInteractive(message.guild.id, message.author.id, client.tokenStore, (opts) => message.channel.send(opts), PREFIX);
    },
};

export const tokenCheckCmd = {
    data: new SlashCommandBuilder().setName('tokencheck').setDescription('Check whether your saved Discord token is still valid'),
    prefix: 'tokencheck',
    async execute(interaction, client) {
        await interaction.deferReply({ flags: 64 });
        await runTokenCheck(interaction.guild.id, interaction.user.id, client.tokenStore, (opts) => interaction.editReply(opts), PREFIX);
    },
    async prefixExecute(message, _args, client) {
        await runTokenCheck(message.guild.id, message.author.id, client.tokenStore, (opts) => message.reply(opts), PREFIX);
    },
};

export const autoquestCmd = {
    data: new SlashCommandBuilder().setName('autoquest').setDescription('Auto-complete every new quest the moment it drops'),
    prefix: 'autoquest',
    async execute(interaction, client) {
        await interaction.deferReply({ flags: 64 });
        await runAutoquestToggle(interaction.guild.id, interaction.user.id, client.tokenStore, (opts) => interaction.editReply(opts), PREFIX);
    },
    async prefixExecute(message, _args, client) {
        await runAutoquestToggle(message.guild.id, message.author.id, client.tokenStore, (opts) => message.reply(opts), PREFIX);
    },
};

// ── AutoQuest runner (called from questWatcher) ────────────────────────────
export async function runAutoquestForUser(userId, quest, tokenStore, discordClient, guildId) {
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

        const claimed = await claimManager.claimRewards(log).catch(() => 0);

        try {
            const user = await discordClient.users.fetch(userId);
            const dm = await user.createDM();
            const c = new ContainerBuilder().setAccentColor(0x57F287);
            c.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `# 🤖 Auto-Quest Complete!\n**${live.config.messages.quest_name}** has been completed automatically on your active slot.\n${claimed > 0 ? `🎁 **${claimed}** reward(s) claimed.\n` : ''}\nUse \`${PREFIX}autoquest\` to disable.`,
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
                const c = new ContainerBuilder().setAccentColor(0xED4245);
                c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# 🤖 Auto-Quest Paused\nYour active slot token expired. Run \`${PREFIX}link\` to re-configure slots.`));
                await dm.send({ components: [c], flags: MessageFlags.IsComponentsV2 });
            } catch {}
        }
    }
}
