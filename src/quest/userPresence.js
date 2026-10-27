/**
 * userPresence.js - Keeps linked user account tokens online via Discord Gateway
 * Location: src/quest/userPresence.js
 */

import WebSocket from 'ws';

const activeSockets = new Map();

export function startUserOnlinePresence(userId, token, status = 'online') {
    stopUserOnlinePresence(userId);

    const cleanToken = typeof token === 'string' ? token.trim().replace(/['"]+/g, '') : token;
    if (!cleanToken) return;

    const ws = new WebSocket('wss://gateway.discord.gg/?v=10&encoding=json');

    ws.on('open', () => {
        console.log(`[Presence] Connecting online status for User ID: ${userId}...`);
    });

    ws.on('message', (data) => {
        const payload = JSON.parse(data.toString());
        const { op, d } = payload;

        if (op === 10) {
            const heartbeatInterval = d.heartbeat_interval;
            
            const identifyPayload = {
                op: 2,
                d: {
                    token: cleanToken,
                    capabilities: 16381,
                    properties: {
                        os: 'Windows',
                        browser: 'Discord Client',
                        device: ''
                    },
                    presence: {
                        status: status,
                        since: 0,
                        activities: [],
                        afk: false
                    }
                }
            };
            ws.send(JSON.stringify(identifyPayload));

            const intervalId = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ op: 1, d: null }));
                }
            }, heartbeatInterval);

            activeSockets.set(userId, { ws, intervalId });
        }
    });

    ws.on('close', () => {
        stopUserOnlinePresence(userId);
    });

    ws.on('error', (err) => {
        console.error(`[Presence Error] User ID ${userId}:`, err.message);
    });
}

export function stopUserOnlinePresence(userId) {
    if (activeSockets.has(userId)) {
        const { ws, intervalId } = activeSockets.get(userId);
        clearInterval(intervalId);
        try { ws.close(); } catch {}
        activeSockets.delete(userId);
    }
}
