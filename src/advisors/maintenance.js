import { parseAgenda } from '../agenda-parser.js';
import { classify, MAINTENANCE_SLUG } from '../categories.js';
import { cleanAnswer, extractAccount, NO_DESCRIPTION, parseApproxMonth, parseMessage, parseServiceText, takeDate, Working } from '../parser.js';
import { parsePlanned } from '../planned-parser.js';
import { parseTasks } from '../tasks-parser.js';
import { fold, formatBRL, normalizeKeyword } from '../text.js';
import { citedVehicle, significantWords, splitPlace, VEHICLE_WORDS, withoutVehicleMention } from '../vehicles.js';

const PENDING_TTL_MS = 2 * 60 * 60 * 1000;
const MAX_VEHICLE_NAME = 60;
const CANCEL_HINT = 'Para desistir, mande *cancelar*.';

const SERVICE_WORD = /(?:^|\s)(?:manutencao|conserto|consertei|revisao|reparo|troquei|trocamos|arrumei)(?:\s|$)/;
const LONE_SERVICE = /^(?:fiz\s+)?(?:uma\s+)?manutencao(?:\s+[\d.,]+)?$/;
const QUESTION = /\?\s*$|^(?:como|qual|quais|onde|quando|quanto|por que|porque|o que)(?:\s|$)/;

const CANCEL = /^(?:cancelar|cancela|desistir|desisto|deixa|deixa pra la|esquece|parar|sair|nao quero)$/;
const YES = /^(?:sim|s|isso|isso mesmo|esse|esse mesmo|foi|e|eh|e esse|correto|certo|exato|confirmo|ok|aham|uhum)$/;
const NO = /^(?:nao|n)$/;
const SKIP = /^(?:pular|pula|nenhum|nenhuma|sem veiculo|nao sei|nao lembro|nao me lembro|sei la|deixa em branco)$/;
const NO_COST = /^(?:0|zero|nada|gratis|de graca|garantia|na garantia|foi na garantia|foi de graca)$/;
const PLAIN_AMOUNT = /^(?:(?:foi|foram|deu|paguei|custou|ficou|saiu)\s+)?(?:r\$\s*)?\d[\d.,]*(?:\s*(?:reais|real|mil|k))?$/;
const ANSWER_LEAD = /^(?:nao[,\s]+)?(?:(?:foi|e|eh)\s+)?(?:(?:no|na|em|o|a|do|da)\s+)?(?:(?:meu|minha)\s+)?/;
const BANK_MENTION = /(?<![\p{L}\p{N}])(?:no|na|pelo|pela|via|com)\s+(?:nubank|itau|bradesco|santander|inter|c6|picpay|mercado pago|banco do brasil|caixa)(?![\p{L}\p{N}])/u;

// Sem nenhuma outra palavra, a frase não conta qual foi a manutenção: "levei o carro na oficina".
const GENERIC_WHAT = new Set([
  ...VEHICLE_WORDS, 'fiz', 'fizemos', 'fazer', 'mandei', 'levei', 'deixei', 'uma', 'um', 'o', 'a', 'os', 'as', 'no', 'na', 'do', 'da', 'de', 'em',
  'pro', 'pra', 'para', 'meu', 'minha', 'foi', 'manutencao', 'servico', 'conserto', 'reparo', 'mecanico', 'mecanica', 'oficina',
]);

const simplify = (text) => fold(String(text ?? '')).replace(/[?!.,;:]+/g, ' ').replace(/\s+/g, ' ').trim();

