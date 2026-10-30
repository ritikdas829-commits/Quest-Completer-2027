/**
 * ping.js — Next-Gen Sleek & Cool Latency Check Dashboard
 * Location: src/commands/ping.js
 * Synora 乂 Development
 */

import {
  SlashCommandBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  SectionBuilder,
  ThumbnailBuilder,
  MessageFlags,
} from 'discord.js';
import { getEmojis } from '../quest/emoji.js';

function statusLabel(ws) {
  if (ws < 80)  return { text: 'Blazing fast — hyperspace connection!', color: 0x57F287 };
  if (ws < 150) return { text: 'Solid connection, operating smoothly.', color: 0x57F287 };
  if (ws < 250) return { text: 'A bit sluggish, but holding steady.', color: 0xFEE75C };
  return { text: 'Running hot — high latency detected!', color: 0xED4245 };
}

async function buildPingCard(ws, rest, avatar, guildId) {
  const EMOJI = await getEmojis(guildId || 'global');
  const { text, color } = statusLabel(ws);
  const c = new ContainerBuilder().setAccentColor(color);

  c.addSectionComponents(
    new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `# ${EMOJI.ping_icon || '🏓'} System Latency Matrix\n` +
          `> *Real-time performance diagnostics core.*\n` +
          `-# ${text}`,
        ),
      )
      .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatar)),
  );

  c.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
  );

  c.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `### ${EMOJI.ping_info || '⚡'} Core Diagnostics\n` +
      `• **WebSocket Heartbeat:** \`${ws}ms\`\n` +
      `• **REST Round-Trip:** \`${rest}ms\``,
    ),
  );

  c.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
  );

  const statusIndicator = ws < 150 
    ? `${EMOJI.ping_success || '🟢'} All systems nominal and secure` 
    : ws < 250 
    ? `${EMOJI.ping_warning || '🟡'} Minor network jitter detected` 
    : `${EMOJI.ping_error || '🔴'} Elevated latency threshold reached`;

  c.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`-# ${EMOJI.ping_arrow || '🚀'} ${statusIndicator}`),
  );

  return { components: [c], flags: MessageFlags.IsComponentsV2 };
}

export default {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check bot latency with a futuristic dashboard view'),
  prefix: 'ping',

  async execute(interaction) {
    const guildId = interaction.guild?.id || 'global';
    const ws = interaction.client.ws.ping;
    const t = Date.now();
    await interaction.deferReply({ flags: MessageFlags.IsComponentsV2 });
    const rest = Date.now() - t;
    const avatar = interaction.client.user.displayAvatarURL({ size: 128, extension: 'png' });
    const card = await buildPingCard(ws, rest, avatar, guildId);
    await interaction.editReply(card);
  },

  async prefixExecute(message, _a, client) {
    const guildId = message.guild?.id || 'global';
    const ws = client.ws.ping;
    const t = Date.now();
    const sent = await message.reply('⚡ Analyzing system latency...');
    const rest = Date.now() - t;
    const avatar = client.user.displayAvatarURL({ size: 128, extension: 'png' });
    const card = await buildPingCard(ws, rest, avatar, guildId);
    await sent.edit({ content: '', ...card });
  },
};
