# Fila de espera do Nuvexx

Página temporária para colher nome e WhatsApp de quem quer usar o Nuvexx antes do lançamento oficial.

Fica toda nesta pasta e não usa nada do app: tem servidor, arquivos, configuração e dados próprios, sem nenhuma dependência para instalar. O app também não sabe que ela existe. Quando o app for ao ar, ela é apagada seguindo os passos no fim deste arquivo.

## Rodar no computador

Precisa do Node.js 22.13 ou mais novo. Dentro desta pasta:

```bash
npm start
```

Abra http://localhost:3200. O app usa a porta 3100, então os dois podem ficar ligados juntos.

Para rodar os testes:

```bash
npm test
```

## Onde ficam os inscritos

Em `dados/inscritos.csv`, criado na primeira inscrição. O arquivo abre direto no Excel, com as colunas `data_hora`, `nome` e `whatsapp`.

- **Número:** só do Brasil, como no WhatsApp do app. É aceito como a pessoa escrever e guardado como `(47) 99123-4567`, com o 9 depois do DDD. Número com DDD que não existe é recusado.
- **Número repetido** não entra de novo, mesmo escrito de outro jeito. A resposta é a mesma de uma inscrição nova, para a página não revelar quem está na fila.
- **Sem confirmação:** a inscrição não envia e-mail nem mensagem: a pessoa só vê a página de obrigado, em `/obrigado`. Por isso, ninguém confere se o número é mesmo da pessoa, e um número digitado errado pode entrar na lista.
- **Excel aberto:** enquanto o arquivo estiver aberto no Excel, o Windows pode bloquear a gravação, e a pessoa vê um pedido para tentar de novo. Abra uma cópia.
- **Testes no computador:** o que você digitar na página entra nesse arquivo. Ele não vai para o servidor ao publicar, mas apague as linhas de teste se for usar essa lista.
- **Site:** o arquivo não pode ser baixado pelo endereço da página. Só os arquivos listados em `STATIC_FILES`, em `waitlist.js`, são entregues.

## Os textos da página

A página segue a ordem de seções de um site de referência, com texto, código e imagens próprios. Ela só fala do que o app faz hoje, e os testes recusam termos como Open Finance e nota fiscal.

As conversas em `public/index.html` e `public/pagina.js` copiam as respostas reais dos assessores, com dados de exemplo. Elas não são geradas pelo app: se uma resposta mudar lá, atualize aqui.

A fonte é a Poppins, guardada em `public/fontes/`, junto com a licença dela. Assim, a página não carrega nada de fora.

## Antes de publicar

O que está em **negrito** só você pode fazer.

1. **Revisar `public/privacidade.html` com um advogado.** É um rascunho. Ele promete apagar a lista depois do aviso de lançamento: se quiser guardá-la por mais tempo, mude o texto antes de publicar.
2. **Conferir o que a página promete para o lançamento.** Ela cita o WhatsApp, o áudio pelo WhatsApp, o Google Agenda e 7 dias de teste grátis. O áudio depende do WhatsApp conectado e de `TRANSCRICAO_CHAVE` no app. Se algum deles não estiver pronto, tire de `public/index.html` e `public/pagina.js`.
3. **Ter os dados da empresa em mãos:** razão social, CNPJ e o e-mail `contato@nuvexx.com.br`. Sem eles, a página não abre, porque a política de privacidade precisa dizer quem trata os dados.
4. **Criar a conta `contato@nuvexx.com.br` e ver se ela recebe mensagens.** A política manda as pessoas escreverem para esse endereço, inclusive para pedir que os dados sejam apagados.

## Publicar no Basic da Staycloud

> **Conferido no servidor em 4 de novembro de 2026, com PHP 7.4.33:** páginas, HTTPS, cabeçalhos de segurança, bloqueio de arquivos, recusa de dados inválidos, inscrições (inclusive simultâneas) e o caminho até `/obrigado` no navegador. **Ainda sem teste:** os casos de `test/php.test.js`, que precisam do PHP neste computador, e o limite de tentativas, porque testá-lo bloquearia o próprio endereço por uma hora.

O plano não roda o `server.js`, então a hospedagem usa `public/inscrever.php` e `public/privacidade.php`, com as mesmas regras. Os testes pulam a versão em PHP se `FILA_PHP` não apontar para o programa do PHP.

**O plano foi pago só por este mês.** Veja o que fazer antes de ele vencer no fim desta seção.

Já conferido em 4 de novembro de 2026: o cPanel mostra PHP 8.4.27, o certificado de `nuvexx.com.br` é válido e o servidor é LiteSpeed. O código precisa do PHP 7.4 ou mais novo. Se algo mudar, confira em Select PHP Version e em SSL/TLS Status: o `.htaccess` manda tudo para HTTPS e, sem certificado, a página fica fora do ar.

