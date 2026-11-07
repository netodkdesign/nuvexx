import nodemailer from 'nodemailer';

const OUTBOX_SIZE = 20;

export function createMailer({ config, log = console }) {
  const { smtpUrl, from } = config.email;
  const transport = smtpUrl ? nodemailer.createTransport(smtpUrl) : null;
  const outbox = [];

  async function send({ to, subject, text }) {
    if (transport) {
      await transport.sendMail({ from, to, subject, text });
      return;
    }
    if (config.isProduction) throw new Error('SMTP_URL não configurado.');
    // Em desenvolvimento, sem SMTP, o e-mail aparece na tela de entrada em vez de sair daqui.
    outbox.unshift({ to, subject, text });
    outbox.length = Math.min(outbox.length, OUTBOX_SIZE);
  }

  return {
    isConfigured: () => Boolean(transport && from),
    outbox,
    send,
    // Não espera o envio: o tempo de resposta não pode revelar quem tem conta.
    deliver(message) {
      send(message).catch((err) => log.error(`E-mail: ${err.message}`));
    },
  };
}

const body = (...lines) => [...lines, '', 'Equipe Nuvexx'].join('\n');

export const emails = {
  signup: ({ to, link }) => ({
    to,
    subject: 'Conclua seu cadastro no Nuvexx',
    text: body(
      'Olá!',
      '',
      'Abra o link abaixo para escolher sua senha e criar sua conta. Ele vale por 24 horas.',
      '',
      link,
      '',
      'Se você não pediu isto, pode ignorar este e-mail: nenhuma conta foi criada.',
    ),
  }),

  accountExists: ({ to, link }) => ({
    to,
    subject: 'Você já tem uma conta no Nuvexx',
    text: body(
      'Olá!',
      '',
      'Alguém tentou criar uma conta com este e-mail, mas ela já existe.',
      'Se foi você, é só entrar. Se esqueceu a senha, use "Esqueci minha senha" na tela de entrada:',
      '',
      link,
      '',
      'Se não foi você, pode ignorar este e-mail: nada mudou na sua conta.',
    ),
  }),

  passwordReset: ({ to, link }) => ({
    to,
    subject: 'Crie uma nova senha no Nuvexx',
    text: body(
      'Olá!',
      '',
      'Abra o link abaixo para criar uma nova senha. Ele vale por 1 hora e só funciona uma vez.',
      '',
      link,
      '',
      'Se você não pediu isto, pode ignorar este e-mail: sua senha continua a mesma.',
    ),
  }),

  passwordChanged: ({ to }) => ({
    to,
    subject: 'Sua senha do Nuvexx foi alterada',
    text: body(
      'Olá!',
      '',
      'A senha da sua conta acabou de ser alterada, e as sessões abertas em outros aparelhos foram encerradas.',
      '',
      'Se não foi você, use "Esqueci minha senha" na tela de entrada agora mesmo.',
    ),
  }),

  whatsappLinked: ({ to, phone }) => ({
    to,
    subject: 'Um WhatsApp foi conectado à sua conta do Nuvexx',
    text: body(
      'Olá!',
      '',
      `O número ${phone} agora está conectado à sua conta e pode ver e alterar seus dados por mensagem.`,
      '',
      'Se não foi você, entre no Nuvexx, desconecte o número na aba Conta e troque sua senha.',
    ),
  }),

  googleLinked: ({ to }) => ({
    to,
    subject: 'Sua conta do Nuvexx agora também entra com o Google',
    text: body(
      'Olá!',
      '',
      'Você entrou com a conta Google deste e-mail, e ela agora também abre a sua conta do Nuvexx. Sua senha continua valendo.',
      '',
      'Se não foi você, entre no Nuvexx, desligue a entrada com o Google na aba Conta e troque sua senha.',
    ),
  }),

  dailyBriefing: ({ to, name, message, appUrl }) => ({
    to,
    subject: 'Seu dia hoje',
    text: [
      `Bom dia, ${name}!`,
      '',
      message.replace(/\*/g, ''),
      '',
      `Veja a sua agenda em ${appUrl}/#/agenda`,
      'Para não receber mais este resumo, desligue na aba Conta.',
      '',
      'Cris, sua Assessora de Agenda no Nuvexx',
    ].join('\n'),
  }),

  reminder: ({ to, title, when, appUrl }) => ({
    to,
    subject: `Lembrete: ${title}`,
    text: body(
      `${title}, ${when}.`,
      '',
      `Para ver sua agenda ou desligar os lembretes por e-mail, acesse ${appUrl}`,
    ),
  }),
};
