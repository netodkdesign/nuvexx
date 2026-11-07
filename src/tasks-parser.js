import { cleanTitle, takeDate, takeTime } from './agenda-parser.js';
import { addDays, weekday } from './dates.js';
import { Working } from './parser.js';
import { capitalize, fold } from './text.js';

const MAX_TITLE = 120;
// Sem horário, "quinta" dita numa quinta é hoje mesmo.
const ANY_TIME = '23:59';
const DAY_START = '00:00';

const EXPLICIT = /^(?:(?:nova|criar|cria|crie|adicionar|adiciona|adicione|anotar|anota|anote)\s+)?tarefa(?:\s*:\s*|\s+|$)/;
// "Me lembra" e "preciso" com horário são compromisso, e ficam com a agenda.
const REMIND = /^(?:me\s+)?(?:lembra|lembrar|lembre|lembrete)(?:-me)?(?:\s+(?:de|que|para|pra))?(?:\s+|$)/;
const NEED = /^(?:preciso|tenho\s+que|tenho\s+de)(?:\s+de)?\s+/;
// "Estudar 3 horas" é quanto tempo leva, não a que horas. "Às 3 horas" é horário.
const HOURS_AS_LENGTH = /(?<!\bas\s)(?<![\d:])\b\d{1,2}\s+horas?\b/;

const LIST = /^(?:(?:quais|minhas|as|ver)\s+)*(?:tarefas|pendencias|afazeres)(?:\s+pendentes)?(?:\s+(?:de|para|pra|da|desta|dessa|esta|essa))?(?:\s+(hoje|amanha|semana))?$/;
const WHAT_TO_DO = /^(?:o\s*que|oq|que)\s+(?:eu\s+)?(?:tenho|preciso)\s+(?:que\s+|de\s+)?fazer(?:\s+(?:esta\s+|essa\s+|na\s+)?(hoje|amanha|semana))?$/;
const DONE = /^(?:concluir|conclui|concluida|concluido|finalizar|finalizei|terminar|terminei|feito|feita|ja fiz|marcar como feit[oa]|marca como feit[oa])(?:\s+(?:a\s+|o\s+)?(?:tarefa\s+)?(?:de\s+)?(.+))?$/;
const REMOVE = /^(?:apagar|apaga|apague|excluir|exclui|remover|remove|cancelar|cancela)\s+(?:a\s+)?tarefa\s+(.+)$/;
const MOVE = /^(?:adiar|adia|adie|remarcar|remarca|mudar|muda)\s+(?:a\s+)?tarefa\s+(.+?)\s+(?:para|pra)\s+(.+)$/;

function listRange(word, today) {
  if (word === 'hoje') return { to: today, label: 'Hoje', includeOverdue: true };
  if (word === 'amanha') return { from: addDays(today, 1), to: addDays(today, 1), label: 'Amanhã' };
  if (word === 'semana') {
    const sinceMonday = (weekday(today) + 6) % 7;
    return { to: addDays(today, 6 - sinceMonday), label: 'Esta semana', includeOverdue: true };
  }
  return null;
}

function takeWhen(work, today, nowTime) {
  const time = HOURS_AS_LENGTH.test(work.norm) ? null : takeTime(work)?.time ?? null;
  const date = time ? takeDate(work, today, time, nowTime) : takeDate(work, today, ANY_TIME, DAY_START);
  return { time, date };
}

function parseCreate(clean, simple, today, nowTime) {
  const pattern = [EXPLICIT, REMIND, NEED].find((re) => re.test(simple));
  if (!pattern) return null;

  const work = new Working(clean);
  work.take(pattern);
  if (pattern !== EXPLICIT && takeTime(new Working(work.orig))) return null;

  const { time, date } = takeWhen(work, today, nowTime);
  const title = capitalize(cleanTitle(work)).slice(0, MAX_TITLE);
  if (!title) return { type: 'task_need_title' };
  // Só o horário: hoje, se ainda não passou; senão, amanhã.
  const day = date ?? (time ? (time > nowTime ? today : addDays(today, 1)) : null);
  return { type: 'task_create', title, date: day, time };
}

export function parseTasks(text, today, nowTime = DAY_START) {
  const clean = String(text ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
  const simple = fold(clean).replace(/[?!.,;]+$/g, '').trim();
  if (!simple) return null;

  const list = LIST.exec(simple) ?? WHAT_TO_DO.exec(simple);
  if (list) return { type: 'task_list', range: listRange(list[1], today) };

  const move = MOVE.exec(simple);
  if (move) {
    const { time, date } = takeWhen(new Working(move[2]), today, nowTime);
    if (date || time) return { type: 'task_move', query: move[1].trim(), date, time };
  }

  const remove = REMOVE.exec(simple);
  if (remove) return { type: 'task_delete', query: remove[1].trim() };

  const done = DONE.exec(simple);
  if (done) return { type: 'task_done', query: done[1]?.trim() ?? '' };

  return parseCreate(clean, simple, today, nowTime);
}
