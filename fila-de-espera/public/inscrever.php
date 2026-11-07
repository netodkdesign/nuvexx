<?php
// Recebe nome e WhatsApp e guarda em um CSV fora da área pública do site.
// Roda na hospedagem compartilhada. O passo a passo está no README.md da pasta.
declare(strict_types=1);

ini_set('display_errors', '0');
date_default_timezone_set('America/Sao_Paulo');

require_once __DIR__ . '/fila-config-carregar.php';

const LIMITE_CORPO = 4096;
const NOME_MIN = 2;
const NOME_MAX = 80;
const JANELA_LIMITE = 3600;
// Folgado de propósito: operadoras de celular colocam muita gente atrás do mesmo endereço.
const LIMITE_PADRAO = 100;
// O BOM e o ponto e vírgula fazem o Excel em português abrir com os acentos e as colunas certos.
const CABECALHO_CSV = "\xEF\xBB\xBFdata_hora;nome;whatsapp\r\n";
// DDDs que existem no Brasil: evita guardar um número digitado errado, como (00) ou (20).
const DDDS_VALIDOS = '/^(1[1-9]|2[1247-8]|3[1-578]|4[1-9]|5[1345]|6[1-9]|7[134579]|8[1-9]|9[1-9])$/';
const FALHA = 'Não foi possível guardar sua inscrição agora. Tente de novo em instantes.';

function responder(int $status, array $dados): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($dados, JSON_UNESCAPED_UNICODE);
    exit;
}

function recusar(int $status, string $mensagem, ?string $campo = null): void
{
    responder($status, $campo === null ? ['erro' => $mensagem] : ['erro' => $mensagem, 'campo' => $campo]);
}

function carregarConfig(): array
{
    $config = carregarConfigDaFila();
    if (!$config) {
        throw new RuntimeException('fila-config.php não encontrado');
    }
    // Sem dizer quem trata os dados, a página não recebe inscrições.
    foreach (['empresa_nome', 'empresa_cnpj', 'empresa_email', 'pasta_dados'] as $chave) {
        if (empty($config[$chave])) {
            throw new RuntimeException("falta $chave em fila-config.php");
        }
    }
    return $config;
}

function prepararPasta(string $pasta): string
{
    if (!is_dir($pasta) && !mkdir($pasta, 0700, true) && !is_dir($pasta)) {
        throw new RuntimeException('não foi possível criar a pasta dos dados');
    }
    $real = realpath($pasta);
    $publica = realpath(__DIR__);
    // Dentro da área pública, a lista poderia ser baixada pelo site.
    if ($real === false || $publica === false || strpos($real . DIRECTORY_SEPARATOR, $publica . DIRECTORY_SEPARATOR) === 0) {
        throw new RuntimeException('a pasta dos dados precisa ficar fora da área pública');
    }
    return $real;
}

// Guarda só um código derivado do endereço, e por pouco tempo. Se o controle falhar, a inscrição
// segue: é melhor deixar passar uma tentativa a mais do que perder alguém que veio de um anúncio.
function dentroDoLimite(string $pasta, string $endereco, int $maximo): bool
{
    $f = @fopen($pasta . '/limites.json', 'c+');
    if ($f === false || !flock($f, LOCK_EX)) {
        error_log('Fila de espera: controle de tentativas indisponível');
        return true;
    }
    $dados = json_decode((string) stream_get_contents($f), true);
    $sal = is_array($dados) && isset($dados['sal']) ? (string) $dados['sal'] : bin2hex(random_bytes(16));
    $agora = time();

    $acessos = [];
    foreach (is_array($dados) && isset($dados['acessos']) && is_array($dados['acessos']) ? $dados['acessos'] : [] as $chave => $registro) {
        if (is_array($registro) && $agora - (int) $registro[0] < JANELA_LIMITE) {
            $acessos[$chave] = $registro;
        }
    }

    $chave = hash('sha256', $sal . $endereco);
    $registro = $acessos[$chave] ?? [$agora, 0];
    $permitido = $registro[1] < $maximo;
    if ($permitido) {
        $registro[1]++;
    }
    $acessos[$chave] = $registro;

    rewind($f);
    ftruncate($f, 0);
    fwrite($f, (string) json_encode(['sal' => $sal, 'acessos' => $acessos]));
    fflush($f);
    flock($f, LOCK_UN);
    fclose($f);
    return $permitido;
}

