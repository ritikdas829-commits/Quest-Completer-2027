/**
 * slotUI.js - Full Detailed UI & Progressive Link Engine (MongoDB 6-10 Slot Compatible)
 * Location: src/quest/slotUI.js
 */

import {
    ContainerBuilder,
    TextDisplayBuilder,
    SectionBuilder,
    ThumbnailBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js';
import { getProgressiveSlots } from './slotSystem.js';
import { getEmojis } from './emoji.js';

const DEFAULT_PREFIX = process.env.PREFIX || process.env.BOT_PREFIX || ';';
const SUPPORT_SERVER = 'https://discord.gg/y5f29e5tQb';

function getAccountAge(discordId) {
    try {
        if (!discordId) return 'N/A';
        const ts = Number((BigInt(discordId) >> 22n) + 1420070400000n);
        const days = Math.floor((Date.now() - ts) / 86400000);
        if (days < 30) return `${days} days ago`;
        const months = Math.floor(days / 30);
        if (months < 12) return `${months} months ago`;
        return `${Math.floor(months/12)} years ago`;
    } catch { return 'N/A'; }
}

export function buildLinkModal(slotNumber = 1) {
    const modal = new ModalBuilder().setCustomId(`link_modal_slot_${slotNumber}`).setTitle(`Link Slot #${slotNumber}`);
    modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder()
            .setCustomId('token_input')
            .setLabel('Discord User Token')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(`Paste Discord token for Slot #${slotNumber}...`)
            .setRequired(true)
    ));
    return modal;
}

