import { createHmac, timingSafeEqual } from 'node:crypto';
import { safeEqual } from './auth.js';

const NON_TEXT_TYPES = new Set(['audio', 'image', 'video', 'document', 'sticker', 'location', 'contacts']);
const MEDIA_TIMEOUT_MS = 20_000;

export function verifyWebhook(params, verifyToken) {
  if (!verifyToken || params.get('hub.mode') !== 'subscribe') return null;
  if (!safeEqual(params.get('hub.verify_token') ?? '', verifyToken)) return null;
  return params.get('hub.challenge');
}

export function validSignature(rawBody, header, appSecret) {
  if (!appSecret || !header) return false;
  const expected = Buffer.from(`sha256=${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`);
  const received = Buffer.from(String(header));
  return expected.length === received.length && timingSafeEqual(expected, received);
}

// Avisos de entrega e leitura vêm no mesmo webhook e não têm "messages": ficam de fora.
function* receivedMessages(payload, phoneNumberId) {
  for (const entry of payload?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      if (change?.field !== 'messages') continue;
      const value = change.value ?? {};
      if (phoneNumberId && value.metadata?.phone_number_id && value.metadata.phone_number_id !== phoneNumberId) continue;
      yield* value.messages ?? [];
    }
  }
}

export function extractMessages(payload, phoneNumberId) {
  const messages = [];
  for (const message of receivedMessages(payload, phoneNumberId)) {
    if (!message?.id || !message?.from) continue;
    messages.push({
      id: message.id,
      from: message.from,
      type: message.type,
      text: message.text?.body ?? '',
      audio: message.audio?.id ? { id: message.audio.id } : null,
      // O horário é o do envio: uma mensagem reentregue no dia seguinte continua no dia certo.
      sentAt: message.timestamp ? new Date(Number(message.timestamp) * 1000) : new Date(),
    });
  }
  return messages;
}

// Quem usa nome de usuário no WhatsApp pode chegar sem o número. A conta é ligada pelo número, então o app não consegue responder.
export const countWithoutPhone = (payload, phoneNumberId) =>
  [...receivedMessages(payload, phoneNumberId)].filter((message) => message?.id && !message.from).length;

export const isNonText = (message) => NON_TEXT_TYPES.has(message.type);

async function post(whatsapp, body, fetchImpl) {
  if (!whatsapp.accessToken || !whatsapp.phoneNumberId) {
    throw new Error('Faltam WHATSAPP_ACCESS_TOKEN ou WHATSAPP_PHONE_NUMBER_ID no .env.');
  }
  const url = `${whatsapp.graphBase}/${whatsapp.graphVersion}/${whatsapp.phoneNumberId}/messages`;
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${whatsapp.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...body }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`A Meta recusou o envio (${response.status}): ${detail.slice(0, 300)}`);
  }
}

export class MediaTooLargeError extends Error {}

// Duas etapas, as duas com o token: a Meta devolve um endereço que vale 5 minutos, e o arquivo sai dele.
export async function downloadMedia(whatsapp, mediaId, maxBytes, fetchImpl = fetch) {
  if (!whatsapp.accessToken) throw new Error('Falta WHATSAPP_ACCESS_TOKEN no .env.');
  const headers = { Authorization: `Bearer ${whatsapp.accessToken}` };
  const signal = AbortSignal.timeout(MEDIA_TIMEOUT_MS);
  const lookup = await fetchImpl(`${whatsapp.graphBase}/${whatsapp.graphVersion}/${encodeURIComponent(mediaId)}`, { headers, signal });
  if (!lookup.ok) throw new Error(`A Meta não informou o arquivo (${lookup.status}).`);
  const info = await lookup.json();
  if (Number(info.file_size) > maxBytes) throw new MediaTooLargeError(`Arquivo de ${info.file_size} bytes.`);

  const file = await fetchImpl(info.url, { headers, signal });
  if (!file.ok) throw new Error(`A Meta não entregou o arquivo (${file.status}).`);
  const data = Buffer.from(await file.arrayBuffer());
  if (data.length > maxBytes) throw new MediaTooLargeError(`Arquivo de ${data.length} bytes.`);
  return { data, mimeType: info.mime_type ?? file.headers.get('content-type') };
}

export const sendText = (whatsapp, to, body, fetchImpl = fetch) =>
  post(whatsapp, { recipient_type: 'individual', to, type: 'text', text: { body, preview_url: false } }, fetchImpl);

// Fora da janela de 24 horas, a Meta só entrega modelos aprovados.
export const sendTemplate = (whatsapp, to, name, parameters, fetchImpl = fetch) =>
  post(whatsapp, {
    to,
    type: 'template',
    template: {
      name,
      language: { code: 'pt_BR' },
      components: [{ type: 'body', parameters: parameters.map((text) => ({ type: 'text', text })) }],
    },
  }, fetchImpl);
