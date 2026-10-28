/**
 * setupRolesCommand.js - Clean UI & Progressive Slot Roles Management
 * Location: src/commands/setupRolesCommand.js
 */

import { SlashCommandBuilder, PermissionFlagsBits, ContainerBuilder, TextDisplayBuilder, MessageFlags } from 'discord.js';
import { getRolesAsync, setRole, removeRole, syncRolesFromDB } from '../quest/roleStore.js';

export const data = new SlashCommandBuilder()
    .setName('setuproles')
    .setDescription('Setup 5 progressive slot roles for your server')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
        sub.setName('set')
            .setDescription('Set a role for a progressive slot tier')
            .addStringOption(opt =>
                opt.setName('key')
                    .setDescription('Select slot tier')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Slot 2 — 2 Invites Role', value: 'ROLE_2_INVITES' },
                        { name: 'Slot 3 — 5 Invites Role', value: 'ROLE_5_INVITES' },
                        { name: 'Slot 4 — 10 Invites Role', value: 'ROLE_10_INVITES' },
                        { name: 'Slot 4 — 1 Server Boost Role', value: 'ROLE_1_BOOST' },
                        { name: 'Slot 5 — 2 Server Boosts Role (Full Access)', value: 'ROLE_2_BOOST' },
                    )
            )
            .addRoleOption(opt =>
                opt.setName('role')
                    .setDescription('Select the Discord role for this tier')
                    .setRequired(true)
            )
    )
    .addSubcommand(sub =>
        sub.setName('remove')
            .setDescription('Remove a role assignment from a slot tier')
            .addStringOption(opt =>
                opt.setName('key')
                    .setDescription('Select tier to clear')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Slot 2 — 2 Invites Role', value: 'ROLE_2_INVITES' },
                        { name: 'Slot 3 — 5 Invites Role', value: 'ROLE_5_INVITES' },
                        { name: 'Slot 4 — 10 Invites Role', value: 'ROLE_10_INVITES' },
                        { name: 'Slot 4 — 1 Server Boost Role', value: 'ROLE_1_BOOST' },
                        { name: 'Slot 5 — 2 Server Boosts Role', value: 'ROLE_2_BOOST' },
                    )
            )
    )
    .addSubcommand(sub =>
        sub.setName('view')
            .setDescription('View current slot tier roles configuration')
    )
    .addSubcommand(sub =>
        sub.setName('sync')
            .setDescription('Sync and reload roles from MongoDB database')
    );

export async function execute(interaction) {
    try {
        const guildId = interaction.guild.id;
        const sub = interaction.options.getSubcommand();

        if (sub === 'view') {
            await interaction.deferReply({ flags: MessageFlags.IsComponentsV2 });
            const roles = await getRolesAsync(guildId);
            const c = new ContainerBuilder().setAccentColor(0x5865F2);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `# ⚙️ Progressive Slot Roles Config\n` +
                `**Server:** \`${interaction.guild.name}\` | **ID:** \`${guildId}\`\n\n` +
                `### 📩 Invite Tiers\n` +
                `• **Role 1 (2 Invites ➔ Slot 2):** ${roles.ROLE_2_INVITES ? `<@&${roles.ROLE_2_INVITES}>` : '`❌ Not Set`'}\n` +
                `• **Role 2 (5 Invites ➔ Slot 3):** ${roles.ROLE_5_INVITES ? `<@&${roles.ROLE_5_INVITES}>` : '`❌ Not Set`'}\n` +
                `• **Role 3 (10 Invites ➔ Slot 4):** ${roles.ROLE_10_INVITES ? `<@&${roles.ROLE_10_INVITES}>` : '`❌ Not Set`'}\n\n` +
                `### 🚀 Server Boost Tiers\n` +
                `• **Role 4 (1 Boost ➔ Slot 4 Boost):** ${roles.ROLE_1_BOOST ? `<@&${roles.ROLE_1_BOOST}>` : '`❌ Not Set`'}\n` +
                `• **Role 5 (2 Boosts ➔ Slot 5 Full):** ${roles.ROLE_2_BOOST ? `<@&${roles.ROLE_2_BOOST}>` : '`❌ Not Set`'}\n\n` +
                `-# Use \`/setuproles set\` to assign roles directly from your Discord App.`
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
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `# ✅ Progressive Role Configured\n` +
                `• **Tier Key:** \`${key}\`\n` +
                `• **Assigned Role:** ${role}\n` +
                `• **Target Server:** \`${interaction.guild.name}\`\n\n` +
                `Users who unlock this requirement will automatically gain slot permissions!`
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
                `# 🗑️ Role Tier Removed\n` +
                `• **Cleared Tier Key:** \`${key}\`\n\n` +
                `The role binding for this tier has been cleared successfully.`
            ));
            await interaction.editReply({ components: [c], flags: MessageFlags.IsComponentsV2 });
            return;
        }

        if (sub === 'sync') {
            await interaction.deferReply({ flags: MessageFlags.IsComponentsV2 });
            await syncRolesFromDB();
            const c = new ContainerBuilder().setAccentColor(0x5865F2);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `# 🔄 Database Synchronization\n` +
                `Successfully synced all progressive role settings from **MongoDB**!`
            ));
            await interaction.editReply({ components: [c], flags: MessageFlags.IsComponentsV2 });
            return;
        }

    } catch (err) {
        console.error("setupRolesCommand error:", err.message);
    }
}

export const setupRolesCmd = {
    data,
    execute,
    prefix: 'setuproles',
    async prefixExecute(message) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        const guildId = message.guild.id;
        const roles = await getRolesAsync(guildId);
        const c = new ContainerBuilder().setAccentColor(0x5865F2);
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `# ⚙️ Progressive Slot Roles Config\n` +
            `**Server:** \`${message.guild.name}\`\n\n` +
            `### 📩 Invite Tiers\n` +
            `• **Role 1 (2 Invites):** ${roles.ROLE_2_INVITES ? `<@&${roles.ROLE_2_INVITES}>` : '`❌ Not Set`'}\n` +
            `• **Role 2 (5 Invites):** ${roles.ROLE_5_INVITES ? `<@&${roles.ROLE_5_INVITES}>` : '`❌ Not Set`'}\n` +
            `• **Role 3 (10 Invites):** ${roles.ROLE_10_INVITES ? `<@&${roles.ROLE_10_INVITES}>` : '`❌ Not Set`'}\n\n` +
            `### 🚀 Server Boost Tiers\n` +
            `• **Role 4 (1 Boost):** ${roles.ROLE_1_BOOST ? `<@&${roles.ROLE_1_BOOST}>` : '`❌ Not Set`'}\n` +
            `• **Role 5 (2 Boosts):** ${roles.ROLE_2_BOOST ? `<@&${roles.ROLE_2_BOOST}>` : '`❌ Not Set`'}\n\n` +
            `-# Use \`/setuproles set\` to configure roles via Discord UI.`
        ));
        await message.reply({ components: [c], flags: MessageFlags.IsComponentsV2 });
    }
};