export async function buildSlotPanel(member, inviteStore, tokenStore) {
    const guildId = member.guild?.id;
    const userId = member.id || member.user?.id;
    const EMOJI = await getEmojis(guildId || 'global');
    
    // Fetch slots and stats safely from slotSystem
    const slotData = await getProgressiveSlots(member);
    const { slots, invites, boosts, slotsToShow, isTrialActive } = slotData;
    
    // Fetch all linked slots safely from MongoDB/TokenStore
    let accounts = [];
    try {
        const res = tokenStore && typeof tokenStore.getAllSlots === 'function' ? await tokenStore.getAllSlots(guildId, userId) : [];
        accounts = Array.isArray(res) ? res : Object.values(res || {});
    } catch {
        accounts = [];
    }

    if (accounts.length > 0) {
        const activeAccounts = accounts.filter(a => a.isActive);
        if (activeAccounts.length !== 1) {
            const targetActiveSlot = activeAccounts.length > 0 ? activeAccounts[0].slot : accounts[0].slot;
            if (tokenStore && typeof tokenStore.setActiveSlot === 'function') {
                await tokenStore.setActiveSlot(guildId, userId, targetActiveSlot);
                const res = await tokenStore.getAllSlots(guildId, userId);
                accounts = Array.isArray(res) ? res : Object.values(res || {});
            }
        }
    }

    // Container 1: Info & Stats Header
    const c1 = new ContainerBuilder().setAccentColor(0x5865F2);
    const stageText = isTrialActive ? 'Active Trial (Slot #1 Only)' : 'Progressive Access';

    c1.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${EMOJI.link_icon || EMOJI.slot_icon || '🔗'} Premium Link`));
    c1.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `**Terms & Privacy**\nBy linking your Discord token, you allow the premium bot to use it for quest completion.\n` +
        `Use \`${DEFAULT_PREFIX}guide\` for token guide. Active slot runs quests — Use \`${DEFAULT_PREFIX}quest\` to run active, \`${DEFAULT_PREFIX}questall\` to run all slots.\n\n` +
        `> **Status:** ${stageText}\n` +
        `> **Invites:** \`${invites}\` | **Boosts:** \`${boosts}\``
    ));
    c1.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Support server: ${SUPPORT_SERVER}`));

    // Container 2: Dynamic Progressive Slots
    const c2 = new ContainerBuilder().setAccentColor(0x2B2D31);
    c2.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${EMOJI.link_gear || EMOJI.slot_gear || '⚙️'} Account Panel (${slotsToShow} Visible Slots)`));

    for (let idx = 0; idx < slots.length; idx++) {
        const s = slots[idx];
        const linked = accounts.find(a => a.slot === s.slot);

        if (!linked) {
            if (s.can) {
                // Unlocked but Not Linked
                c2.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `### #${s.slot} Account Configuration\n` +
                    `• **User:** Not Linked (${s.label})\n` +
                    `• **Status:** Not Active\n` +
                    `• **Requirement:** ${s.need || 'Free'} — ${EMOJI.link_success || EMOJI.slot_success || '✅'} Unlocked\n` +
                    `• **Account Age:** N/A\n` +
                    `• **Linked At:** N/A`
                ));
                c2.addActionRowComponents(new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`link_slot_${s.slot}`).setLabel(`Link #${s.slot}`).setStyle(ButtonStyle.Success).setEmoji('🔗')
                ));
            } else {
                // Locked Slot
                c2.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `### #${s.slot} Account Configuration ${EMOJI.link_lock || EMOJI.slot_lock || '🔒'}\n` +
                    `• **User:** Locked (${s.label})\n` +
                    `• **Status:** Locked\n` +
                    `• **Requirement:** ${s.need || 'N/A'}\n` +
                    `• **Note:** ${s.reason}`
                ));
                c2.addActionRowComponents(new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`locked_slot_${s.slot}`).setLabel(`Locked (${s.need || 'N/A'})`).setStyle(ButtonStyle.Secondary).setDisabled(true).setEmoji('🔒')
                ));
            }
        } else {
            // Linked Account State
            const isCurrentlyActive = Boolean(linked.isActive);
            const status = isCurrentlyActive ? `Active ${EMOJI.link_success || EMOJI.slot_success || '✅'}` : 'Not Active';
            const age = getAccountAge(linked.linkedUserId);
            const linkedAtStr = linked.linkedAt ? new Date(linked.linkedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A';
            const avatarUrl = linked.avatar ? `https://cdn.discordapp.com/avatars/${linked.linkedUserId}/${linked.avatar}.png?size=128` : null;
            
            const content = 
                `### #${s.slot} Account Configuration\n` +
                `• **User:** ${linked.username || 'Linked Account'} (\`${linked.linkedUserId || 'N/A'}\`)\n` +
                `• **Slot Type:** ${s.label}\n` +
                `• **Status:** ${status}\n` +
                `• **Account Age:** ${age}\n` +
                `• **Linked At:** ${linkedAtStr}`;
            
            if (avatarUrl) {
                c2.addSectionComponents(new SectionBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(content)).setThumbnailAccessory(new ThumbnailBuilder().setURL(avatarUrl)));
            } else {
                c2.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));
            }
            
            const row = new ActionRowBuilder();
            row.addComponents(new ButtonBuilder().setCustomId(`unlink_slot_${s.slot}`).setLabel('Unlink').setStyle(ButtonStyle.Danger));
            if (!isCurrentlyActive) {
                row.addComponents(new ButtonBuilder().setCustomId(`select_slot_${s.slot}`).setLabel('Select').setStyle(ButtonStyle.Primary));
            }
            c2.addActionRowComponents(row);
        }

        if (idx < slots.length - 1) {
            c2.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        }
    }

    const guide = isTrialActive 
        ? `-# 📌 **Trial Notice:** You have an active trial. Only Slot #1 is available until your trial expires or you unlock progressive roles.`
        : `-# Active slot will run quests — Support: ${SUPPORT_SERVER}`;

    c2.addTextDisplayComponents(new TextDisplayBuilder().setContent(guide));

    return { components: [c1, c2], flags: MessageFlags.IsComponentsV2 };
}

