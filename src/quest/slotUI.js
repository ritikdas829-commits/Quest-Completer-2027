/**
 * slotUI.js - Slot UI - Premium Link Panel - Progressive 4 Roles
 * Location: src/quest/slotUI.js
 * UI similar to Photo 1 - Shows 2,3,4,5 slots progressively
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
import { PREFIX } from '../utils/config.js';

export function buildLinkModal(slotNumber = 1) {
    const modal = new ModalBuilder().setCustomId(`slot_link_modal_slot_${slotNumber}`).setTitle(`Link Slot #${slotNumber}`);
    modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('link_token_input').setLabel('Your Discord user token').setStyle(TextInputStyle.Short).setPlaceholder(`Paste token for Slot #${slotNumber}`).setRequired(true)
    ));
    return modal;
}

export async function buildSlotPanel(member, inviteStore, tokenStore) {
    const { slots, invites, boosts, slotsToShow, stage, roles } = await getProgressiveSlots(member, inviteStore);

    const c = new ContainerBuilder().setAccentColor(0x2B2D31);

    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `# Premium Link\n## Terms & Privacy\n> By linking your Discord token, you allow premium bot to use it for quest completion. Use \`${PREFIX}guide\` if you need guide first.\n> **Stage:** ${stage}\n> Invites: ${invites} | Boosts: ${boosts}\n`
    ));
    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true));
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# Account Panel - ${slotsToShow} Slots - 4 Roles System`));

    for (const s of slots) {
        const token = tokenStore.get(`${member.id}_slot_${s.slot}`);
        const username = tokenStore.get(`${member.id}_slot_${s.slot}_username`) || '';

        if (token) {
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `### #${s.slot} Account Configuration - ${s.label}\n` +
                `• ${username || 'Linked'} - ${s.label}\n` +
                `• Status: Active ✅\n` +
                `• Requirement: ${s.need}\n` +
                `• Role: ${s.needRoleId ? `<@&${s.needRoleId}>` : 'Free'}\n` +
                `• Linked At: ${new Date().toLocaleDateString()}`
            ));
            c.addActionRowComponents(new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`unlink_slot_${s.slot}_btn`).setLabel('Unlink').setStyle(ButtonStyle.Danger)
            ));
        } else {
            if (s.can) {
                c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `### #${s.slot} Account Configuration - ${s.label}\n` +
                    `• Not Linked (${s.label})\n` +
                    `• Status: Not Active\n` +
                    `• Requirement: ${s.need} - ✅ Unlocked\n` +
                    `• Your Progress: ${s.currentInvites} invites, ${s.currentBoosts} boosts\n` +
                    `• ${s.reason}`
                ));
                c.addActionRowComponents(new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`link_slot_${s.slot}_btn`).setLabel('Link').setStyle(ButtonStyle.Success)
                ));
            } else {
                c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `### #${s.slot} Account Configuration - ${s.label} 🔒\n` +
                    `• Locked\n` +
                    `• Status: Locked\n` +
                    `• Need: ${s.need} - ${s.needRoleId ? `<@&${s.needRoleId}>` : 'Role not set - Use /setuproles'}\n` +
                    `• Your Progress: ${s.currentInvites} invites, ${s.currentBoosts} boosts\n` +
                    `• ${s.reason}`
                ));
                c.addActionRowComponents(new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`locked_slot_${s.slot}_btn`).setLabel(`Locked - ${s.need}`).setStyle(ButtonStyle.Secondary).setDisabled(true)
                ));
            }
        }
    }

    let guide = '';
    if (slotsToShow === 2) guide = `-# 📌 No role: 2 slots → Free + 2 invites (Role 1) → Invite 2 members for Slot 2!`;
    else if (slotsToShow === 3) guide = `-# 📌 Invite access: 3 slots → 2 access + 3rd needs Role 2: 5 invite per - Invite 3 more for Slot 3!`;
    else if (slotsToShow === 4) guide = `-# 📌 3 slot access: 4 slots visible - Say boost! Role 3: 1 Boost needed for Slot 4`;
    else if (slotsToShow === 5 && boosts < 2) guide = `-# 📌 1 boost: 5 slots visible - Role 4: 2 Boosts required for Slot 5 full access!`;
    else guide = `-# 👑 Full 5 slots - 4 Roles completed - All access - 5 accounts!`;

    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(guide));

    const rolesText = `**4 Roles Setup:**\n` +
        `Role 1 (2 Inv): ${roles.ROLE_2_INVITES ? `<@&${roles.ROLE_2_INVITES}> ✅` : '❌ Not set - Use /setuproles'}\n` +
        `Role 2 (5 Inv): ${roles.ROLE_5_INVITES ? `<@&${roles.ROLE_5_INVITES}> ✅` : '❌ Not set'}\n` +
        `Role 3 (1 Boost): ${roles.ROLE_1_BOOST ? `<@&${roles.ROLE_1_BOOST}> ✅` : '❌ Not set'}\n` +
        `Role 4 (2 Boost): ${roles.ROLE_2_BOOST ? `<@&${roles.ROLE_2_BOOST}> ✅` : '❌ Not set'}`;

    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`\n${rolesText}`));

    return { components: [c], flags: MessageFlags.IsComponentsV2 };
}
