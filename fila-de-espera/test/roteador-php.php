<?php
// Só para os testes: faz no servidor embutido do PHP o que o .htaccess faz na hospedagem.
$caminho = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$publica = dirname(__DIR__) . '/public';

if ($caminho === '/inscrever') {
    require $publica . '/inscrever.php';
    return true;
}
if ($caminho === '/privacidade') {
    require $publica . '/privacidade.php';
    return true;
}
if ($caminho === '/obrigado') {
    header('Content-Type: text/html; charset=utf-8');
    readfile($publica . '/obrigado.html');
    return true;
}
if ($caminho === '/privacidade.html') {
    http_response_code(404);
    return true;
}
return false;
