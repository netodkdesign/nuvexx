import { downloadMedia } from './whatsapp.js';

// Uma mensagem de voz do WhatsApp tem cerca de 2 a 4 KB por segundo: 1 MB são alguns minutos.
export const MAX_AUDIO_BYTES = 1024 * 1024;
const TIMEOUT_MS = 30_000;

// Situa o serviço no assunto. Sem valores nem pedidos: quando o áudio é silêncio, esses modelos às vezes
// repetem a dica como se fosse a fala, e um "gastei 50" aqui viraria um gasto que ninguém fez.
const SPEECH_HINT = 'Recado curto sobre gastos em reais, compromissos e tarefas, com valores e horários escritos em números.';

const FILE_EXTENSIONS = {
  'audio/ogg': 'ogg',
  'audio/opus': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/mp4': 'm4a',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/webm': 'webm',
  'audio/flac': 'flac',
};

export class UnsupportedAudioError extends Error {}

export const canTranscribe = (config) => Boolean(config.transcription.apiKey && config.whatsapp.accessToken);

export async function transcribe(transcription, { data, mimeType }, fetchImpl = fetch) {
  const type = String(mimeType ?? '').split(';')[0].trim().toLowerCase();
  const extension = FILE_EXTENSIONS[type];
  if (!extension) throw new UnsupportedAudioError(`Formato de áudio não aceito: ${type || 'desconhecido'}.`);

  const form = new FormData();
  form.append('file', new Blob([data], { type }), `audio.${extension}`);
  form.append('model', transcription.model);
  form.append('language', 'pt');
  form.append('prompt', SPEECH_HINT);
  form.append('response_format', 'json');

  const response = await fetchImpl(`${transcription.baseUrl}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${transcription.apiKey}` },
    body: form,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`O serviço de transcrição recusou o áudio (${response.status}): ${detail.slice(0, 300)}`);
  }
  const { text } = await response.json();
  const heard = String(text ?? '').trim();
  // O silêncio pode voltar como a própria dica.
  return heard === SPEECH_HINT ? '' : heard;
}

// O áudio fica só na memória, durante esta chamada: nada é gravado.
export async function hearAudio(config, audio, fetchImpl = fetch) {
  const media = await downloadMedia(config.whatsapp, audio.id, MAX_AUDIO_BYTES, fetchImpl);
  return transcribe(config.transcription, media, fetchImpl);
}
