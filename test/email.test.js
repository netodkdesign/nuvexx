import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { test } from 'node:test';
import { createMailer, emails } from '../src/email.js';
import { quiet, testConfig } from './helpers.js';

// Um servidor SMTP mínimo: o e-mail passa pela biblioteca de envio de verdade.
function fakeSmtp() {
  const received = [];
  const server = createServer((socket) => {
    let inData = false;
    let data = '';
    socket.write('220 teste ESMTP\r\n');
    socket.on('data', (chunk) => {
      for (const line of chunk.toString().split('\r\n').filter((item, index, all) => item || index < all.length - 1)) {
        if (inData) {
          if (line === '.') {
            inData = false;
            received.push(data);
            socket.write('250 ok\r\n');
          } else {
            data += `${line}\n`;
          }
        } else if (/^(EHLO|HELO|MAIL FROM|RCPT TO)/i.test(line)) {
          socket.write('250 ok\r\n');
        } else if (/^DATA/i.test(line)) {
          inData = true;
          socket.write('354 pode enviar\r\n');
        } else if (/^QUIT/i.test(line)) {
          socket.end('221 tchau\r\n');
        }
      }
    });
    socket.on('error', () => {});
  });
  return new Promise((done) => {
    server.listen(0, '127.0.0.1', () => done({ server, received, port: server.address().port }));
  });
}

test('com SMTP configurado, o e-mail sai pelo servidor informado', async () => {
  const { server, received, port } = await fakeSmtp();
  try {
    const config = testConfig({ SMTP_URL: `smtp://127.0.0.1:${port}`, EMAIL_REMETENTE: 'Nuvexx <nao-responda@teste.com>' });
    const mailer = createMailer({ config, log: quiet });
    assert.equal(mailer.isConfigured(), true);
    await mailer.send(emails.passwordReset({ to: 'ana@teste.com', link: 'https://app.test/#/nova-senha/abc' }));
    assert.equal(received.length, 1);
    assert.match(received[0], /To: ana@teste\.com/);
    assert.match(received[0], /nao-responda@teste\.com/);
    assert.match(received[0], /https:\/\/app\.test\/#\/nova-senha\/abc/);
    assert.deepEqual(mailer.outbox, []);
  } finally {
    server.close();
  }
});

test('em desenvolvimento, sem SMTP, o e-mail fica na caixa de saída local', async () => {
  const mailer = createMailer({ config: testConfig(), log: quiet });
  assert.equal(mailer.isConfigured(), false);
  await mailer.send({ to: 'ana@teste.com', subject: 'Oi', text: 'Olá' });
  assert.deepEqual(mailer.outbox, [{ to: 'ana@teste.com', subject: 'Oi', text: 'Olá' }]);
});

test('em produção, sem SMTP, o envio falha em vez de sumir em silêncio', async () => {
  const errors = [];
  const config = { ...testConfig(), isProduction: true };
  const mailer = createMailer({ config, log: { error: (text) => errors.push(text) } });
  await assert.rejects(mailer.send({ to: 'ana@teste.com', subject: 'Oi', text: 'Olá' }), /SMTP_URL/);
  mailer.deliver({ to: 'ana@teste.com', subject: 'Oi', text: 'Olá' });
  await new Promise((done) => setTimeout(done, 10));
  assert.match(errors[0], /SMTP_URL/);
});
