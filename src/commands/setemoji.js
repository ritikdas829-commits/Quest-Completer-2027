/**
 * setemoji.js — Command Handler
 * Location: src/commands/setemoji.js
 */

import { getEmojis, saveEmoji } from '../quest/emoji.js';

export const name = 'setemoji';
export const description = 'Update UI Emojis';

export async function execute(message, args) {
    const key = args[0]?.toLowerCase();
    const newEmoji = args[1];
    const emojis = getEmojis();

    if (!key) {
        let text = '### 🎨 Current Emojis:\n';
        for (const [k, v] of Object.entries(emojis)) {
            text += `- **${k}**:${v}\n`;
        }
        text += '\n*Usage: `?setemoji <key> <emoji>`*';
        return message.reply(text);
    }

    if (!emojis[key]) {
        return message.reply(`❌ Invalid emoji key! Available keys: \`${Object.keys(emojis).join(', ')}\``);
    }

    if (!newEmoji) {
        return message.reply(`❌ Provide emoji string!`);
    }

    const success = saveEmoji(key, newEmoji);
    if (success) {
        return message.reply(`✅ Updated **${key}** to ${newEmoji}`);
    } else {
        return message.reply(`❌ Failed to update.`);
    }
}
