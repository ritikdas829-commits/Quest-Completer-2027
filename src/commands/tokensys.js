import { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } from 'discord.js';
import fs from 'fs';
import path from 'path';

const filePath = path.resolve('tokens.json');

function getTokens() {
    try {
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
    } catch (e) {}
    return [];
}

function saveTokens(list) {
    fs.writeFileSync(filePath, JSON.stringify(list, null, 2));
}

// ─────────────────────────────────────────────
// 1. LINKID (Slash + Prefix: ;linkid)
// ─────────────────────────────────────────────
export const linkid = {
    name: 'linkid', // Prefix command name
    data: new SlashCommandBuilder()
        .setName('linkid')
        .setDescription('Link your Discord user token securely via modal popup'),
    
    async execute(interactionOrMessage, args) {
        // Agar yeh Prefix command hai (message object aaya hai)
        if (interactionOrMessage.channel) {
            return interactionOrMessage.reply('⚠️ Token linking security ke liye sirf **Slash Command** (`/linkid`) ka use karein taaki modal popup khul sake!');
        }

        // Agar yeh Slash Command hai
        const interaction = interactionOrMessage;
        const modal = new ModalBuilder()
            .setCustomId('linkid-modal')
            .setTitle('Link Your Discord Token');

        const tokenInput = new TextInputBuilder()
            .setCustomId('discord_token_input')
            .setLabel('Enter your Discord User Token')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Paste your account token here...')
            .setRequired(true);

        const row = new ActionRowBuilder().addComponents(tokenInput);
        modal.addComponents(row);

        await interaction.showModal(modal);
    }
};

// ─────────────────────────────────────────────
// 2. UNLINKID (Slash + Prefix: ;unlinkid)
// ─────────────────────────────────────────────
export const unlinkid = {
    name: 'unlinkid',
    data: new SlashCommandBuilder()
        .setName('unlinkid')
        .setDescription('Remove your linked Discord token'),
    
    async execute(interactionOrMessage) {
        const isSlash = !interactionOrMessage.channel;
        const userId = isSlash ? interactionOrMessage.user.id : interactionOrMessage.author.id;
        
        let tokensList = getTokens();
        const exists = tokensList.some(item => item.ownerId === userId);

        const embed = new EmbedBuilder();
        if (!exists) {
            embed.setColor(0xED4245).setTitle('❌ Not Linked').setDescription('You do not have any linked tokens. Use `/linkid` first.');
        } else {
            tokensList = tokensList.filter(item => item.ownerId !== userId);
            saveTokens(tokensList);
            embed.setColor(0x57F287).setTitle('✅ Successfully Unlinked').setDescription('Your token has been removed from the system.');
        }

        if (isSlash) {
            await interactionOrMessage.reply({ embeds: [embed], ephemeral: true });
        } else {
            await interactionOrMessage.reply({ embeds: [embed] });
        }
    }
};

// ─────────────────────────────────────────────
// 3. ONLINESTATUS (Slash + Prefix: ;onlinestatus)
// ─────────────────────────────────────────────
export const onlinestatus = {
    name: 'onlinestatus',
    data: new SlashCommandBuilder()
        .setName('onlinestatus')
        .setDescription('Check your linked token status and details'),
    
    async execute(interactionOrMessage) {
        const isSlash = !interactionOrMessage.channel;
        const userId = isSlash ? interactionOrMessage.user.id : interactionOrMessage.author.id;
        
        const tokensList = getTokens();
        const userTokenData = tokensList.find(item => item.ownerId === userId);

        const embed = new EmbedBuilder();
        if (!userTokenData) {
            embed.setColor(0xED4245).setTitle('❌ Not Linked').setDescription('No account linked. Use `/linkid` to link your token.');
        } else {
            const statusEmoji = userTokenData.status === 'online' ? '🟢 Online' : '🔴 Offline';
            const linkedDate = new Date(userTokenData.linkedAt).toLocaleString();

            embed.setColor(0x5865F2)
                .setTitle('📊 Token Status Dashboard')
                .addFields(
                    { name: 'Username', value: `\`${userTokenData.username}\``, inline: true },
                    { name: 'Status', value: statusEmoji, inline: true },
                    { name: 'Linked At', value: linkedDate, inline: false }
                );
        }

        if (isSlash) {
            await interactionOrMessage.reply({ embeds: [embed], ephemeral: true });
        } else {
            await interactionOrMessage.reply({ embeds: [embed] });
        }
    }
};

// ─────────────────────────────────────────────
// 4. ONLINEID (Slash + Prefix: ;onlineid)
// ─────────────────────────────────────────────
export const onlineid = {
    name: 'onlineid',
    data: new SlashCommandBuilder()
        .setName('onlineid')
        .setDescription('Set your linked account status to online'),
    
    async execute(interactionOrMessage) {
        const isSlash = !interactionOrMessage.channel;
        const userId = isSlash ? interactionOrMessage.user.id : interactionOrMessage.author.id;
        
        let tokensList = getTokens();
        const index = tokensList.findIndex(item => item.ownerId === userId);

        const embed = new EmbedBuilder();
        if (index === -1) {
            embed.setColor(0xED4245).setTitle('❌ Not Linked').setDescription('Use `/linkid` first.');
        } else if (tokensList[index].status === 'online') {
            embed.setColor(0xFEE75C).setTitle('⚠️ Already Online').setDescription('Your status is already set to online.');
        } else {
            tokensList[index].status = 'online';
            saveTokens(tokensList);
            embed.setColor(0x57F287).setTitle('🟢 Status Updated').setDescription('Your account status has been set to **Online**.');
        }

        if (isSlash) {
            await interactionOrMessage.reply({ embeds: [embed], ephemeral: true });
        } else {
            await interactionOrMessage.reply({ embeds: [embed] });
        }
    }
};

// ─────────────────────────────────────────────
// 5. OFFLINEID (Slash + Prefix: ;offlineid)
// ─────────────────────────────────────────────
export const offlineid = {
    name: 'offlineid',
    data: new SlashCommandBuilder()
        .setName('offlineid')
        .setDescription('Set your linked account status to offline'),
    
    async execute(interactionOrMessage) {
        const isSlash = !interactionOrMessage.channel;
        const userId = isSlash ? interactionOrMessage.user.id : interactionOrMessage.author.id;
        
        let tokensList = getTokens();
        const index = tokensList.findIndex(item => item.ownerId === userId);

        const embed = new EmbedBuilder();
        if (index === -1) {
            embed.setColor(0xED4245).setTitle('❌ Not Linked').setDescription('Use `/linkid` first.');
        } else if (tokensList[index].status === 'offline') {
            embed.setColor(0xFEE75C).setTitle('⚠️ Already Offline').setDescription('Your status is already set to offline.');
        } else {
            tokensList[index].status = 'offline';
            saveTokens(tokensList);
            embed.setColor(0xED4245).setTitle('🔴 Status Updated').setDescription('Your account status has been set to **Offline**.');
        }

        if (isSlash) {
            await interactionOrMessage.reply({ embeds: [embed], ephemeral: true });
        } else {
            await interactionOrMessage.reply({ embeds: [embed] });
        }
    }
};