const fullDate = (date) => `${date.slice(8)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;

// "Carro" sozinho não decide nada: em "levei o carro na oficina", quem manda é a oficina.
const serviceKeywords = async (store) => (await store.keywords()).filter(({ keyword }) => !VEHICLE_WORDS.includes(keyword));

function isGenericWhat(what, vehicles) {
  if (!what || what === NO_DESCRIPTION) return true;
  const vehicleWords = new Set(vehicles.flatMap((vehicle) => significantWords(vehicle.name)));
  return normalizeKeyword(what).split(' ').every((word) => !word || GENERIC_WHAT.has(word) || vehicleWords.has(word));
}

// O que ainda falta, nesta ordem: veículo, o que foi feito, onde, quando e quanto custou.
function nextQuestion(draft) {
  if (!draft.vehicleDone) return 'vehicle';
  if (!draft.what) return 'what';
  if (!draft.placeDone) return 'place';
  if (!draft.date) return 'date';
  if (!draft.amountCents && !draft.amountSkipped) return 'amount';
  return null;
}

function questionFor(slot, vehicles) {
  if (slot === 'what') return 'Qual foi a manutenção? Por exemplo, *troca de óleo* ou *pastilha de freio*.';
  if (slot === 'place') return 'Onde foi feita? Mande o nome da oficina ou *pular*, se não lembrar.';
  if (slot === 'date') return 'Quando foi feita? Mande *hoje*, *ontem* ou a data, como *15/10*. Se não lembrar o dia, o mês já ajuda, como *03/2024*.';
  if (slot === 'amount') return 'Qual foi o valor? Mande o número, como *250*, ou *pular*, se não lembrar.';
  if (!vehicles.length) return 'Qual é o veículo? Mande o nome, como *Honda Civic 2018*, que eu já cadastro.';
  if (vehicles.length === 1) return `Foi no *${vehicles[0].name}*? Responda *sim* ou o nome de outro veículo.`;
  const list = vehicles.map((vehicle, index) => `${index + 1}. ${vehicle.name}`).join('\n');
  return `Em qual veículo foi?\n${list}\n\nResponda com o número, o nome ou o nome de um veículo novo.`;
}

function summaryOf(draft, row) {
  const value = draft.amountCents
    ? `💵 ${formatBRL(draft.amountCents)}${draft.installments > 1 ? ` em ${draft.installments}x` : ''}`
    : null;
  const lines = [
    `✅ *Manutenção anotada*${row.vehicle_name ? ` no histórico de *${row.vehicle_name}*` : ', sem veículo definido'}`,
    `🔧 ${draft.what}`,
    draft.place && `📍 ${draft.place}`,
    `📅 ${fullDate(draft.date)}`,
    draft.odometerKm !== null && `🛣️ ${draft.odometerKm.toLocaleString('pt-BR')} km`,
    value,
  ].filter(Boolean);
  if (draft.newVehicle) lines.unshift(`🚗 Cadastrei o veículo *${draft.newVehicle}*.`);
  if (!draft.amountCents) lines.push('', 'Sem valor, ela não muda suas finanças. Se lembrar depois, edite na aba *Veículos*.');
  lines.push('', 'Se algo estiver errado, mande *desfazer* ou edite na aba *Veículos*.');
  return lines.join('\n');
}

export function createMaintenanceAdvisor() {
  async function finish(draft, store, context) {
    await store.clearPendingService();
    const rows = await store.addExpense({
      description: draft.what,
      amountCents: draft.amountCents,
      categoryId: draft.categoryId,
      date: draft.date,
      installments: draft.installments,
      source: context.source,
      accountId: draft.accountId,
    });
    await store.saveVehicleService(rows[0], { vehicleId: draft.vehicleId, place: draft.place, odometerKm: draft.odometerKm });
    return summaryOf(draft, await store.expense(rows[0].id));
  }

  // Guarda e pergunta o que falta. Com tudo em mãos, anota na hora.
  async function advance(draft, store, context) {
    const slot = nextQuestion(draft);
    if (!slot) return finish(draft, store, context);
    await store.savePendingService({ ...draft, asking: slot }, new Date(context.now.getTime() + PENDING_TTL_MS));
    return questionFor(slot, await store.vehicles());
  }

  // Assunto novo no meio das perguntas: o pedido é atendido, e as perguntas continuam depois.
  async function isAnotherSubject(text, store, context) {
    const { today, nowTime } = context;
    const parsed = parseMessage(text, today);
    if (['help', 'thanks', 'login', 'whatsapp_link', 'whatsapp_unlink', 'subscribe', 'delete_account', 'confirm_delete',
      'summary', 'income', 'income_summary', 'categories', 'recent', 'recategorize'].includes(parsed.type)) return true;
    if (parseTasks(text, today, nowTime) || parseAgenda(text, today, nowTime)) return true;
    if (parsePlanned(text, today)?.type === 'planned') return true;
    if (parsed.type !== 'expense') return false;
    // "Mercado 50" é outro gasto. "Auto Center 2000" pode ser o nome da oficina.
    const category = classify(text, await store.keywords());
    const maintenance = (await store.categories()).find((row) => row.slug === MAINTENANCE_SLUG);
    return Boolean(category && category !== maintenance?.id);
  }

  async function answerVehicle(draft, text, store) {
    const simple = simplify(text);
    const vehicles = await store.vehicles();
    if (SKIP.test(simple)) return { ...draft, vehicleDone: true };
    if (vehicles.length === 1 && YES.test(simple)) return { ...draft, vehicleId: vehicles[0].id, vehicleDone: true };
    if (/^\d+$/.test(simple)) {
      const vehicle = vehicles[Number(simple) - 1];
      return vehicle ? { ...draft, vehicleId: vehicle.id, vehicleDone: true } : null;
    }
    if (YES.test(simple) || NO.test(simple)) return null;
    const cited = citedVehicle(text, vehicles) ?? vehicles.find((vehicle) => fold(vehicle.name) === simple);
    if (cited) return { ...draft, vehicleId: cited.id, vehicleDone: true };
    if (vehicles.some((vehicle) => significantWords(vehicle.name).some((word) => simple.split(' ').includes(word)))) return null;

    // "Oficina do zé" é a resposta de outra pergunta, não o nome de um veículo.
    if (classify(text, await serviceKeywords(store))) return null;
    const work = new Working(String(text).trim());
    work.take(ANSWER_LEAD);
    const name = cleanAnswer(work.orig.replace(/^novo\s+/i, ''));
    if (name.length < 2 || name.length > MAX_VEHICLE_NAME) return null;
    const vehicle = await store.createVehicle({ name, plate: null });
    return { ...draft, vehicleId: vehicle.id, vehicleDone: true, newVehicle: vehicle.name };
  }

  async function answerWhat(draft, text, store, today) {
    const vehicles = await store.vehicles();
    if (SKIP.test(simplify(text))) return { ...draft, what: 'Manutenção' };
    const piece = parseServiceText(withoutVehicleMention(text, vehicles), today);
    const { what, place } = splitPlace(piece.description, vehicles);
    if (isGenericWhat(what, vehicles)) return null;
    return {
      ...draft,
      what,
      place: draft.place ?? place,
      placeDone: draft.placeDone || Boolean(place),
      date: draft.date ?? piece.date,
      amountCents: draft.amountCents || piece.amountCents,
      installments: draft.amountCents ? draft.installments : piece.installments,
      odometerKm: draft.odometerKm ?? piece.odometerKm,
    };
  }

  function answerPlace(draft, text, today) {
    const simple = simplify(text);
    if (SKIP.test(simple)) return { ...draft, placeDone: true };
    if (YES.test(simple) || NO.test(simple)) return null;
    const work = new Working(String(text).normalize('NFC').trim());
    const date = takeDate(work, today);
    const place = cleanAnswer(work.orig);
    return place.length < 2 ? null : { ...draft, place, placeDone: true, date: draft.date ?? date };
  }

  function answerDate(draft, text, today) {
    const date = takeDate(new Working(String(text).normalize('NFC').trim()), today) ?? parseApproxMonth(text, today);
    return date ? { ...draft, date } : null;
  }

  function answerAmount(draft, text, today) {
    const simple = simplify(text);
    if (SKIP.test(simple) || NO_COST.test(simple)) return { ...draft, amountSkipped: true };
    const { amountCents, installments } = parseServiceText(text, today);
    return amountCents ? { ...draft, amountCents, installments } : null;
  }

  const ANSWERS = {
    vehicle: (draft, text, store) => answerVehicle(draft, text, store),
    what: (draft, text, store, today) => answerWhat(draft, text, store, today),
    place: (draft, text, _store, today) => answerPlace(draft, text, today),
    date: (draft, text, _store, today) => answerDate(draft, text, today),
    amount: (draft, text, _store, today) => answerAmount(draft, text, today),
  };

  const askAgain = async (draft, store, simple = '') => {
    const vehicles = await store.vehicles();
    const question = draft.asking === 'vehicle' && vehicles.length === 1 && NO.test(simple)
      ? 'Qual é o veículo, então? Mande o nome, que eu já cadastro.'
      : questionFor(draft.asking, vehicles);
    return `Não entendi.\n\n${question}\n\n${CANCEL_HINT}`;
  };

  return {
    async isService(text, store) {
      if (String(text ?? '').split(/\r?\n/).filter((line) => line.trim()).length !== 1) return false;
      const simple = simplify(text);
      if (QUESTION.test(String(text).trim()) || QUESTION.test(simple)) return false;
      const categories = await store.categories();
      const maintenance = categories.find((row) => row.slug === MAINTENANCE_SLUG);
      if (!maintenance) return false;
      if (classify(text, await serviceKeywords(store)) === maintenance.id) return true;
      if (LONE_SERVICE.test(simple)) return true;
      if (!SERVICE_WORD.test(simple)) return false;
      const words = simple.split(' ');
      const vehicleWords = (await store.vehicles()).flatMap((vehicle) => significantWords(vehicle.name));
      return [...VEHICLE_WORDS, ...vehicleWords].some((word) => words.includes(word));
    },

    async start(text, store, context) {
      const { today } = context;
      const [vehicles, accounts, categories] = await Promise.all([store.vehicles(), store.accounts(), store.categories()]);
      const mention = extractAccount(text, accounts);
      // Um banco sem conta cadastrada também é como pagou, não onde foi feito.
      const paid = new Working(String(mention?.text ?? text));
      paid.take(BANK_MENTION);
      const clean = paid.orig.replace(/\s+/g, ' ').trim();
      const cited = citedVehicle(clean, vehicles);
      const piece = parseServiceText(withoutVehicleMention(clean, vehicles), today);
      const { what, place } = splitPlace(piece.description, vehicles);
      const draft = {
        categoryId: categories.find((row) => row.slug === MAINTENANCE_SLUG).id,
        vehicleId: cited?.id ?? null,
        vehicleDone: Boolean(cited),
        what: isGenericWhat(what, vehicles) ? null : what,
        place,
        placeDone: Boolean(place),
        date: piece.date,
        amountCents: piece.amountCents,
        installments: piece.installments,
        odometerKm: piece.odometerKm,
        accountId: mention?.account.id ?? null,
        newVehicle: null,
      };
      if (!nextQuestion(draft)) return finish(draft, store, context);
      return `🔧 Vou anotar essa manutenção.\n\n${await advance(draft, store, context)}\n\n${CANCEL_HINT}`;
    },

    // Retorna null quando a mensagem é outro assunto, e as perguntas ficam para depois.
    async answer(draft, text, store, context) {
      const { today } = context;
      const simple = simplify(text);
      const parsed = parseMessage(text, today);
      if (CANCEL.test(simple) || parsed.type === 'undo') {
        await store.clearPendingService();
        return 'Tudo bem, não anotei essa manutenção.';
      }
      // Datas e números curtos vêm antes de tudo: "1" não é um gasto de um real, e "ontem" não é assunto novo.
      if (draft.asking === 'date') {
        const dated = answerDate(draft, text, today);
        if (dated) return advance(dated, store, context);
      }
      if (draft.asking === 'amount' && (PLAIN_AMOUNT.test(fold(String(text)).trim()) || NO_COST.test(simple))) {
        const valued = answerAmount(draft, text, today);
        return valued ? advance(valued, store, context) : askAgain(draft, store);
      }
      if (draft.asking === 'vehicle' && (/^\d+$/.test(simple) || YES.test(simple) || SKIP.test(simple))) {
        const decided = await answerVehicle(draft, text, store);
        return decided ? advance(decided, store, context) : askAgain(draft, store);
      }
      if (await isAnotherSubject(text, store, context)) return null;
      if (draft.asking === 'vehicle') {
        // Veio a data antes da hora: fica guardada, e a pergunta do veículo continua.
        const dated = answerDate(draft, text, today);
        if (dated) {
          await store.savePendingService(dated, new Date(context.now.getTime() + PENDING_TTL_MS));
          return askAgain(dated, store);
        }
      }
      const updated = await ANSWERS[draft.asking](draft, text, store, today);
      return updated ? advance(updated, store, context) : askAgain(draft, store, simple);
    },

    async reminder(draft, store) {
      return `🔧 Ainda falta um detalhe da manutenção. ${questionFor(draft.asking, await store.vehicles())}`;
    },
  };
}
