/**
 * slotUI.js - Slot UI - Premium Link Panel - Progressive Roles (MongoDB 6-Slot Compatible)
 * Location: src/quest/slotUI.js
 */

import {
    ContainerBuilder,
    TextDisplayBuilder,
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

const DEFAULT_PREFIX = process.env.PREFIX || ';';

export function buildLinkModal(slotNumber = 1) {
    const modal = new ModalBuilder().setCustomId(`link_modal_slot_${slotNumber}`).setTitle(`Link Slot #${slotNumber}`);
    modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('token_input').setLabel('Discord User Token').setStyle(TextInputStyle.Short).setPlaceholder(`Paste token for Slot #${slotNumber}...`).setRequired(true)
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

    const c = new ContainerBuilder().setAccentColor(0x2B2D31);

    const stageText = isTrialActive ? 'Active Trial (Slot #1 Only)' : 'Progressive Access';

    // Fixed Top Header without any typo bugs
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `# Premium Link\n## Terms & Privacy\n> By linking your Discord token, you allow the premium bot to use it for quest completion. Use \`${DEFAULT_PREFIX}guide\` if you need the token flow guide first.\n> **Status:** ${stageText}\n> **Invites:** ${invites} | **Boosts:** ${boosts}\n`
    ));
    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true));
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# Account Panel (${slotsToShow} Visible Slots)`));

    for (const s of slots) {
        const linked = accounts.find(a => a.slot === s.slot);

        if (linked) {
            const status = linked.isActive ? `Active ${EMOJI.slot_success || '✅'}` : 'Not Active';
            const linkedAtStr = linked.linkedAt ? new Date(linked.linkedAt).toLocaleDateString() : 'N/A';
            
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `### #${s.slot} Account Configuration - ${s.label}\n` +
                `• ${linked.username || 'Linked Account'} - ${s.label}\n` +
                `• Status: ${status}\n` +
                `• Requirement: ${s.need || 'Free'}\n` +
                `• Linked At: ${linkedAtStr}`
            ));
            
            const row = new ActionRowBuilder();
            row.addComponents(new ButtonBuilder().setCustomId(`unlink_slot_${s.slot}_btn`).setLabel('Unlink').setStyle(ButtonStyle.Danger));
            if (!linked.isActive) {
                row.addComponents(new ButtonBuilder().setCustomId(`select_slot_${s.slot}_btn`).setLabel('Select').setStyle(ButtonStyle.Primary));
            }
            c.addActionRowComponents(row);
        } else {
            if (s.can) {
                c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `### #${s.slot} Account Configuration - ${s.label}\n` +
                    `• Not Linked (${s.label})\n` +
                    `• Status: Not Active\n` +
                    `• Requirement: ${s.need || 'Free'} - ${EMOJI.slot_success || '✅'} Unlocked\n` +
                    `• Your Progress: ${invites} invites, ${boosts} boosts\n` +
                    `• ${s.reason}`
                ));
                c.addActionRowComponents(new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`link_slot_${s.slot}_btn`).setLabel('Link').setStyle(ButtonStyle.Success)
                ));
            } else {
                c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `### #${s.slot} Account Configuration - ${s.label} ${EMOJI.slot_lock || '🔒'}\n` +
                    `• Locked\n` +
                    `• Status: Locked\n` +
                    `• Requirement: ${s.need || 'N/A'}\n` +
                    `• Your Progress: ${invites} invites, ${boosts} boosts\n` +
                    `• ${s.reason}`
                ));
                c.addActionRowComponents(new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`locked_slot_${s.slot}_btn`).setLabel(`Locked - Slot #${s.slot}`).setStyle(ButtonStyle.Secondary).setDisabled(true)
                ));
            }
        }
    }

    let guide = isTrialActive 
        ? `-# 📌 **Trial Notice:** You have an active trial. Only Slot #1 is available until your trial expires or you unlock progressive roles.`
        : `-# 📌 Progressive system active: Keep inviting or boosting to unlock more slots!`;

    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(guide));

    return { components: [c], flags: MessageFlags.IsComponentsV2 };
}

export async function handleButton(interaction, client) {
    const guildId = interaction.guild.id; 
    const ownerId = interaction.user.id; 
    const member = interaction.member;
    const EMOJI = await getEmojis(guildId);

    if (interaction.customId.startsWith('link_slot_') && interaction.customId.endsWith('_btn')) {
        const slotNum = parseInt(interaction.customId.split('_')[2]);
        const prog = await getProgressiveSlots(member);
        const slotData = prog.slots.find(s => s.slot === slotNum);
        if (!slotData?.can) {
            const c = new ContainerBuilder().setAccentColor(0xFEE75C);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${EMOJI.slot_lock || '🔒'} Slot #${slotNum} Locked\n**Need:** ${slotData?.need}\n${slotData?.reason}`));
            return await interaction.reply({ components: [c], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
        }
        return await interaction.showModal(buildLinkModal(slotNum));
    }
    
    if (interaction.customId.startsWith('unlink_slot_') && interaction.customId.endsWith('_btn')) {
        const slot = parseInt(interaction.customId.split('_')[2]);
        await client.tokenStore.removeSlot(guildId, ownerId, slot);
        const panel = await buildSlotPanel(member, 0, client.tokenStore);
        return await interaction.update(panel);
    }
    
    if (interaction.customId.startsWith('select_slot_') && interaction.customId.endsWith('_btn')) {
        const slot = parseInt(interaction.customId.split('_')[2]);
        await client.tokenStore.setActiveSlot(guildId, ownerId, slot);
        const panel = await buildSlotPanel(member, 0, client.tokenStore);
        return await interaction.update(panel);
    }
    
    if (interaction.customId.startsWith('locked_slot_') && interaction.customId.endsWith('_btn')) {
        const slotNum = parseInt(interaction.customId.split('_')[2]);
        const prog = await getProgressiveSlots(member);
        const slotData = prog.slots.find(s => s.slot === slotNum);
        const c = new ContainerBuilder().setAccentColor(0xFEE75C);
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${EMOJI.slot_lock || '🔒'} Slot #${slotNum} Locked\n**${slotData?.reason}**\nNeed: ${slotData?.need}`));
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
        const panel = await buildSlotPanel(interaction.member, 0, client.tokenStore);
        await interaction.editReply(panel);
    } catch (e) {
        const c = new ContainerBuilder().setAccentColor(0xED4245);
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${EMOJI.slot_error || '❌'} Failed to Link\n${e.message}`));
        await interaction.editReply({ components: [c], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    }
}
