import {
    ContainerBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder,
    SeparatorBuilder, SeparatorSpacingSize, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags, SlashCommandBuilder
} from 'discord.js';

const SUPPORT_SERVER = 'https://discord.gg/y5f29e5tQb';
const DEFAULT_PREFIX = process.env.PREFIX || ';';

function getAccountAge(discordId) {
    try {
        const ts = Number((BigInt(discordId) >> 22n) + 1420070400000n);
        const days = Math.floor((Date.now() - ts) / 86400000);
        if (days < 30) return `${days} days ago`;
        const months = Math.floor(days / 30);
        if (months < 12) return `${months} months ago`;
        return `${Math.floor(months/12)} years ago`;
    } catch {
        return 'N/A';
    }
}

function getPrefix(client, guildId) {
    try {
        if (client?.config?.prefix) return client.config.prefix;
        if (client?.prefix) return client.prefix;
        if (client?.getPrefix) return client.getPrefix(guildId);
    } catch {}
    return DEFAULT_PREFIX;
}

export async function buildPremiumLinkPanel(guildId, ownerId, tokenStore, client) {
    const accounts = await tokenStore.getAllSlots(guildId, ownerId);
    const prefix = getPrefix(client, guildId);

    const c1 = new ContainerBuilder();
    c1.addTextDisplayComponents(new TextDisplayBuilder().setContent('# Premium Link'));
    c1.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `**Terms & Privacy**\nBy linking your Discord token, you allow the premium bot to use it for quest completion.\nUse \`${prefix}guide\` if you need the exact token flow guide first.`
    ));
    c1.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Support server: ${SUPPORT_SERVER}`));

    const c2 = new ContainerBuilder();
    c2.addTextDisplayComponents(new TextDisplayBuilder().setContent('## Account Panel'));

    for (let slotNum = 1; slotNum <= 5; slotNum++) {
        const linked = accounts.find(a => a.slot === slotNum);
        if (!linked) {
            c2.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `### #${slotNum} Account Configuration\n• Not Linked (${slotNum===1?'Free Slot': slotNum===2?'Booster Slot': `Slot ${slotNum}`})\n• Status: Not Active\n• Account Age: N/A\n• Linked At: N/A`
            ));
            c2.addActionRowComponents(new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`link_slot_${slotNum}`).setLabel('Link').setStyle(ButtonStyle.Success)
            ));
        } else {
            const status = linked.isActive ? 'Active' : 'Not Active';
            const age = getAccountAge(linked.linkedUserId);
            const linkedAt = linked.linkedAt ? new Date(linked.linkedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A';
            const avatarUrl = linked.avatar ? `https://cdn.discordapp.com/avatars/${linked.linkedUserId}/${linked.avatar}.png?size=128` : null;
            const content = `### #${slotNum} Account Configuration\n• ${linked.username} (${linked.linkedUserId})\n• Status: ${status}\n• Account Age: ${age}\n• Linked At: ${linkedAt}`;
            
            if (avatarUrl) {
                c2.addSectionComponents(new SectionBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(content)).setThumbnailAccessory(new ThumbnailBuilder().setURL(avatarUrl)));
            } else {
                c2.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));
            }

            const row = new ActionRowBuilder();
            row.addComponents(new ButtonBuilder().setCustomId(`unlink_slot_${slotNum}`).setLabel('Unlink').setStyle(ButtonStyle.Danger));
            if (!linked.isActive) {
                row.addComponents(new ButtonBuilder().setCustomId(`select_slot_${slotNum}`).setLabel('Select').setStyle(ButtonStyle.Primary));
            }
            c2.addActionRowComponents(row);
        }
        if (slotNum < 5) {
            c2.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        }
    }
    c2.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Active slot will run quests — Support: ${SUPPORT_SERVER}`));
    return { components: [c1, c2], flags: MessageFlags.IsComponentsV2 };
}

export function buildLinkModal(slot) {
    const m = new ModalBuilder().setCustomId(`link_modal_slot_${slot}`).setTitle(`Link Slot ${slot}`);
    m.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('token_input').setLabel('Discord Token').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Paste Authorization header...')
    ));
    return m;
}

export const data = new SlashCommandBuilder().setName('link').setDescription('Premium Link - 5 slots');

export async function execute(interaction, client) {
    await interaction.deferReply({ flags: MessageFlags.IsComponentsV2 });
    const panel = await buildPremiumLinkPanel(interaction.guild.id, interaction.user.id, client.tokenStore, client);
    await interaction.editReply(panel);
}

export async function handleButton(interaction, client) {
    if (interaction.customId.startsWith('link_slot_')) {
        return await interaction.showModal(buildLinkModal(parseInt(interaction.customId.split('_')[2])));
    }
    if (interaction.customId.startsWith('unlink_slot_')) {
        await client.tokenStore.removeSlot(interaction.guild.id, interaction.user.id, parseInt(interaction.customId.split('_')[2]));
        const panel = await buildPremiumLinkPanel(interaction.guild.id, interaction.user.id, client.tokenStore, client);
        return await interaction.update(panel);
    }
    if (interaction.customId.startsWith('select_slot_')) {
        await client.tokenStore.setActiveSlot(interaction.guild.id, interaction.user.id, parseInt(interaction.customId.split('_')[2]));
        const panel = await buildPremiumLinkPanel(interaction.guild.id, interaction.user.id, client.tokenStore, client);
        return await interaction.update(panel);
    }
}

export async function handleModal(interaction, client) {
    if (!interaction.customId.startsWith('link_modal_slot_')) return;
    await interaction.deferReply({ flags: 64 });
    const slot = parseInt(interaction.customId.split('_')[3]);
    const token = interaction.fields.getTextInputValue('token_input').trim();
    try {
        const res = await fetch('https://discord.com/api/v10/users/@me', { headers: { Authorization: token } });
        if (!res.ok) throw new Error('Invalid token');
        const data = await res.json();
        await client.tokenStore.saveSlot({
            guildId: interaction.guild.id, ownerId: interaction.user.id, slot, token,
            linkedUserId: data.id, username: data.username, avatar: data.avatar, linkedAt: new Date()
        });
        const panel = await buildPremiumLinkPanel(interaction.guild.id, interaction.user.id, client.tokenStore, client);
        await interaction.editReply({ content: `✅ Slot ${slot} Linked as ${data.username}`, components: panel.components, flags: MessageFlags.IsComponentsV2 });
    } catch (e) {
        await interaction.editReply({ content: `❌ ${e.message}` });
    }
}
