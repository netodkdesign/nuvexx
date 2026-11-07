// No Brasil, a mesma linha de celular pode chegar com ou sem o 9 depois do DDD. O formato
// canônico é sempre com o 9, para que a pessoa tenha uma só conta.
export function canonicalPhone(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  const match = digits.match(/^55(\d{2})([6-9]\d{7})$/);
  return match ? `55${match[1]}9${match[2]}` : digits;
}

// O que a pessoa digita na tela de login costuma vir sem o 55.
export function parseTypedPhone(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  return canonicalPhone(/^\d{10,11}$/.test(digits) ? `55${digits}` : digits);
}

export const isBrazilian = (phone) => /^55\d{10,11}$/.test(phone);

// Registros não guardam o número inteiro.
export function maskPhone(phone) {
  const digits = String(phone ?? '');
  return digits.length > 8 ? `${digits.slice(0, 4)}*****${digits.slice(-4)}` : '****';
}

export function formatPhone(phone) {
  const match = String(phone ?? '').match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  return match ? `(${match[1]}) ${match[2]}-${match[3]}` : String(phone ?? '');
}