export async function handleButton(interaction, client) {
    const guildId = interaction.guild.id; 
    const ownerId = interaction.user.id; 
    const member = interaction.member;
    const EMOJI = await getEmojis(guildId);

    // Dynamic Custom ID Matching (Supports both link_slot_X and link_slot_X_btn fallbacks)
    const rawId = interaction.customId;
    
    if (rawId.startsWith('link_slot_')) {
        const parts = rawId.split('_');
        const slotNum = parseInt(parts[2]);
        const prog = await getProgressiveSlots(member);
        const slotData = prog.slots.find(s => s.slot === slotNum);
        
        if (!slotData?.can) {
            const c = new ContainerBuilder().setAccentColor(0xFEE75C);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${EMOJI.link_lock || EMOJI.slot_lock || '🔒'} Slot #${slotNum} Locked\n**Need:** ${slotData?.need}\n${slotData?.reason}`));
            if (interaction.deferred || interaction.replied) {
                return await interaction.followUp({ components: [c], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
            }
            return await interaction.reply({ components: [c], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
        }
        if (interaction.deferred || interaction.replied) return;
        return await interaction.showModal(buildLinkModal(slotNum));
    }
    
    if (rawId.startsWith('unlink_slot_')) {
        const parts = rawId.split('_');
        const slot = parseInt(parts[2]);
        await client.tokenStore.removeSlot(guildId, ownerId, slot);
        const panel = await buildSlotPanel(member, 0, client.tokenStore);
        if (interaction.deferred || interaction.replied) {
            return await interaction.editReply(panel);
        }
        return await interaction.update(panel);
    }
    
    if (rawId.startsWith('select_slot_')) {
        const parts = rawId.split('_');
        const slot = parseInt(parts[2]);
        await client.tokenStore.setActiveSlot(guildId, ownerId, slot);
        const panel = await buildSlotPanel(member, 0, client.tokenStore);
        if (interaction.deferred || interaction.replied) {
            return await interaction.editReply(panel);
        }
        return await interaction.update(panel);
    }
    
    if (rawId.startsWith('locked_slot_')) {
        const parts = rawId.split('_');
        const slotNum = parseInt(parts[2]);
        const prog = await getProgressiveSlots(member);
        const slotData = prog.slots.find(s => s.slot === slotNum);
        const c = new ContainerBuilder().setAccentColor(0xFEE75C);
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${EMOJI.link_lock || EMOJI.slot_lock || '🔒'} Slot #${slotNum} Locked\n**${slotData?.reason}**\nNeed: ${slotData?.need}`));
        if (interaction.deferred || interaction.replied) {
            return await interaction.followUp({ components: [c], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
        }
        return await interaction.reply({ components: [c], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    }
}

export async function handleModal(interaction, client) {
    if (!interaction.customId.startsWith('link_modal_slot_')) return;
    const slot = parseInt(interaction.customId.split('_')[3]);
    const token = interaction.fields.getTextInputValue('token_input').trim();
    const guildId = interaction.guild.id;
    const EMOJI = await getEmojis(guildId);

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
        const prog = await getProgressiveSlots(interaction.member);
        const slotData = prog.slots.find(s => s.slot === slot);
        if (!slotData?.can) throw new Error(`Slot #${slot} locked. ${slotData?.reason}`);
        
        const res = await fetch('https://discord.com/api/v10/users/@me', { headers: { Authorization: token } });
        if (!res.ok) throw new Error('Invalid Discord Token provided');
        const data = await res.json();
        
        await client.tokenStore.saveSlot({ 
            guildId: interaction.guild.id, 
            ownerId: interaction.user.id, 
            slot, 
            token, 
            linkedUserId: data.id, 
            username: data.username, 
            avatar: data.avatar, 
            linkedAt: new Date() 
        });
        
        await client.tokenStore.setActiveSlot(interaction.guild.id, interaction.user.id, slot);
        if (interaction.message) {
            const panel = await buildSlotPanel(interaction.member, 0, client.tokenStore);
            await interaction.message.edit(panel).catch(() => {});
        }
        
        const successContainer = new ContainerBuilder().setAccentColor(0x57F287);
        successContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `# ${EMOJI.link_success || EMOJI.slot_success || '✅'} Slot #${slot} Linked!\nLinked as **"${data.username}"**.\n\nYou can now run quests on this slot.`
        ));
        await interaction.editReply({ components: [successContainer], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    } catch (e) {
        const errContainer = new ContainerBuilder().setAccentColor(0xED4245);
        errContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${EMOJI.link_error || EMOJI.slot_error || '❌'} Failed to Link\n${e.message}`));
        await interaction.editReply({ components: [errContainer], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    }
}