1. **Gere o pacote,** dentro desta pasta, com `npm run pacote`. Ele cria `para-enviar.zip` com todo o conteúdo de `public/`, inclusive o `.htaccess`. Gere de novo a cada mudança na página.
2. **No Gerenciador de Arquivos, ligue Show Hidden Files** e abra `public_html`. Apague o `index.html` ou `default.html` de exemplo, se houver.
3. **Envie `para-enviar.zip` para `public_html`, extraia e apague o `.zip`.** Confira se o `.htaccess` e as pastas `assessores` e `fontes` estão lá. **Não envie mais nada desta pasta para `public_html`:** a pasta `dados`, por exemplo, deixaria a lista de inscritos disponível para download.
4. **`fila-config.php` já vem preenchido no pacote,** com a razão social, o CNPJ e o e-mail de contato. Ele só guarda o que a política de privacidade já mostra a todos, e o `.htaccess` impede que seja aberto pelo site. Para mudar algum dado, edite `public/fila-config.php` e gere o pacote de novo: extrair o pacote substitui o arquivo do servidor.
5. **Não coloque nada mais em `public_html`.** A lista é criada sozinha em `fila-dados`, acima de `public_html`, fora da área pública.
6. **No MultiPHP Manager, escolha a versão 8.4 para `nuvexx.com.br`.** O cPanel guarda essa escolha no `.htaccess`, então repita este passo sempre que enviar um `.htaccess` novo. Sem isso, o site roda na versão padrão do servidor, que em 4 de novembro de 2026 era a 7.4.33.

Mudanças no `.htaccess` podem levar alguns minutos para valer: no primeiro envio, um teste logo depois ainda mostrava as regras antigas.
7. **Teste no celular:** abra `https://nuvexx.com.br` e faça uma inscrição. A página de obrigado precisa abrir em `/obrigado`, e a inscrição precisa aparecer em `fila-dados/inscritos.csv`, acima de `public_html`. Depois, apague esse arquivo.
8. **Confira a proteção:** `https://nuvexx.com.br/fila-dados/inscritos.csv`, `https://nuvexx.com.br/dados/inscritos.csv` e `https://nuvexx.com.br/privacidade.html` precisam dar erro 404, e `https://nuvexx.com.br/privacidade` precisa mostrar os dados da empresa.
9. **Só então ligue os anúncios.**

| O que acontece | O que fazer |
|---|---|
| A página toda dá erro 500 | O servidor recusou uma linha do `.htaccess`. A primeira suspeita é `Options -Indexes`: tire essa linha |
| "Não foi possível guardar sua inscrição" | Veja `error_log` no cPanel. Em geral é `public_html/fila-config.php` com a razão social ou o CNPJ em branco |
| Muita gente recebe "Muitas tentativas" | A hospedagem pode estar mostrando o mesmo endereço para todos. Aumente `limite_por_hora` em `fila-config.php` e fale com o suporte |

**Antes de o plano vencer:**

- **Baixe `fila-dados/inscritos.csv`** para um lugar fora deste projeto.
- **Decida o que acontece com o site:** renovar mais um mês, apontar o domínio para outra hospedagem ou deixá-lo sem site. Com o plano vencido, os links dos anúncios param de funcionar.
- **Decida o que acontece com `contato@nuvexx.com.br`:** ele para de funcionar junto com o plano, mas a política manda as pessoas escreverem para lá. Mantenha o endereço ativo enquanto guardar a lista.
- **Volte os servidores DNS para os do Registro.br antes de cancelar.** Hoje o domínio usa os da Staycloud (`ns1.naum.staydns.com`): com o plano cancelado, o domínio inteiro fica sem resposta.

**Ao encerrar:** apague o conteúdo de `public_html` e a pasta `fila-dados` no Gerenciador de Arquivos.

## Publicar na Fly.io (alternativa)

> Os arquivos ainda não foram usados, porque isso depende da sua conta na Fly.io. A imagem Docker também não foi gerada neste computador. Os testes conferem o resto: rodam a página só com os arquivos que o `Dockerfile` copia, em modo de produção, e gravam a lista na pasta de `PASTA_DADOS`.

Como a lista é um arquivo, a página precisa de um disco permanente. Em um disco comum, cada nova publicação apagaria a lista.

**Rode tudo dentro da pasta `fila-de-espera`.** O app tem o próprio `fly.toml`, na pasta de cima: um `fly deploy` no lugar errado publica o app, e não a fila.

1. **Crie uma conta em https://fly.io e cadastre um cartão.** Instale o `flyctl` conforme a documentação da Fly.io e entre com `fly auth login`.
2. Entre nesta pasta:

   ```bash
   cd fila-de-espera
   ```

