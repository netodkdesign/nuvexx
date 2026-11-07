<?php
// Encontra a configuração da fila. Ela só tem o que a política de privacidade já mostra a todos,
// então pode ficar junto da página. O .htaccess impede que estes arquivos sejam abertos pelo site.
declare(strict_types=1);

function carregarConfigDaFila(): array
{
    $indicado = getenv('FILA_CONFIG');
    $caminhos = $indicado ? [$indicado] : [dirname(__DIR__) . '/fila-config.php', __DIR__ . '/fila-config.php'];

    $achada = [];
    foreach ($caminhos as $caminho) {
        if (!is_file($caminho)) {
            continue;
        }
        try {
            $config = include $caminho;
        } catch (Throwable $erro) {
            error_log('Fila de espera: fila-config.php com erro, linha ' . $erro->getLine());
            continue;
        }
        if (!is_array($config)) {
            continue;
        }
        // Uma cópia em branco não pode esconder a que foi preenchida.
        if (!empty($config['empresa_nome']) && !empty($config['empresa_cnpj'])) {
            $achada = $config;
            break;
        }
        $achada = $achada ?: $config;
    }

    // A lista fica sempre fora da área pública, a não ser que a configuração indique outro lugar fora dela.
    if ($achada && empty($achada['pasta_dados'])) {
        $achada['pasta_dados'] = dirname(__DIR__) . '/fila-dados';
    }
    return $achada;
}
