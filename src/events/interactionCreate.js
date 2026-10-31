/**
 * interactionCreate.js — Complete Interaction Handler with Claim & Independent Emojis
 * Location: src/events/interactionCreate.js
 */

import { handleGuideButtons } from '../commands/guide.js';
import { handleButton as handlePremiumButton, handleModal as handlePremiumModal } from '../commands/premiumLink.js';
import { handleActivationButton, handleActivationModalSubmit } from '../handlers/keyActivationHandler.js';
import { buildQuestSolverPanel } from '../quest/questUI.js';
import { buildHelpPanel } from '../commands/help.js';
import { QuestClient } from '../quest/questClient.js';
import { QuestManager } from '../quest/questManager.js';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags, ComponentType } from 'discord.js';
import { getEmojis } from '../quest/emoji.js';
import { startUserOnlinePresence, stopUserOnlinePresence } from '../quest/userPresence.js';
import { checkActivityCooldown } from '../quest/suspiciousActivity.js';

// Map to track active running intervals and abort flags across users
const activeRunners = new Map();

// Helper: Track original panel requesters to restrict unauthorized access
const panelOwners = new Map(); // messageId -> userId

export function setPanelOwner(messageId, userId) {
    panelOwners.set(messageId, userId);
}

// Helper: Build Token Dashboard Panel for Button Interactions
async function buildTokenDashboardContent(client, guildId, userId) {
    const EMOJI = await getEmojis(guildId);
    const accounts = await client.tokenStore.getAllSlots(guildId, userId);
    const activeSlot = await client.tokenStore.getActiveSlot(guildId, userId);
    
    const embed = new EmbedBuilder();
    const components = [];

    if (!accounts || accounts.length === 0) {
        embed.setColor(0xED4245)
             .setTitle(`${EMOJI.event_warn || '❌'} No Tokens Linked`)
             .setDescription('No accounts linked yet. Please use the `?link` command to add a token.');
        return { embeds: [embed], components: [], flags: 64 };
    }

    embed.setColor(0x5865F2)
         .setTitle(`${EMOJI.event_list || '📊'} Token Status Dashboard & Control Panel`)
         .setDescription('Use the buttons below to bring your accounts online/offline or select a slot.');

    const menuOptions = [];
    for (const acc of accounts) {
        const isActive = activeSlot?.slot === acc.slot;
        const statusIcon = isActive ? (EMOJI.event_online || '🟢') : (EMOJI.event_dot || '⚪');
        
        embed.addFields({
            name: `Slot #${acc.slot} — ${acc.username || 'Linked Account'}`,
            value: `• **Status:** ${statusIcon} ${isActive ? 'Active (Online)' : 'Stored'}\n• **User ID:** \`${acc.linkedUserId || 'N/A'}\``,
            inline: false
        });

        menuOptions.push(
            new StringSelectMenuOptionBuilder()
                .setLabel(`Slot #${acc.slot}: ${acc.username || 'Account'}`)
                .setValue(`tokensys_select_${acc.slot}`)
                .setDescription(isActive ? 'Currently Active Slot' : 'Switch to this slot')
                .setDefault(isActive)
        );
    }

    if (menuOptions.length > 0) {
        components.push(
            new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('tokensys_slot_select')
                    .setPlaceholder('Select active account slot...')
                    .addOptions(menuOptions)
            )
        );
    }

    components.push(
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('tokensys_btn_on').setLabel('Online On').setEmoji('🟢').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('tokensys_btn_off').setLabel('Online Off').setEmoji('🔴').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('tokensys_btn_refresh').setLabel('Refresh Panel').setEmoji('🔄').setStyle(ButtonStyle.Secondary)
        )
    );

    return { embeds: [embed], components, flags: 64 };
}