3. Crie o app. Se o nome já existir, escolha outro e troque também a linha `app` do `fly.toml`:

   ```bash
   fly apps create nuvexx-fila
   ```

4. Crie o disco, com 1 GB, em São Paulo. A Fly.io avisa que um disco só não tem cópia em outra máquina; para uma fila de espera, isso é aceitável, desde que você baixe a lista de vez em quando:

   ```bash
   fly volumes create fila_dados --region gru --size 1
   ```

5. Grave os dados da empresa, trocando cada valor:

   ```bash
   fly secrets set EMPRESA_NOME="razao social" EMPRESA_CNPJ="00.000.000/0001-00" EMPRESA_EMAIL="contato@nuvexx.com.br"
   ```

6. Publique com uma cópia só. O disco só atende uma máquina:

   ```bash
   fly deploy --ha=false
   ```

7. Abra `https://nuvexx-fila.fly.dev`, faça uma inscrição de teste e baixe a lista, como no passo 1 da próxima seção, para ver se ela chegou. Depois, apague essa linha de teste:

   ```bash
   fly ssh console -C "sh -c 'rm /dados/inscritos.csv'"
   ```

   A página guarda na memória os números já inscritos, então reinicie para ela esquecer o de teste:

   ```bash
   fly apps restart nuvexx-fila
   ```

8. Para abrir a fila em `nuvexx.com.br`, peça o certificado e crie no Registro.br os registros de DNS que o comando mostrar:

   ```bash
   fly certs add nuvexx.com.br
   ```

Para publicar uma mudança de texto ou de visual, repita o `fly deploy --ha=false`. A lista fica no disco e não é afetada.

**Custo:** a máquina de 256 MB custa US$ 2,19 por mês ligada o tempo todo nas regiões mais baratas, e o disco de 1 GB, US$ 0,15 por mês. A Fly.io não tem plano gratuito, e a tabela de São Paulo não foi confirmada, então espere algo entre US$ 1 e US$ 4 por mês e confira na calculadora dela. Sem visitas, a máquina desliga sozinha, e a primeira visita depois disso pode demorar um pouco mais.

| O que acontece | O que fazer |
|---|---|
| "Faltam estas variáveis" no registro | Repita o `fly secrets set` com o que faltou |
| "Sem permissão para gravar em /dados" | A Fly.io não passou o disco para o usuário da imagem. Tire a linha `USER node` do `Dockerfile` e publique de novo |
| "needs an unattached volume" no `fly deploy` | Falta o disco do passo 4, ou ele foi criado em outra região |

## Quando o app for ao ar

Nesta ordem. Apagar esta pasta é o último passo.

1. **Baixe a lista do servidor**, para um lugar fora deste projeto. Abra a página antes, para a máquina ligar:

   ```bash
   fly ssh sftp get /dados/inscritos.csv "$HOME/Documents/inscritos-nuvexx.csv"
   ```

2. **Se a fila estiver em `nuvexx.com.br`, aponte o domínio para o app** no Registro.br, para o endereço não ficar fora do ar.
3. **Abra o cadastro no app e avise os inscritos pelo WhatsApp**, como na seção abaixo. A lista não tem e-mail, e o `EMAILS_LIBERADOS` do app só aceita e-mail: com `CADASTRO_ABERTO=false`, os inscritos não conseguem criar conta.
4. **Apague a página do servidor.** Segundo a documentação da Fly.io, isso apaga também o disco e as cópias dele, então confira antes se a lista baixada abre direito:

   ```bash
   fly apps destroy nuvexx-fila
   ```

5. **Apague a lista que você baixou**, como a política promete.
6. **Apague esta pasta.** Nada do app depende dela. Tire também a entrada `fila-de-espera` de `.claude/launch.json`, se ela ainda existir.

### Como avisar os inscritos

> Nada disso existe ainda: nem o app nem esta página enviam mensagem em massa. Planeje antes do lançamento.

- **Caminho oficial:** a API da Meta, com o número do app e um modelo de mensagem aprovado por ela, provavelmente da categoria Marketing, que é mais cara que a de Utilidade. Sites de terceiros indicam cerca de US$ 0,06 por mensagem no Brasil, ou seja, perto de US$ 62 para 1.000 inscritos. Confira na [página de preços da Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing), que publica os valores em reais.
- **Aceite:** a Meta exige que a pessoa tenha concordado em receber mensagens e que o aceite cite o nome da empresa. O formulário já diz isso. Se a marca mudar, mude também esse texto, em `public/index.html`.
- **Pedido para parar:** a Meta exige respeitar quem pedir para não receber mais. Tire esse número da lista antes do envio.
- **Evite disparar por um WhatsApp comum:** a Meta pode bloquear o número, e o número do app não pode estar em uso no aplicativo comum.