function lerJson(): object
{
    if (stripos((string) ($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json') === false) {
        recusar(415, 'Envie os dados em JSON.');
    }
    $corpo = (string) file_get_contents('php://input', false, null, 0, LIMITE_CORPO + 1);
    if (strlen($corpo) > LIMITE_CORPO) {
        recusar(413, 'Conteúdo grande demais.');
    }
    $dados = json_decode($corpo);
    if (!is_object($dados)) {
        recusar(400, 'Não foi possível ler os dados enviados.');
    }
    return $dados;
}

function limparNome($bruto): string
{
    if (!is_string($bruto)) {
        return '';
    }
    $semControle = preg_replace('/[\p{Cc}\p{Cf}]/u', ' ', $bruto);
    // preg_replace devolve null quando o texto não é UTF-8 válido.
    if ($semControle === null) {
        return '';
    }
    return trim((string) preg_replace('/[\s\p{Z}]+/u', ' ', $semControle));
}

// Aceita o número como a pessoa escrever e guarda sempre igual, como "(47) 99123-4567". Segue a regra
// do app: o celular fica com o 9 depois do DDD, para a mesma linha não entrar duas vezes. O formato
// com parênteses também impede o Excel de mostrar o número como 5,5E+12. Sem ";": nunca precisa de aspas.
function limparWhatsapp($bruto): ?string
{
    if (!is_string($bruto)) {
        return null;
    }
    $digitos = (string) preg_replace('/\D/', '', $bruto);
    $digitos = (string) preg_replace('/^0+/', '', $digitos);
    $digitos = (string) preg_replace('/^55(?=\d{10,11}$)/', '', $digitos);
    if (!preg_match('/^(\d{2})(\d{8,9})$/', $digitos, $partes) || !preg_match(DDDS_VALIDOS, $partes[1])) {
        return null;
    }
    [, $ddd, $numero] = $partes;
    if (strlen($numero) === 9 && $numero[0] !== '9') {
        return null;
    }
    $completo = preg_match('/^[6-9]\d{7}$/', $numero) ? '9' . $numero : $numero;
    // Número de mentira, como (11) 99999-9999.
    if (preg_match('/^9?(\d)\1{7}$/', $completo)) {
        return null;
    }
    return '(' . $ddd . ') ' . substr($completo, 0, -4) . '-' . substr($completo, -4);
}

function campoCsv(string $valor): string
{
    // Um nome como =SOMA(A1) não pode virar fórmula quando a planilha for aberta.
    $seguro = preg_match('/^[=+\-@]/', $valor) ? "'" . $valor : $valor;
    return preg_match('/[;"]/', $seguro) ? '"' . str_replace('"', '""', $seguro) . '"' : $seguro;
}

// Uma inscrição por vez: duas ao mesmo tempo não misturam linhas nem duplicam o número.
function guardar(string $pasta, string $nome, string $whatsapp): void
{
    $arquivo = $pasta . '/inscritos.csv';
    $novo = !file_exists($arquivo);
    $f = @fopen($arquivo, 'c+');
    if ($f === false) {
        throw new RuntimeException('não foi possível abrir a lista');
    }
    if (!flock($f, LOCK_EX)) {
        fclose($f);
        throw new RuntimeException('não foi possível reservar a lista');
    }

    $conteudo = (string) stream_get_contents($f);
    // O WhatsApp é sempre a última coluna, e o nome nunca tem quebra de linha.
    if (!preg_match('/;' . preg_quote($whatsapp, '/') . '\r?$/m', $conteudo)) {
        $linha = ($conteudo === '' ? CABECALHO_CSV : '')
            . date('Y-m-d H:i:s') . ';' . campoCsv($nome) . ';' . $whatsapp . "\r\n";
        fseek($f, 0, SEEK_END);
        $gravado = fwrite($f, $linha);
        fflush($f);
        if ($gravado !== strlen($linha)) {
            flock($f, LOCK_UN);
            fclose($f);
            throw new RuntimeException('não foi possível gravar na lista');
        }
    }

    flock($f, LOCK_UN);
    fclose($f);
    if ($novo) {
        @chmod($arquivo, 0600);
    }
}

try {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        http_response_code(404);
        header('Content-Type: text/plain; charset=utf-8');
        echo 'Página não encontrada.';
        exit;
    }

    $config = carregarConfig();
    $pasta = prepararPasta((string) $config['pasta_dados']);
    $maximo = (int) ($config['limite_por_hora'] ?? LIMITE_PADRAO);

    if (!dentroDoLimite($pasta, (string) ($_SERVER['REMOTE_ADDR'] ?? ''), $maximo)) {
        recusar(429, 'Muitas tentativas. Tente de novo mais tarde.');
    }

    $corpo = lerJson();

    // Campo invisível que só robô preenche. A resposta é a mesma, para ele não perceber.
    if (!empty($corpo->site)) {
        responder(200, ['ok' => true]);
    }

    $nome = limparNome($corpo->nome ?? null);
    $tamanho = (int) preg_match_all('/./su', $nome);
    if ($tamanho < NOME_MIN) {
        recusar(400, 'Informe seu nome.', 'nome');
    }
    if ($tamanho > NOME_MAX) {
        recusar(400, 'Use um nome mais curto.', 'nome');
    }

    $whatsapp = limparWhatsapp($corpo->whatsapp ?? null);
    if ($whatsapp === null) {
        recusar(400, 'Informe seu WhatsApp com DDD, como (47) 99123-4567.', 'whatsapp');
    }

    // Número repetido recebe a mesma resposta, para a página não revelar quem está na fila.
    guardar($pasta, $nome, $whatsapp);
    responder(200, ['ok' => true]);
} catch (Throwable $erro) {
    // Só o motivo: o registro do servidor não recebe nome nem número.
    error_log('Fila de espera: ' . $erro->getMessage());
    recusar(500, FALHA);
}
