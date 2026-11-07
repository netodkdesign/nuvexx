import { Working } from './parser.js';
import { capitalize, fold } from './text.js';

export const VEHICLE_WORDS = ['carro', 'moto', 'veiculo', 'caminhonete', 'caminhao', 'van', 'onibus'];
const NOT_A_PLACE = new RegExp(`^(?:(?:o|a|meu|minha)\\s+)?(?:${VEHICLE_WORDS.join('|')})\\b`);

export const significantWords = (name) => fold(name).split(/[^\p{L}\p{N}]+/u).filter((word) => word.length >= 3 && !/^\d+$/.test(word));

// O veículo que o texto cita, sem deixar dúvida: "honda" não basta se houver dois Honda.
export function citedVehicle(text, vehicles) {
  const words = new Set(fold(text).split(/[^\p{L}\p{N}]+/u));
  const cited = vehicles.filter((vehicle) => significantWords(vehicle.name).some((word) => words.has(word)));
  return cited.length === 1 ? cited[0] : null;
}

// Para o que não passa por perguntas, como várias linhas de uma vez: com um veículo só, é ele.
export function findVehicle(text, vehicles) {
  return vehicles.length === 1 ? vehicles[0] : citedVehicle(text, vehicles);
}

// Tira a menção ao veículo do texto: "2018" em "civic 2018" é o ano, não o valor.
export function withoutVehicleMention(text, vehicles) {
  const work = new Working(String(text ?? ''));
  for (const word of [...vehicles.flatMap((vehicle) => significantWords(vehicle.name)), ...VEHICLE_WORDS]) {
    const name = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    work.take(new RegExp(`(?<![\\p{L}\\p{N}])(?:(?:do|da|no|na|de|pro|pra|para o|para a)\\s+)?(?:(?:meu|minha|o|a)\\s+)?${name}(?:\\s+(?:19|20)\\d{2})?(?![\\p{L}\\p{N}])`, 'u'));
  }
  return work.orig.replace(/\s+/g, ' ').trim();
}

// "Troca de óleo na oficina do zé" vira o que foi feito e onde. "No carro" ou "no civic" não é lugar.
export function splitPlace(description, vehicles = []) {
  const names = vehicles.flatMap((vehicle) => significantWords(vehicle.name));
  for (const match of description.matchAll(/\s(?:na|no|em)\s+/gi)) {
    const place = description.slice(match.index + match[0].length).trim();
    const folded = fold(place);
    if (place.length < 2 || NOT_A_PLACE.test(folded) || names.includes(folded.split(/\s+/)[0])) continue;
    return { what: description.slice(0, match.index).trim(), place: capitalize(place) };
  }
  return { what: description, place: null };
}

// O que tem data depois de hoje ainda não foi feito: não entra no histórico nem no relatório.
export function splitHistory(rows, today) {
  return {
    done: rows.filter((row) => row.spent_on <= today),
    planned: rows.filter((row) => row.spent_on > today).reverse(),
  };
}

export function vehicleSummary(done) {
  const kilometers = done.map((row) => row.odometer_km).filter((km) => km !== null);
  return {
    service_count: done.length,
    total_cents: done.reduce((sum, row) => sum + row.total_cents, 0),
    first_on: done.at(-1)?.spent_on ?? null,
    last_on: done[0]?.spent_on ?? null,
    last_km: kilometers.length ? Math.max(...kilometers) : null,
  };
}
