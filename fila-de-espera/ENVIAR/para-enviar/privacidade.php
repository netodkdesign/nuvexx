<?php
// Entrega a política de privacidade com os dados da empresa, que ficam em fila-config.php.
declare(strict_types=1);

ini_set('display_errors', '0');

$caminho = getenv('FILA_CONFIG') ?: dirname(__DIR__) . '/fila-config.php';
$config = is_file($caminho) ? include $caminho : [];
$config = is_array($config) ? $config : [];

$valor = static function (string $chave) use ($config): string {
    $texto = trim((string) ($config[$chave] ?? ''));
    return htmlspecialchars($texto === '' ? '[a preencher]' : $texto, ENT_QUOTES, 'UTF-8');
};

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-cache');
echo strtr((string) file_get_contents(__DIR__ . '/privacidade.html'), [
    '{{EMPRESA_NOME}}' => $valor('empresa_nome'),
    '{{EMPRESA_CNPJ}}' => $valor('empresa_cnpj'),
    '{{EMPRESA_EMAIL}}' => $valor('empresa_email'),
]);
