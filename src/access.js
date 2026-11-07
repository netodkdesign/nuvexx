// Situação da conta: em teste grátis, com assinatura em dia ou com o acesso vencido.
export function accessOf(user, now = new Date()) {
  if (user.paid_until && new Date(user.paid_until) > now) return 'paid';
  if (user.trial_ends_at && new Date(user.trial_ends_at) > now) return 'trial';
  return 'expired';
}

export const canWrite = (user, now = new Date()) => accessOf(user, now) !== 'expired';
