/**
 * setupRolesCommand.js - Final Clean Version
 * Location: src/commands/setupRolesCommand.js
 */

import { SlashCommandBuilder, PermissionFlagsBits, ContainerBuilder, TextDisplayBuilder, MessageFlags } from 'discord.js';
import { getRoles, setRole, removeRole, syncRolesFromDB } from '../quest/roleStore.js';

export const data = new SlashCommandBuilder()
    .setName('setuproles')
    .setDescription('Setup 4 roles for progressive slots — Per guild — Multi server')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
        sub.setName('set')
            .setDescription('Set a role for progressive system')
            .addStringOption(opt =>
                opt.setName('key')
                    .setDescription('Which role slot — 4 roles')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Role1 — 2 Invites — Slot2 need', value: 'ROLE_2_INVITES' },
                        { name: 'Role2 — 5 Invite per — Slot3 need', value: 'ROLE_5_INVITES' },
                        { name: 'Role3 — 1 Boost — Slot4 need', value: 'ROLE_1_BOOST' },
                        { name: 'Role4 — 2 Boosts — Slot5 need — Full', value: 'ROLE_2_BOOST' },
                    )
            )
            .addRoleOption(opt =>
                opt.setName('role')
                    .setDescription('Select role to set — Mention role')
                    .setRequired(true)
            )
    )
    .addSubcommand(sub =>
        sub.setName('remove')
            .setDescription('Remove a role')
            .addStringOption(opt =>
                opt.setName('key')
                    .setDescription('Which role to remove')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Role1 — 2 Invites', value: 'ROLE_2_INVITES' },
                        { name: 'Role2 — 5 Invite per', value: 'ROLE_5_INVITES' },
                        { name: 'Role3 — 1 Boost', value: 'ROLE_1_BOOST' },
                        { name: 'Role4 — 2 Boosts', value: 'ROLE_2_BOOST' },
                    )
            )
    )
    .addSubcommand(sub =>
        sub.setName('view')
            .setDescription('View current 4 roles — Per guild')
    )
    .addSubcommand(sub =>
        sub.setName('sync')
            .setDescription('Sync roles from MongoDB — Reset safe')
    );

export async function execute(interaction) {
    try {
        const guildId = interaction.guild.id;
        const sub = interaction.options.getSubcommand();

        if (sub === 'view') {
            await interaction.deferReply({ flags: MessageFlags.IsComponentsV2 });
            const roles = getRoles(guildId);
            const c = new ContainerBuilder().setAccentColor(0x5865F2);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `# ⚙️ SetupRoles — Current 4 Roles — ${interaction.guild.name}\n` +
                `**GuildId:** ${guildId} — Multi server — Per guild separate\n\n` +
                `**Role1 — 2 Invites — Slot2 need:** ${roles.ROLE_2_INVITES ? `<@&${roles.ROLE_2_INVITES}>` : '❌ Not set'}\n` +
                `**Role2 — 5 Invite per — Slot3 need:** ${roles.ROLE_5_INVITES ? `<@&${roles.ROLE_5_INVITES}>` : '❌ Not set'}\n` +
                `**Role3 — 1 Boost — Slot4 need:** ${roles.ROLE_1_BOOST ? `<@&${roles.ROLE_1_BOOST}>` : '❌ Not set'}\n` +
                `**Role4 — 2 Boosts — Slot5 need — Full:** ${roles.ROLE_2_BOOST ? `<@&${roles.ROLE_2_BOOST}>` : '❌ Not set'}\n\n` +
                `**Progressive Flow:**\n` +
                `No role → 2 slots (Free + 2 inv) → Role1 (2 inv) → 3 slots → Role2 (5 inv) → 4 slots → Role3 (1 boost) → 5 slots → Role4 (2 boosts) → Full 5 slots 👑\n\n` +
                `-# Use /setuproles set — To set roles — /setuproles sync — Reset safe`
            ));
            await interaction.editReply({ components: [c], flags: MessageFlags.IsComponentsV2 });
            return;
        }

        if (sub === 'set') {
            await interaction.deferReply({ flags: MessageFlags.IsComponentsV2 });
            const key = interaction.options.getString('key');
            const role = interaction.options.getRole('role');
            await setRole(guildId, key, role.id);
            const c = new ContainerBuilder().setAccentColor(0x57F287);
            const roleNames = {
                ROLE_2_INVITES: 'Role1 — 2 Invites — Slot2',
                ROLE_5_INVITES: 'Role2 — 5 Invite per — Slot3',
                ROLE_1_BOOST: 'Role3 — 1 Boost — Slot4',
                ROLE_2_BOOST: 'Role4 — 2 Boosts — Slot5 — Full'
            };
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `# ✅ Role Set — Per Guild — Multi Server Safe\n` +
                `**${roleNames[key]}** → ${role}\n` +
                `**Guild:** ${interaction.guild.name}\n` +
                `**Saved:** MongoDB + File + Memory — Reset safe — No crash\n\n` +
                `-# Use /setuproles view — To see all 4 roles`
            ));
            await interaction.editReply({ components: [c], flags: MessageFlags.IsComponentsV2 });
            return;
        }

        if (sub === 'remove') {
            await interaction.deferReply({ flags: MessageFlags.IsComponentsV2 });
            const key = interaction.options.getString('key');
            await removeRole(guildId, key);
            const c = new ContainerBuilder().setAccentColor(0xED4245);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `# 🗑️ Role Removed — ${key}\n` +
                `**Guild:** ${interaction.guild.name}\n` +
                `**Removed from:** MongoDB + File + Memory\n\n` +
                `-# Use /setuproles view — To see remaining`
            ));
            await interaction.editReply({ components: [c], flags: MessageFlags.IsComponentsV2 });
            return;
        }

        if (sub === 'sync') {
            await interaction.deferReply({ flags: MessageFlags.IsComponentsV2 });
            await syncRolesFromDB();
            const roles = getRoles(guildId);
            const c = new ContainerBuilder().setAccentColor(0x5865F2);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `# 🔄 Synced from MongoDB — Reset Safe\n` +
                `**Guild:** ${interaction.guild.name}\n` +
                `**Loaded:** ${Object.keys(roles).filter(k => roles[k]).length}/4 roles set\n\n` +
                `-# MongoDB → File → Memory — 3 layer — No data loss`
            ));
            await interaction.editReply({ components: [c], flags: MessageFlags.IsComponentsV2 });
            return;
        }

    } catch (err) {
        console.error("setupRolesCommand error:", err.message);
        try {
            const c = new ContainerBuilder().setAccentColor(0xED4245);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ❌ Error\n${err.message}`));
            if (interaction.deferred) await interaction.editReply({ components: [c], flags: MessageFlags.IsComponentsV2 });
            else await interaction.reply({ components: [c], flags: MessageFlags.IsComponentsV2 | 64 });
        } catch {}
    }
}

export const setupRolesCmd = {
    data,
    execute
};