export default {
    name: 'interactionCreate',
    once: false,
    async execute(interaction, client) {
        try {
            const guildId = interaction.guildId || 'global';
            const userId = interaction.user?.id;
            const EMOJI = await getEmojis(guildId);

            // 🛑 1. SECURITY COOLDOWN CHECK (Active Task / ToS Ban Prevention)
            const cooldown = checkActivityCooldown(userId);
            if (cooldown.active) {
                return interaction.reply({
                    content: `### ${EMOJI.event_error || '❌'} Security Cooldown Active\n` +
                             `\`\`\`prolog\n` +
                             `[SECURITY] Account temporarily locked due to activity safety.\n` +
                             `[STATUS] Cooldown remaining: ~${cooldown.remaining} hours.\n` +
                             `[INFO] Please wait until the activity restriction lifts to avoid account flags.\n` +
                             `\`\`\``,
                    flags: 64
                }).catch(() => {});
            }

            // 🛡️ 2. ORIGINAL USER LOCK CHECK (Prevent unauthorized clicks on someone else's panel)
            if (interaction.message && panelOwners.has(interaction.message.id)) {
                const ownerId = panelOwners.get(interaction.message.id);
                if (userId !== ownerId) {
                    return interaction.reply({
                        content: `### ${EMOJI.event_error || '❌'} Unauthorized Access\n` +
                                 `> This control panel does not belong to you! Please execute your own command to interact with quests.`,
                        flags: 64
                    }).catch(() => {});
                }
            }

            // 3. Guide Buttons Handler
            if (interaction.isButton() && ['btn_pc', 'btn_android', 'btn_ios'].includes(interaction.customId)) {
                await handleGuideButtons(interaction);
                return;
            }

            // 3.5. Orbie Premium & Trial Activation Button Handler
            if (interaction.isButton() && interaction.customId === 'open_activate_modal') {
                const handled = await handleActivationButton(interaction);
                if (handled) return;
            }

            // 3.6. Copy Key Button Handler (Sends only raw code without backticks)
            if (interaction.isButton() && interaction.customId.startsWith('copy_key_')) {
                const keyToCopy = interaction.customId.replace('copy_key_', '');
                return await interaction.reply({
                    content: keyToCopy,
                    flags: MessageFlags.Ephemeral
                });
            }

            // 4. Premium Slot Buttons Handler
            if (interaction.isButton() && (
                interaction.customId.startsWith('link_slot_') ||
                interaction.customId.startsWith('unlink_slot_') ||
                interaction.customId.startsWith('select_slot_')
            )) {
                await handlePremiumButton(interaction, client);
                return;
            }

            // 5. Link Prompt Button
            if (interaction.isButton() && interaction.customId === 'link_prompt') {
                await interaction.reply({ content: `${EMOJI.event_link || '🔗'} Please use the link command or manage slots via premium panel.`, flags: 64 }).catch(() => {});
                return;
            }

            // 6. Help Dropdown Menu Handler
            if (interaction.isStringSelectMenu() && interaction.customId === 'help_category_select') {
                await interaction.deferUpdate();
                const val = interaction.values[0];
                let cat = 'main';
                if (val === 'help_cat_presence') cat = 'presence';
                else if (val === 'help_cat_quest') cat = 'quest';
                else if (val === 'help_cat_slots') cat = 'slots';
                else if (val === 'help_cat_utility') cat = 'utility';

                const updatedHelpPanel = await buildHelpPanel(interaction.user, client, guildId, cat);
                await interaction.editReply(updatedHelpPanel);
                return;
            }

            // 7. Token Dashboard Interactivity Handlers (`tokensys` buttons & dropdown)
            if (interaction.isStringSelectMenu() && interaction.customId === 'tokensys_slot_select') {
                await interaction.deferUpdate();
                const selectedValue = interaction.values[0];
                const slotNum = parseInt(selectedValue.replace('tokensys_select_', ''));
                
                await client.tokenStore.setActiveSlot(guildId, userId, slotNum);
                const updatedPanel = await buildTokenDashboardContent(client, guildId, userId);
                await interaction.editReply(updatedPanel);
                return;
            }

            if (interaction.isButton() && interaction.customId === 'tokensys_btn_on') {
                await interaction.deferUpdate();
                const active = await client.tokenStore.getActiveSlot(guildId, userId);
                
                if (!active || !active.token) {
                    await interaction.followUp({ content: `${EMOJI.event_error || '❌'} No active slot selected or token is missing!`, flags: 64 });
                    return;
                }

                startUserOnlinePresence(userId, active.token, 'online');
                const updatedPanel = await buildTokenDashboardContent(client, guildId, userId);
                await interaction.followUp({ content: `${EMOJI.event_online || '🟢'} **Slot #${active.slot}** is now brought online 24/7!`, flags: 64 });
                await interaction.editReply(updatedPanel);
                return;
            }

            if (interaction.isButton() && interaction.customId === 'tokensys_btn_off') {
                await interaction.deferUpdate();
                stopUserOnlinePresence(userId);
                const updatedPanel = await buildTokenDashboardContent(client, guildId, userId);
                await interaction.followUp({ content: `${EMOJI.event_warn || '🔴'} Account online gateway connection disconnected.`, flags: 64 });
                await interaction.editReply(updatedPanel);
                return;
            }

            if (interaction.isButton() && interaction.customId === 'tokensys_btn_refresh') {
                await interaction.deferUpdate();
                const updatedPanel = await buildTokenDashboardContent(client, guildId, userId);
                await interaction.editReply(updatedPanel);
                return;
            }

            // 7.5. Claim Hub Interactivity Handlers (Dropdown & Claim All Button)
            if (interaction.customId === 'claim_quest_select' || interaction.customId === 'claim_all_btn') {
                await interaction.deferUpdate().catch(() => {});

                let token = null;
                try {
                    if (client.tokenStore) {
                        const activeSlot = await client.tokenStore.getActiveSlot(guildId, userId);
                        if (activeSlot) {
                            token = activeSlot.token || await client.tokenStore.get(guildId, userId, activeSlot.slot);
                        }
                    }
                } catch (err) {
                    console.error('[Claim Interaction] Token fetch error:', err);
                }

                if (!token) {
                    return await interaction.followUp({ content: '❌ Token required! Please link your account first.', flags: 64 }).catch(() => {});
                }

                let questClient;
                let rawQuests = [];
                try {
                    questClient = new QuestClient(token);
                    const questData = await questClient.fetchQuestsRaw();
                    rawQuests = Array.isArray(questData) ? questData : (questData?.quests || questData?.items || []);
                } catch (err) {
                    return await interaction.followUp({ content: `❌ Failed to fetch quests: ${err.message}`, flags: 64 }).catch(() => {});
                }

                const claimableQuests = rawQuests.filter(q => {
                    const status = q.user_status || q.userStatus || {};
                    return status.completed_at != null && status.claimed_at == null;
                });

                // Handle Individual Dropdown Selection
                if (interaction.isStringSelectMenu() && interaction.customId === 'claim_quest_select') {
                    const questId = interaction.values[0];
                    if (questId === 'none') return;

                    const targetQ = claimableQuests.find(q => q.id === questId);
                    const questName = targetQ?.config?.messages?.quest_name || questId;

                    let success = false;
                    try {
                        await questClient.post(`/quests/${encodeURIComponent(questId)}/reward-codes`);
                        success = true;
                    } catch (e) {
                        try {
                            await questClient.post(`/quests/${encodeURIComponent(questId)}/claim`);
                            success = true;
                        } catch {}
                    }

                    const resEmbed = new EmbedBuilder()
                        .setColor(success ? 0x57F287 : 0xED4245)
                        .setTitle(success ? '✅ Claimed!' : '❌ Failed')
                        .setDescription(success ? `Successfully claimed **${questName}**!` : `Failed to claim **${questName}** - already claimed or not completed.`);

                    return await interaction.editReply({ embeds: [resEmbed] }).catch(() => {});
                }

                // Handle Claim All Button Click with 800ms Rate Limit Delay
                if (interaction.isButton() && interaction.customId === 'claim_all_btn') {
                    let claimedCount = 0;
                    for (const q of claimableQuests) {
                        try {
                            await questClient.post(`/quests/${encodeURIComponent(q.id)}/reward-codes`);
                            claimedCount++;
                            await new Promise(r => setTimeout(r, 800)); // Rate limit safety
                        } catch (e) {
                            try {
                                await questClient.post(`/quests/${encodeURIComponent(q.id)}/claim`);
                                claimedCount++;
                                await new Promise(r => setTimeout(r, 800));
                            } catch {}
                        }
                    }

                    const embedAll = new EmbedBuilder()
                        .setColor(0x57F287)
                        .setTitle('🚀 Bulk Claim Done!')
                        .setDescription(`Claimed **${claimedCount}/${claimableQuests.length}** rewards successfully.`);

                    return await interaction.editReply({ embeds: [embedAll], components: [] }).catch(() => {});
                }
                return;
            }

            // 8. Modals Handler
            if (interaction.isModalSubmit()) {
                // Key Activation Modal Handler
                if (interaction.customId === 'orbie_activate_modal') {
                    await handleActivationModalSubmit(interaction, client);
                    return;
                }

                if (interaction.customId === 'linkid-modal') {
                    await interaction.deferReply({ flags: 64 });

                    const token = interaction.fields.getTextInputValue('discord_token_input');
                    let userData = null;

                    try {
                        const res = await fetch('https://discord.com/api/v9/users/@me', {
                            headers: { Authorization: token }
                        });

                        if (!res.ok) {
                            const errorEmbed = new EmbedBuilder()
                                .setColor(0xED4245)
                                .setTitle(`${EMOJI.event_error || '❌'} Invalid Token`)
                                .setDescription('The token you provided was rejected by Discord. Please check and try again.');
                            return await interaction.editReply({ embeds: [errorEmbed] });
                        }

                        userData = await res.json();
                    } catch (err) {
                        const errorEmbed = new EmbedBuilder()
                            .setColor(0xED4245)
                            .setTitle(`${EMOJI.event_error || '❌'} Connection Error`)
                            .setDescription('Failed to validate token with Discord API.');
                        return await interaction.editReply({ embeds: [errorEmbed] });
                    }

                    await client.tokenStore.saveSlot({
                        guildId: guildId || 'global',
                        ownerId: userId,
                        slot: 1,
                        token: token,
                        username: userData.username,
                        linkedUserId: userData.id,
                        avatar: userData.avatar,
                        isActive: true
                    });

                    const successEmbed = new EmbedBuilder()
                        .setColor(0x57F287)
                        .setTitle(`${EMOJI.event_success || '✅'} Successfully Linked!`)
                        .setDescription(`Linked successfully as **${userData.username}** in MongoDB database securely.`);

                    await interaction.editReply({ embeds: [successEmbed] });
                    return;
                }

                if (interaction.customId.startsWith('link_modal_slot_')) {
                    await handlePremiumModal(interaction, client);
                    return;
                }
            }

            // 9. Quest Select Menu Handler
            if (interaction.isStringSelectMenu() && (interaction.customId === 'quest_select' || interaction.customId.startsWith('quest_select_'))) {
                await interaction.deferUpdate();
                const selectedQuestId = interaction.values[0];
                const panel = await buildQuestSolverPanel(client, guildId, userId, selectedQuestId);
                const replyMsg = await interaction.editReply(panel);
                if (replyMsg?.id) setPanelOwner(replyMsg.id, userId);
                return;
            }

            // 10. Refresh Button Handler (Preserves selected quest context)
            if (interaction.isButton() && interaction.customId === 'quest_refresh') {
                await interaction.deferUpdate();

                let currentQuestId = null;
                try {
                    const row = interaction.message.components.find(r => r.components?.some(c => c.customId === 'quest_select'));
                    const menu = row?.components?.find(c => c.customId === 'quest_select');
                    if (menu?.options) {
                        const defaultOpt = menu.options.find(o => o.default);
                        if (defaultOpt) currentQuestId = defaultOpt.value;
                    }
                } catch {}

                const timeString = new Date().toLocaleTimeString();
                const loadingLogs = `${EMOJI.event_loading || '🔄'} Refreshing quests...\n[${timeString}] Fetching latest progress from Discord...`;

                const panel = await buildQuestSolverPanel(client, guildId, userId, currentQuestId, loadingLogs);
                const replyMsg = await interaction.editReply(panel);
                if (replyMsg?.id) setPanelOwner(replyMsg.id, userId);

                setTimeout(async () => {
                    const freshPanel = await buildQuestSolverPanel(client, guildId, userId, currentQuestId);
                    const freshMsg = await interaction.editReply(freshPanel).catch(() => {});
                    if (freshMsg?.id) setPanelOwner(freshMsg.id, userId);
                }, 1500);

                return;
            }

            // 11. Start Button Handler — Fully Fixed with Live Progress Tracking & Logs
            if (interaction.isButton() && interaction.customId.startsWith('quest_start_')) {
                await interaction.deferUpdate();
                const questId = interaction.customId.replace('quest_start_', '');
                const runnerKey = `${guildId}_${userId}`;

                if (activeRunners.has(runnerKey)) {
                    const existing = activeRunners.get(runnerKey);
                    existing.isRunning = false;
                    clearInterval(existing.interval);
                    activeRunners.delete(runnerKey);
                }

                const tokenStore = client.tokenStore;
                const active = await tokenStore.getActiveSlot(guildId, userId);
                const token = active ? (active.token || await tokenStore.get(guildId, userId, active.slot)) : null;

                if (!active || !token) {
                    await interaction.followUp({ content: `${EMOJI.event_error || '❌'} No active token slot found! Use \`/link\` first.`, flags: 64 });
                    return;
                }

                const cleanToken = typeof token === 'string' ? token.trim().replace(/['"]+/g, '') : token;
                const qc = new QuestClient(cleanToken);

                let manager;
                try {
                    manager = await qc.fetchQuests();
                } catch (err) {
                    const errorPanel = await buildQuestSolverPanel(client, guildId, userId, questId, `${EMOJI.event_error || '❌'} Fetch Error: ${err.message}`);
                    const errorMsg = await interaction.editReply(errorPanel);
                    if (errorMsg?.id) setPanelOwner(errorMsg.id, userId);
                    return;
                }

                const quest = manager.get(questId);
                if (!quest) {
                    const missingPanel = await buildQuestSolverPanel(client, guildId, userId, questId, `${EMOJI.event_error || '❌'} Quest ID ${questId} not found or expired.`);
                    const missingMsg = await interaction.editReply(missingPanel);
                    if (missingMsg?.id) setPanelOwner(missingMsg.id, userId);
                    return;
                }

                const questName = quest.config?.messages?.quest_name || quest.config?.application?.name || 'Discord Quest';

                if (quest.isCompleted()) {
                    const claimLog = `${EMOJI.event_gift || '🎁'} Claiming reward for quest: ${questName}...`;
                    const claimPanel = await buildQuestSolverPanel(client, guildId, userId, questId, claimLog);
                    const claimMsg = await interaction.editReply(claimPanel);
                    if (claimMsg?.id) setPanelOwner(claimMsg.id, userId);

                    const claimedCount = await manager.claimRewards(async (msg) => {
                        console.log(`[Claim Log] ${msg}`);
                    }, quest.id);

                    const resultLog = claimedCount > 0
                        ? `${EMOJI.event_success || '🎉'} Quest completed & reward claimed successfully!`
                        : `${EMOJI.event_warn || '⚠️'} Quest completed, reward already claimed or pending verification.`;

                    const finalPanel = await buildQuestSolverPanel(client, guildId, userId, questId, resultLog);
                    const finalMsg = await interaction.editReply(finalPanel);
                    if (finalMsg?.id) setPanelOwner(finalMsg.id, userId);
                    return;
                }

                const runnerContext = { isRunning: true, interval: null, notified: false, latestLog: `Quest initialized.\n[${new Date().toLocaleTimeString()}] Fast mode active.` };
                activeRunners.set(runnerKey, runnerContext);

                const initPanel = await buildQuestSolverPanel(client, guildId, userId, questId, runnerContext.latestLog);
                const initMsg = await interaction.editReply(initPanel);
                if (initMsg?.id) setPanelOwner(initMsg.id, userId);

                manager.doingQuest(
                    quest, 
                    async (msg) => {
                        console.log(`[Quest Runner Log] ${msg}`);
                        runnerContext.latestLog += `\n[${new Date().toLocaleTimeString()}] ${msg}`;
                    }, 
                    async (done, total) => {
                        const pct = Math.min(100, Math.floor((done / total) * 100));
                        runnerContext.latestLog += `\n[${new Date().toLocaleTimeString()}] Progress -> ${pct}%`;
                    }
                ).then(async (success) => {
                    runnerContext.isRunning = false;
                    if (activeRunners.get(runnerKey) === runnerContext) {
                        clearInterval(runnerContext.interval);
                        activeRunners.delete(runnerKey);
                    }

                    const doneLog = success
                        ? `${EMOJI.event_success || '🎉'} Quest completed successfully!`
                        : `${EMOJI.event_warn || '⚠️'} Quest runner finished. Claiming rewards...`;

                    runnerContext.latestLog += `\n[${new Date().toLocaleTimeString()}] ${doneLog}`;
                    
                    try {
                        await manager.claimRewards(console.log, quest.id);
                    } catch {}

                    const completePanel = await buildQuestSolverPanel(client, guildId, userId, questId, runnerContext.latestLog);
                    const completeMsg = await interaction.editReply(completePanel).catch(() => {});
                    if (completeMsg?.id) setPanelOwner(completeMsg.id, userId);

                    if (success && !runnerContext.notified) {
                        runnerContext.notified = true;
                        const specificQuestLink = `https://discord.com/quests/${questId}`;
                        try {
                            const targetUser = await client.users.fetch(userId);
                            await targetUser.send(`${EMOJI.event_success || '🎉'} **Quest Completed Successfully!**\n\n📌 **Quest Name:** ${questName}\n🆔 **Quest ID:** \`${questId}\`\n✨ **Status:** 100% Completed\n🔗 **View Quest:** ${specificQuestLink}`);
                        } catch {
                            await interaction.followUp({
                                content: `<@${userId}> ${EMOJI.event_success || '🎉'} **Quest Completed!**\n📌 **Quest Name:** ${questName}\n🔗 ${specificQuestLink}`,
                                allowedMentions: { users: [userId] }
                            }).catch(() => {});
                        }
                    }
                }).catch((err) => {
                    runnerContext.isRunning = false;
                    console.error('Quest execution error:', err);
                });

                runnerContext.interval = setInterval(async () => {
                    if (!runnerContext.isRunning) {
                        clearInterval(runnerContext.interval);
                        activeRunners.delete(runnerKey);
                        return;
                    }

                    try {
                        const autoPanel = await buildQuestSolverPanel(client, guildId, userId, questId, runnerContext.latestLog);
                        const autoMsg = await interaction.editReply(autoPanel).catch(() => {});
                        if (autoMsg?.id) setPanelOwner(autoMsg.id, userId);
                    } catch (e) {
                        console.error('Auto-refresh UI update error:', e.message);
                    }
                }, 4000);

                setTimeout(() => {
                    if (activeRunners.get(runnerKey) === runnerContext) {
                        runnerContext.isRunning = false;
                        clearInterval(runnerContext.interval);
                        activeRunners.delete(runnerKey);
                    }
                }, 10 * 60 * 1000);

                return;
            }

            // 12. Stop Button Handler
            if (interaction.isButton() && interaction.customId.startsWith('quest_stop_')) {
                await interaction.deferUpdate();
                const questId = interaction.customId.replace('quest_stop_', '');
                const runnerKey = `${guildId}_${userId}`;

                if (activeRunners.has(runnerKey)) {
                    const existing = activeRunners.get(runnerKey);
                    existing.isRunning = false;
                    clearInterval(existing.interval);
                    activeRunners.delete(runnerKey);
                }

                const stopLog = `⏹️ Stopped\n[${new Date().toLocaleTimeString()}] Quest runner stopped by user.`;
                const panel = await buildQuestSolverPanel(client, guildId, userId, questId, stopLog);
                const stopMsg = await interaction.editReply(panel);
                if (stopMsg?.id) setPanelOwner(stopMsg.id, userId);
                return;
            }

            // 13. Slash Commands Handler
            if (interaction.isChatInputCommand()) {
                const command = client.commands.get(interaction.commandName);
                if (!command) return;
                await command.execute(interaction, client);
            }
        } catch (err) {
            console.error('❌ Interaction Error:', err);
            const EMOJI = await getEmojis(interaction.guildId || 'global');
            const msg = { content: `${EMOJI.event_error || '❌'} Something went wrong.`, flags: 64 };
            if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
                await interaction.reply(msg).catch(() => {});
            } else if (interaction.isRepliable() && interaction.deferred) {
                await interaction.followUp(msg).catch(() => {});
            }
        }
    },
};
