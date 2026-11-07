# Nuvexx

Três assessores virtuais que você usa pelo navegador, com a sua própria conta:

- **💰 Caio, Assessor Financeiro:** anota entradas e gastos, calcula o saldo de cada conta e mostra tudo em um painel que você organiza.
- **📅 Cris, Assessora de Agenda:** marca compromissos, avisa antes e pode enviar tudo ao Google Agenda.
- **📝 Nina, Assessora de Tarefas:** anota pendências, com dia e horário, e avisa 2 horas antes.

Cada pessoa entra com e-mail e senha e só enxerga os próprios dados. Três coisas são opcionais:

- **Continuar com o Google**, no lugar da senha.
- **Google Agenda**, para receber os compromissos.
- **WhatsApp**, para usar os assessores também por mensagem.

## Rodar no computador

Precisa do Node.js 22.13 ou mais novo.

```bash
npm install
```

```bash
npm start
```

Abra http://localhost:3100. Na primeira execução, o app cria o arquivo `.env` e um banco embutido em `data/pg`, sem instalar mais nada.

Para testar sem contratar nada, use os dois simuladores. Eles só existem com `AMBIENTE=desenvolvimento`:

- **E-mail:** toque em **Criar conta** e informe um endereço qualquer. A mensagem aparece na própria tela de entrada, com o link para concluir o cadastro. Ao concluir, a pessoa cai na tela de boas-vindas, que apresenta os três assessores e leva à primeira anotação de cada um.
- **WhatsApp:** toque em **WhatsApp**, no menu superior, e use o simulador que aparece na página de conexão. Depois de conectado, o simulador fica na aba **Conta**.

Outros comandos:

| Comando | O que faz |
|---|---|
| `npm run ligar` | Liga em segundo plano e religa se cair |
| `npm run desligar` | Desliga o que foi ligado com `npm run ligar` |
| `npm test` | Roda os testes no banco embutido |
| `node scripts/gerar-icones.js` | Gera de novo os ícones do app |

Para rodar os testes em um PostgreSQL de verdade, defina `TEST_DATABASE_URL` com um banco descartável, porque os dados dele são apagados, e rode `node --test --test-concurrency=1 test/`.

## Como funciona a conta

**Criar conta:** a pessoa informa o e-mail e recebe um link, que vale por 24 horas. Ao abrir, escolhe o nome e a senha e aceita os termos. O teste grátis começa aí, e nada fica gravado antes disso.

**Continuar com o Google:** o Google confirma o e-mail, e a pessoa só aceita os termos. Se já existir uma conta com o mesmo e-mail, ela passa a entrar também pelo Google e recebe um aviso por e-mail.

**Esqueci minha senha:** a pessoa recebe um link, que vale por 1 hora e funciona uma vez. Trocar a senha encerra as sessões abertas em outros aparelhos.

## O painel

A tela principal do Financeiro é feita de blocos: entradas, saídas, saldo do mês, saldo por conta, o que ainda vai entrar e sair, fluxo mensal, gastos por categoria, maiores gastos, últimos lançamentos, próximos compromissos e tarefas pendentes.

- **Mês:** o painel abre no mês atual, e as setas mudam de mês. O gráfico de fluxo sempre traz os 6 meses até o mês escolhido.
- **O que ainda vai acontecer:** no mês atual, entradas e saídas mostram quanto já entrou ou saiu e quanto ainda vai entrar ou sair, e o saldo é o previsto para o fim do mês. No gráfico, a parte prevista fica mais clara.
- **Painéis:** cada conta começa com Visão geral, Fluxo e Gastos. Os botões de organizar ficam no menu **…**, ao lado dos painéis, para não poluir a tela.
- **Organizar:** em **… > Organizar blocos**, arraste um bloco pela alça ou use o menu dele, que também funciona no celular e pelo teclado. A ordem fica salva na conta.
- **Compartilhar:** gera um link de leitura, válido por 30 dias, que mostra só os blocos daquele painel. Criar outro link ou tocar em **Parar de compartilhar** cancela o anterior.
- **Lançamentos futuros e repetidos:** qualquer lançamento pode ter data futura e se repetir toda semana, todo mês ou todo ano, com data final opcional. Cada repetição vira um lançamento comum, criado com um ano de antecedência. Ao editar ou apagar, a pessoa escolhe se vale só para aquele ou também para os próximos.
- **Contas e cartões:** a pessoa cadastra cada uma. O saldo é o inicial mais as entradas menos os gastos até hoje; no cartão, o valor é o que foi gasto no mês. Os dados vêm só do que é anotado no app: não há ligação com bancos.

O tema escuro é o padrão, e o botão no topo troca para o claro neste navegador.

## Identidade visual

| Cor | Código | Onde entra |
|---|---|---|
| Midnight Navy | `#101828` | Superfícies do tema escuro e texto do tema claro |
| Electric Blue | `#2563EB` | Ações principais e a área do Caio |
| Nuvexx Violet | `#7657FF` | Degradê da marca, ícone e a área da Cris |
| Soft Indigo | `#A5B4FC` | Elementos secundários, links no tema escuro, ilustrações e a área da Nina |
| Pure White | `#FFFFFF` | Cartões do tema claro e texto sobre as cores da marca |
| Cloud Gray | `#F1F5F9` | Fundo do tema claro e texto do tema escuro |
| Slate | `#64748B` | Eixos dos gráficos e textos de apoio do tema claro |
| Deep Charcoal | `#0B1220` | Fundo do tema escuro |

Fora dessa paleta ficam só as cores que têm significado: verde para entrada, vermelho para saída, laranja para gasto previsto e as cores de alerta. Elas moram no começo de `public/styles.css`.

A logo fica em `public/marca/`, com fundo transparente: `logo-fundo-escuro.png` (índigo e azul) e `logo-fundo-claro.png` (navy e azul). O símbolo `simbolo.png` ("nxx") vira o favicon e os ícones do app instalável, sempre sobre fundo branco, porque o "n" navy sumiria numa aba escura. Se o símbolo mudar, rode `node scripts/gerar-icones.js`.

## O histórico do veículo

A categoria **🔧 Manutenção de Veículo** guarda o raio-x de cada veículo, na aba **Veículos** das finanças:

- **Cada manutenção** tem a data, a peça trocada ou o serviço feito, onde foi feito, a quilometragem e o valor. O valor é opcional, para quem quiser anotar serviços antigos sem lembrar o preço; sem valor, nada muda nas finanças.
- **É um gasto como os outros:** a data e o valor ficam só no lançamento. Uma manutenção anotada em **Lançamentos**, na **Conversa** ou no **WhatsApp** entra sozinha no histórico.
- **Por mensagem, o Caio pergunta o que faltar:** nesta ordem, o veículo, a manutenção, o lugar, a data e o valor. Tudo que vier na frase é aproveitado: "troca de óleo do civic 250 na oficina do zé ontem" é anotada sem nenhuma pergunta. A quilometragem é opcional e não gera pergunta.
  - **Veículo:** com um cadastrado, ele confirma ("Foi no Honda Civic?"). Com vários, mostra a lista. O nome de um veículo novo já o cadastra.
  - **No meio da conversa:** *cancelar* desiste, *pular* deixa o veículo, o lugar ou o valor em branco, e o mês basta quando a pessoa não lembra o dia. Sem valor, a manutenção entra no histórico, mas não muda as finanças. Um assunto novo, como "mercado 50", é atendido, e a pergunta volta no fim. As respostas ficam guardadas por até 2 horas.
  - **Sem perguntas:** várias linhas de uma vez e o que é futuro ou se repete, como "revisão do carro 800 todo ano". Essas ficam em "Sem veículo" quando não dá para saber o veículo.
- **Relatório:** o botão **Ver relatório** monta uma folha com tudo que já foi feito, para salvar em PDF e mostrar a quem for comprar. Os valores só aparecem se a pessoa marcar **Mostrar os valores**. O que tem data futura não entra. O rodapé avisa que as informações foram anotadas pelo dono e que o relatório não é vistoria nem laudo.

O link de um painel compartilhado não mostra veículo, lugar nem quilometragem. Apagar um veículo não apaga os gastos: as manutenções ficam sem veículo definido.

## A agenda do dia

A Agenda é a tela inicial: é ela que abre ao entrar na conta, pelo e-mail ou pelo Google, e ao abrir o app instalado. Recarregar a página mantém a tela atual, e o cadastro novo passa antes pelas boas-vindas.

A primeira tela da Agenda é só o dia de hoje: quantos compromissos há, a que horas o dia começa e termina, o tempo ocupado, a mensagem da Cris em um balão de notificação e a linha do dia em arco, com um ponto marcando a hora atual e o maior intervalo livre no centro. No celular, o arco sobe para ocupar a altura da tela e mostra os horários, e os nomes ficam na lista; no computador, um nome sem espaço no arco também fica só na lista. Ao abrir a aba, a linha se desenha de uma ponta à outra, com o relógio correndo na frente, e cada horário aparece quando ela chega nele, enquanto o balão da Cris cai no lugar perto do fim; quem pede menos animação ao sistema vê tudo pronto. O X dispensa o balão até a próxima abertura da aba. Rolando a página, ficam o formulário de adicionar evento, a conexão com o Google Agenda e a lista dos próximos compromissos.

**Resumo do dia:** às 5h30, a Cris envia como será o dia, com compromissos, intervalo livre e tarefas de hoje. O cálculo usa o fuso de `APP_TIMEZONE`.

- Com WhatsApp conectado e conversa nas últimas 24 horas, vai como mensagem comum.
- Fora dessa janela, vai pelo modelo aprovado em `WHATSAPP_MODELO_RESUMO`. Sem ele, ou sem WhatsApp, vai por e-mail.
- Dia sem nada marcado não gera envio. Quem está com o teste vencido também não recebe.
- A pessoa pode desligar na aba Conta. Se o app estava fora do ar às 5h30, o resumo sai quando ele voltar, até as 10h.

## Os assessores

Os nomes ficam em `src/assistant.js` e `public/app.js`. Os retratos são ilustrações em `public/assessores/`, não fotos de pessoas. Para trocar por uma foto, coloque o arquivo nessa pasta, inclua-o na lista `STATIC_FILES` de `src/server.js` e aponte para ele em `public/app.js` e `public/index.html`. Use só fotos com direito de uso para este fim.

## O que dá para escrever

Na aba **Conversa** ou no WhatsApp conectado, cada mensagem vai para o assessor certo sem a pessoa precisar escolher. Tudo também pode ser feito pelos botões e formulários do site.

**💰 Caio, Assessor Financeiro**

| Mensagem | O que acontece |
|---|---|
| `gastei 50 no mercado`, `uber 23,50`, `dentista 200` | Anota o gasto na categoria certa |
| `mercado 50 no nubank` | Anota e liga à conta cadastrada com esse nome |
| `troca de óleo 250 na oficina do zé` | Pergunta o que faltar (veículo, manutenção, lugar, data e valor) e guarda no histórico do veículo |
| `recebi 3000 de salário`, `entrou 500 do freela ontem` | Anota a entrada de dinheiro |
| `entradas`, `quanto recebi em outubro` | Mostra as entradas do mês |
| `vou receber 2000 dia 20`, `vou pagar 300 de luz dia 15` | Anota um valor futuro, que entra na previsão do mês |
| `aluguel 1800 todo dia 10`, `salário 5000 todo dia 5`, `academia 120 toda semana` | Anota o que se repete, nos próximos 12 meses |
| `quanto ainda vai sair`, `a receber`, `o que falta pagar` | Mostra o que ainda vai entrar e sair no mês |
| `cancelar repetição aluguel` | Para de repetir e tira o que estava previsto |
| `almoço 35 ontem`, `dia 15 gasolina 200` | Anota na data informada |
| `tv 1200 em 10x`, `12x de 100 sofá` | Divide em parcelas, uma em cada mês |
| `resumo`, `resumo outubro` | Total do mês por categoria, com entradas e saldo |
| `quanto gastei de mercado`, `quanto gastei hoje` | Total de uma categoria, item ou período |
| `últimos` | Os lançamentos mais recentes |
| `categoria lazer` | Corrige o último gasto e aprende para a próxima vez |

**📅 Cris, Assessora de Agenda**

| Mensagem | O que acontece |
|---|---|
| `dentista quinta às 15h`, `marca reunião com Ana amanhã às 10`, `quero agendar minha reunião com José amanhã às 10` | Marca o compromisso: o pedido em volta fica fora do nome, que é só "Reunião com José" |
| `agendar reunião com José`, e depois `amanhã às 10` | Sem o dia, pergunta para quando e guarda o evento por 2 horas. Outro assunto no meio é atendido, e a pergunta volta no fim. Para desistir, `cancelar` |
| `reunião das 14h às 16h na sexta`, `call amanhã 10h por meia hora` | Marca com o horário de término |
| `viagem dia 20` | Marca para o dia todo |
| `agenda`, `o que tenho hoje`, `compromissos da semana` | Mostra os compromissos |
| `como é meu dia`, `meu dia` | Conta como será o dia de hoje |
| `remarcar dentista para sexta às 9` | Muda o dia, o horário ou os dois |
| `cancelar dentista` | Cancela, também no Google Agenda |
| `conectar google` | Envia o link para conectar o Google Agenda |

**📝 Nina, Assessora de Tarefas**

| Mensagem | O que acontece |
|---|---|
| `tarefa pagar luz sexta às 15h` | Anota a tarefa com dia e horário |
| `preciso comprar leite`, `me lembra de renovar o seguro dia 20` | Anota a tarefa, com ou sem dia |
| `tarefas`, `tarefas de hoje`, `o que tenho que fazer` | Mostra as pendências |
| `concluí pagar luz` | Marca como concluída |
| `adiar tarefa luz para segunda às 10h` | Muda o dia, o horário ou os dois |
| `apagar tarefa luz` | Apaga a tarefa |

O horário só vira tarefa quando a mensagem começa com "tarefa". "Me lembra de" e "preciso" com horário viram compromisso, com a Cris.

**Conta**

| Mensagem | O que acontece |
|---|---|
| `desfazer` | Apaga o registro mais recente, seja entrada, gasto, compromisso ou tarefa |
| `entrar` | No WhatsApp, envia o endereço do site |
| `assinar` | Mostra a situação da assinatura |
| `desconectar whatsapp` | Desliga o número da conta, sem apagar nada |
| `apagar minha conta`, depois `confirmar exclusão` | Apaga a conta e todos os dados |

Os assessores leem o texto com regras e palavras-chave, sem inteligência artificial, então não há custo de IA por mensagem. Uma frase muito fora do padrão pode não ser entendida; nesse caso, o assessor pede para reformular.

## Antes de abrir ao público

Nesta ordem. O que está em **negrito** só você pode fazer, porque depende das suas contas e documentos.

1. **Revisar os documentos legais com um advogado.** Os termos em `public/termos.html` e a política em `public/privacidade.html` são um rascunho e não substituem essa revisão.
2. **Conferir a marca no INPI.** O nome Nuvexx ainda precisa dessa verificação; o app não usa nada da marca Meu Assessor.
3. **Criar as contas de servidor e banco de dados** (próxima seção). O domínio `nuvexx.com.br` está registrado no Registro.br, com validade até 04/11/2027.
4. **Contratar um serviço de e-mail, autenticar o domínio e criar uma caixa de entrada.** O endereço de `EMPRESA_EMAIL` aparece nos termos: `contato@nuvexx.com.br` precisa funcionar antes de abrir ao público.
5. **Escolher o meio de pagamento.** A integração ainda não foi feita.
6. Testar com poucas pessoas, usando `CADASTRO_ABERTO=false` e `EMAILS_LIBERADOS`.
7. Abrir o cadastro com `CADASTRO_ABERTO=true`.

Opcionais, em qualquer momento depois do passo 3:

- **Criar o projeto no Google**, para o "Continuar com o Google" e o Google Agenda.
- **Verificar a empresa na Meta e criar o app do WhatsApp.**

## Publicar em um servidor

O app precisa de um lugar que rode Node.js atrás de HTTPS e de um PostgreSQL gerenciado, com cópias de segurança automáticas. O caminho escolhido é **Vercel + Supabase** (seção 2). A Fly.io continua como alternativa (seção 3), com o `Dockerfile` e o `fly.toml`.

> O app já foi testado em modo de produção com um PostgreSQL de verdade neste computador. A imagem do `Dockerfile` foi montada na Fly.io sem erros. A publicação na Vercel ainda não foi feita.

Na Fly.io, rode **uma cópia só** do app: com duas, os lembretes podem sair repetidos. Na Vercel, quem dispara os lembretes é o agendador dela, uma vez por minuto.

> **Onde está o DNS:** desde 04/11/2026, os servidores DNS do domínio são os da Staycloud, então os registros são criados no cPanel dela, e não no Registro.br. A raiz `nuvexx.com.br` e o `www` são da fila de espera, e o app fica em `app.nuvexx.com.br`. O plano da Staycloud foi pago por um mês: antes de ele acabar, volte os servidores DNS para os do Registro.br e recrie lá todos os registros. Sem isso, param o app, a autenticação do e-mail e a caixa `contato@`.

### 1. Banco de dados no Supabase

O app usa só o PostgreSQL do Supabase. Login, armazenamento e a API automática do Supabase ficam de fora.

1. **Crie uma conta em https://supabase.com e um projeto na região de São Paulo.** Gere a senha do banco pelo botão do próprio Supabase e guarde num lugar seguro. Se aparecer a opção de **Data API**, desligue.
2. **Plano:**
   - O gratuito serve para o teste, mas **não tem cópias de segurança**. Ele também pausa o projeto depois de 7 dias com pouca atividade e avisa por e-mail uma semana antes. O app consulta o banco a cada minuto, o que deve contar como atividade, mas o Supabase não confirma isso.
   - Antes de abrir ao público, mude para o Pro, de US$ 25 por mês, com cópias diárias guardadas por 7 dias.
3. Clique em **Connect** e copie a conexão do **Session pooler**, na porta 5432. A conexão direta só funciona por IPv6, e o Transaction pooler, na porta 6543, não guarda o estado de que o app precisa.

O `npm run fly:segredos` coloca a senha no lugar de `[YOUR-PASSWORD]` e confere o banco antes de gravar. O Supabase assina os certificados com uma autoridade própria: o app a guarda em `src/certs` e confere cada conexão com ela. Essa autoridade vale até abril de 2031, e um teste avisa quando faltarem 90 dias.

> A conferência do certificado foi testada contra o Supabase de verdade, com um usuário falso. A conexão com um projeto real ainda não foi testada.

### 2. App na Vercel

Na Vercel, o app não fica ligado o tempo todo: cada pedido acorda uma instância. Por isso:

- **Rotina de cada minuto:** o agendador da Vercel chama `/cron/minuto` a cada minuto, com o segredo `CRON_SECRET`. Sem esse segredo, o endereço não existe para ninguém.
- **WhatsApp:** o app responde à Meta e continua processando a mensagem, e a Vercel espera esse trabalho terminar.
- **Entrada:** `api/index.js` monta o app e recebe todos os endereços, inclusive as páginas e os arquivos de `public`. Assim, os cabeçalhos de segurança valem para tudo.
- **Região:** `pdx1` (Oregon), a mesma do banco atual no Supabase. Se o banco mudar para São Paulo, troque para `gru1` no `vercel.json`.

**Plano:** a Vercel proíbe uso comercial no plano gratuito, e nele o agendador roda só uma vez por dia, o que tiraria os lembretes do ar. Use o plano **Pro**, de US$ 20 por mês. No gratuito, a publicação é recusada por causa do agendamento a cada minuto.

1. **Envie o código ao GitHub** (`git push`) e ligue o repositório a um projeto da Vercel. A cada envio, a Vercel publica de novo.
2. **Variáveis**, em Settings > Environment Variables, no ambiente Production:

   | Variável | Valor |
   |---|---|
   | `AMBIENTE` | `producao` |
   | `APP_URL` | `https://app.nuvexx.com.br` |
   | `APP_TIMEZONE` | `America/Sao_Paulo` |
   | `CABECALHO_IP_CLIENTE` | `x-real-ip` |
   | `BANCO_CONEXOES` | `3` |
   | `NODEJS_HELPERS` | `0`, para a Vercel entregar o pedido como chega, sem interpretar o corpo antes do app |
   | `EMAIL_REMETENTE`, `CADASTRO_ABERTO`, `TESTE_GRATIS_DIAS`, `EMPRESA_NOME`, `EMPRESA_CNPJ`, `EMPRESA_EMAIL` | Os mesmos do `fly.toml` |
   | `DATABASE_URL` | A conexão do Session pooler, como o Supabase mostra, com `[YOUR-PASSWORD]` |
   | `DATABASE_SENHA` | A senha do banco. O app a coloca no lugar do marcador |
   | `RESEND_CHAVE` | A chave de API do Resend |
   | `EMAILS_LIBERADOS` | Quem pode criar conta, separado por vírgula |
   | `SESSAO_SEGREDO`, `CRIPTO_CHAVE`, `CRON_SECRET` | Gerados pelo comando abaixo |

   Este comando copia, sem mostrar na tela, todas as variáveis menos as quatro que só você tem (`DATABASE_URL`, `DATABASE_SENHA`, `RESEND_CHAVE` e `EMAILS_LIBERADOS`): as fixas vêm do `fly.toml`, ajustadas para a Vercel, e os três segredos são gerados na hora. No painel, cole no campo do nome, e a Vercel separa uma por linha. Rode uma vez só, porque trocar `SESSAO_SEGREDO` encerra as sessões, e trocar `CRIPTO_CHAVE` desconecta todos do Google.

   ```bash
   npm run vercel:segredos
   ```

3. **Domínio:** em Settings > Domains, adicione `app.nuvexx.com.br` e, no cPanel, troque o destino do `CNAME` `app` pelo que a Vercel indicar. Apague o `CNAME` `_acme-challenge.app`, que era da Fly.io.
4. Publique de novo depois de mudar variáveis: a Vercel só lê as variáveis na publicação.

### 3. Alternativa: app na Fly.io

**Rode tudo na pasta principal do projeto.** A pasta `fila-de-espera` tem o próprio `fly.toml`: um `fly deploy` dentro dela publica a fila, e não o app.

1. **Crie uma conta em https://fly.io e cadastre um cartão.** Depois, instale o programa de comando `flyctl` e entre com `fly auth login`. No Windows, a instalação é:

   ```bash
   powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
   ```

   Feche e abra o terminal depois de instalar. Se o comando `fly` não for encontrado, confira se a pasta `.fly\bin`, dentro da sua pasta de usuário, está no PATH.

2. Crie o app com o nome escolhido no `fly.toml`:

   ```bash
   fly apps create nome-do-app
   ```

3. Peça o certificado e veja os registros que a Fly.io indica:

   ```bash
   fly certs add app.nuvexx.com.br
   ```

   ```bash
   fly certs setup app.nuvexx.com.br
   ```

   **No cPanel da Staycloud, crie os dois registros `CNAME` que o segundo comando mostra:** `app`, apontando para o endereço que termina em `.fly.dev`, e `_acme-challenge.app`, apontando para o que termina em `.flydns.net`. O segundo deixa o certificado sair antes da publicação. Não altere a raiz nem o `www`.

4. Grave os segredos. O comando pede a conexão e a senha do Supabase, a chave de API do Resend e os e-mails liberados, e gera `SESSAO_SEGREDO` e `CRIPTO_CHAVE` uma única vez, porque trocar o primeiro encerra todas as sessões, e o segundo desconecta todos do Google Agenda. O endereço, o remetente, o prazo do teste e os dados da empresa estão no `fly.toml`.

   ```bash
   npm run fly:segredos
   ```

5. Publique com uma cópia só:

   ```bash
   fly deploy --ha=false
   ```

6. Quando `fly certs check app.nuvexx.com.br` confirmar o certificado, abra o endereço, crie sua conta com um e-mail liberado e teste o fluxo.
7. Para liberar mais alguém:

   ```bash
   fly secrets set EMAILS_LIBERADOS="seu@email.com,outra@pessoa.com"
   ```

Quando a fila de espera sair do ar, decida o que fica na raiz do domínio. Se for o app, crie os registros `A` e `AAAA` com os endereços de `fly ips list`, peça o certificado e troque `APP_URL`. Quem usa o app precisará entrar e instalar de novo no endereço novo.

### Variáveis obrigatórias em qualquer provedor

| Variável | Valor |
|---|---|
| `AMBIENTE` | `producao` |
| `APP_URL` | Endereço público com HTTPS, sem barra no final |
| `CABECALHO_IP_CLIENTE` | Cabeçalho em que o provedor informa o endereço do visitante. Na Vercel: `x-real-ip`. Na Fly.io: `fly-client-ip` |
| `DATABASE_URL` | Conexão do PostgreSQL. Com `[YOUR-PASSWORD]`, defina também `DATABASE_SENHA` |
| `SESSAO_SEGREDO`, `CRIPTO_CHAVE` | Valores aleatórios longos |
| `RESEND_CHAVE` (ou `SMTP_URL`), `EMAIL_REMETENTE` | Serviço de e-mail (próxima seção) |
| `CRON_SECRET` | Só na Vercel: o segredo do agendador |
| `EMPRESA_NOME`, `EMPRESA_CNPJ`, `EMPRESA_EMAIL` | Aparecem nos termos. Sem eles, o app não abre o cadastro |

Em produção, o app se recusa a iniciar se faltar uma delas, e os simuladores deixam de existir.

## Configurar o e-mail

O e-mail é obrigatório: sem ele, ninguém cria conta nem recupera a senha. Qualquer serviço com SMTP funciona.

> O envio foi testado com um servidor SMTP local. Ainda não foi exercitado contra um serviço de e-mail de verdade.

O app usa o Resend. Os e-mails saem do subdomínio `avisos.nuvexx.com.br`, como o Resend recomenda, para que a reputação deles fique separada da caixa `contato@`.

1. Crie uma conta em https://resend.com. Em **Domains**, adicione `avisos.nuvexx.com.br` e escolha a região **São Paulo (sa-east-1)**.
2. Crie, no painel em que o DNS do domínio está (veja [Publicar em um servidor](#publicar-em-um-servidor)), os registros da aba **Records**, copiando os valores exatamente. Nenhum deles fica na raiz do domínio, então o e-mail `contato@` não é afetado. Sem eles, as mensagens não saem.
3. Crie também o registro TXT `_dmarc`, na raiz, com `v=DMARC1; p=none;`. Ele não bloqueia nada e ajuda as mensagens a não cair no spam.
4. Quando o domínio aparecer como verificado, crie em **API Keys** uma chave com **Sending access**, restrita a `avisos.nuvexx.com.br`. O Resend mostra a chave uma vez só.
5. Na Fly.io, `npm run fly:segredos` monta a conexão com essa chave. Em outro servidor, preencha:

   ```
   SMTP_URL=smtps://resend:re_sua_chave@smtp.resend.com:465
   EMAIL_REMETENTE=Nuvexx <nao-responda@avisos.nuvexx.com.br>
   ```

   Se a chave tiver caracteres especiais, escreva esses caracteres no formato de URL. Por exemplo, `@` vira `%40`.

O plano gratuito do Resend permite 100 e-mails por dia. Quando o limite acaba, nenhum e-mail sai até o dia seguinte, nem o código de cadastro nem a recuperação de senha. Cada pessoa sem WhatsApp recebe o resumo do dia e os lembretes por e-mail, então contrate um plano pago antes de passar de algumas dezenas de pessoas.

## Conectar o Google (opcional)

Um mesmo projeto no Google atende às duas funções. Cada uma pede uma autorização própria à pessoa:

- **Continuar com o Google:** só nome, e-mail e identificador da conta. Não dá acesso à agenda.
- **Google Agenda:** os compromissos vão do app para a agenda, inclusive os marcados antes da conexão. O que é criado direto no Google não volta para o app.

> As duas foram testadas com respostas simuladas do Google. Ainda não foram exercitadas contra o Google de verdade.

1. Em https://console.cloud.google.com, crie um projeto e ative a **Google Calendar API**.
2. Configure a tela de consentimento como **Externa**, com o nome do app, os links de termos e privacidade e os escopos `openid`, `email`, `profile` e `calendar.events`.
3. Crie uma credencial **ID do cliente OAuth** do tipo **Aplicativo da Web**, com o endereço de redirecionamento `https://app.nuvexx.com.br/google/retorno`.
4. Preencha no servidor:

   ```
   GOOGLE_CLIENT_ID=id do cliente
   GOOGLE_CLIENT_SECRET=chave secreta do cliente
   ```

5. **Peça a verificação do app ao Google.** O escopo de agenda é considerado sensível. Segundo a documentação do Google, até a verificação, ele fica limitado a 100 usuários novos, mostra um aviso de app não verificado e, em modo de teste, a conexão vence em 7 dias. A análise pode levar até 10 dias e costuma exigir domínio próprio e um vídeo mostrando o uso. Os escopos de entrada são básicos, mas confirme no console como o projeto se comporta antes de contar com isso.

## Conectar o WhatsApp (opcional)

O app usa a API oficial da Meta. Todos os usuários conversam com **um número só**, dedicado ao app: ele não pode estar em uso no WhatsApp comum.

Sem estas configurações, a opção simplesmente não aparece em produção, e todo o resto continua funcionando. Com elas, o botão **WhatsApp** do menu superior leva a uma página só para conectar, onde a pessoa envia, do celular, uma mensagem pronta com um código que vale por 15 minutos. Isso prova que o número é dela, sem custo de mensagem de autenticação. Depois de conectado, o mesmo botão abre a conversa no WhatsApp. Para desconectar, use a aba Conta.

> A integração foi testada com avisos assinados e uma imitação local da API da Meta. Ela ainda não foi exercitada contra a Meta de verdade. Os nomes dos menus podem mudar.

**Antes de começar:** o app precisa estar publicado, porque a Meta pede o endereço do webhook e o da política de privacidade. O número precisa receber SMS ou ligação e não pode estar no WhatsApp: um número já em uso só entra depois de ter a conta apagada. Um chip novo é o caminho mais simples; mantenha-o ativo.

1. Em https://developers.facebook.com/apps, crie um app com o caso de uso de WhatsApp, em um portfólio empresarial com os dados da empresa.
2. No WhatsApp Manager, adicione o número com o nome de exibição `Nuvexx` e confirme com o código recebido.
3. Na configuração da API, anote o **ID do número de telefone** e o **ID da conta do WhatsApp Business**.
4. Em Configurações do app > Básico, copie a **Chave secreta do app** e preencha:
   - **Política de privacidade:** `https://app.nuvexx.com.br/privacidade`
   - **Exclusão de dados:** o mesmo endereço, que explica como apagar a conta
   - **Ícone:** `public/icons/icon-512.png`
5. Em Configurações do negócio > Usuários do sistema, crie um usuário administrador e atribua a ele o app e a conta do WhatsApp, com controle total. Gere um **token permanente** com `whatsapp_business_messaging` e `whatsapp_business_management`.
6. Rode o comando abaixo e cole o que ele pedir. Ele assina os avisos da conta, registra o número, que a Meta só aceita pela API e no máximo 10 vezes a cada 72 horas, e grava as chaves no servidor. Guarde o PIN criado aqui. No fim, ele mostra o token do webhook.

   ```bash
   npm run fly:whatsapp
   ```

7. Na configuração de webhook do app, use `https://app.nuvexx.com.br/webhook` e o token mostrado. Assine o campo **messages**.
8. Publique o app, para ele ficar em modo **Ativo** (Live): em modo de desenvolvimento, a Meta pode não enviar os avisos.
9. No app, conecte o seu número pelo botão **WhatsApp** e mande uma mensagem. As respostas devem chegar.

**Mensagens que o app inicia.** Fora da janela de 24 horas, a Meta só entrega modelos aprovados e pede um meio de pagamento para esse tipo de envio. Sem estes passos, os lembretes e o resumo das 5h30 de quem não falou com o app nesse período vão por e-mail.

10. No WhatsApp Manager, cadastre um meio de pagamento, em reais.
11. Crie estes dois modelos, na categoria **Utilidade**, em português do Brasil. A Meta recusa modelo que começa ou termina com variável ou que tem variáveis demais para o tamanho do texto, e a aprovação é dela.

   `lembrete_compromisso`, com os exemplos `Reunião com José` e `hoje, às 15:00`:

   ```
   Olá! Este é o seu lembrete do Nuvexx: {{1}}, {{2}}. Para mudar algo, é só responder esta mensagem.
   ```

   `resumo_do_dia`, com o exemplo `Hoje você tem Reunião com José, às 15:00.`:

   ```
   Bom dia! Este é o resumo da sua agenda de hoje: {{1}} Para mudar algo, é só responder esta mensagem.
   ```

12. Só depois de os modelos serem aprovados e o pagamento estar cadastrado, ligue-os. Antes disso, a Meta pode aceitar o pedido e não entregar: o app não percebe, e o e-mail não sai no lugar.

   ```bash
   fly secrets set WHATSAPP_MODELO_LEMBRETE=lembrete_compromisso WHATSAPP_MODELO_RESUMO=resumo_do_dia
   ```

**Verificação da empresa.** Pela documentação da Meta, ela não é obrigatória para começar: um portfólio novo pode registrar 2 números e falar com 250 pessoas por dia fora da janela de 24 horas. Faça a verificação com os dados do CNPJ antes de abrir ao público.

## Entender áudio no WhatsApp (opcional)

Com a chave configurada, um áudio no WhatsApp faz o mesmo que a mensagem escrita: "gastei 50 reais de gasolina" anota o gasto com o Caio, e "dentista quinta às três da tarde" marca o compromisso com a Cris. A resposta mostra o que foi ouvido, para um número mal entendido não passar despercebido, e `desfazer` apaga o que foi anotado. Sem a chave, o áudio recebe o aviso para mandar escrito.

> Testado com servidores locais fazendo o papel da Meta e da Groq. Ainda não foi exercitado com a Meta e a Groq de verdade, nem com a voz de pessoas reais: confira a qualidade com áudios seus antes de abrir ao público.

1. Crie uma conta em [console.groq.com](https://console.groq.com) e gere uma chave de API.
2. Preencha no servidor `TRANSCRICAO_CHAVE`. O WhatsApp precisa estar conectado, porque o áudio é baixado com `WHATSAPP_ACCESS_TOKEN`.
3. Reinicie o app e mande um áudio para o número conectado.

Como funciona:

- **Custo:** o modelo padrão, `whisper-large-v3`, custa US$ 0,111 por hora de áudio, com cobrança mínima de 10 segundos por áudio. Um recado de 15 segundos sai por menos de US$ 0,0005. O `whisper-large-v3-turbo` custa US$ 0,04 por hora: para usá-lo, defina `TRANSCRICAO_MODELO`.
- **Quem paga:** número desconhecido, conta com o teste vencido e quem passou de `LIMITE_MENSAGENS_DIA` não geram download nem transcrição.
- **Tamanho:** áudios acima de 1 MB, alguns minutos de voz, são recusados com um aviso.
- **Privacidade:** o áudio fica só na memória durante a transcrição e não é gravado, nem o texto transcrito. Pela documentação da Groq, as transcrições não são guardadas, salvo registros de até 30 dias para investigar erros ou abuso, em servidores nos Estados Unidos. O painel da Groq permite desligar esses registros, o que vale fazer antes de abrir ao público. A política de privacidade já avisa desse compartilhamento: revise-a com um advogado.
- **Outro serviço:** `TRANSCRICAO_URL` aceita outro serviço com a mesma interface, desde que ele receba OGG, o formato das mensagens de voz. A documentação da OpenAI, hoje, não lista esse formato, o que exigiria converter o áudio antes.

## Lembretes

O lembrete de compromisso sai 1 hora antes, ou às 8h nos de dia todo. O de tarefa sai 2 horas antes do horário, ou às 8h quando ela só tem o dia. Tarefa marcada para menos de 2 horas à frente não recebe aviso, porque a hora dele já passou.

- **Com WhatsApp conectado:** vai por lá. Se a Meta não puder entregar ou o envio falhar, vai por e-mail.
- **Sem WhatsApp:** vai por e-mail.

A pessoa pode desligar os lembretes por e-mail na aba Conta.

## Instalar no celular (opcional)

O app funciona em qualquer navegador, no computador ou no celular. Quem quiser pode deixá-lo na tela inicial, e a aba **Conta** explica como:

- **iPhone:** no Safari, Compartilhar > Adicionar à Tela de Início.
- **Android:** no Chrome, botão de instalar ou menu > Instalar app.

Exige o app publicado em um endereço HTTPS. Para as lojas, o caminho previsto é:

- **Google Play:** empacotar o site como app. Conta de empresa custa cerca de US$ 25, uma vez, e, segundo fontes não oficiais, dispensa o teste com 12 pessoas por 14 dias.
- **App Store:** cerca de US$ 99 por ano (confirmar o valor), compilar em um Mac ou na nuvem e passar pela revisão. A Apple costuma rejeitar apps que só embrulham um site (regra 4.2), então a versão da loja precisa de recursos próprios do celular, como notificações e integração com o calendário do aparelho.

## Custos

Consultados em novembro de 2026. Os valores abaixo vêm em parte de guias de terceiros, então confirme nas tabelas oficiais antes de definir o preço.

**Servidor e banco:** cerca de US$ 6 por mês no teste, e cerca de US$ 31 com o banco no plano pago.

- **Fly.io:** US$ 3,69 por mês com 512 MB nas regiões mais baratas. A tabela oficial de São Paulo não pôde ser lida, e um guia de terceiro indica cerca de US$ 6. Não há plano gratuito.
- **Supabase:**
  - O plano gratuito serve para o teste, sem cópias de segurança.
  - O Pro custa US$ 25 por mês, com US$ 10 de processamento incluídos e cópias diárias guardadas por 7 dias.
  - A restauração para qualquer momento é cobrada à parte, cerca de US$ 100 por mês para 7 dias.

**E-mail (Resend):** cadastro, nova senha, avisos e lembretes.

- O plano gratuito permite 100 e-mails por dia e 3.000 por mês.
- O Pro custa US$ 20 por mês, com 50 mil e-mails e sem limite diário.
- Os lembretes e o resumo do dia pesam mais que o resto.

**WhatsApp, só para quem conectar** (base: [página de preços da Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)):

- Mensagens recebidas não são cobradas.
- Cada resposta é uma mensagem de serviço: 1.000 gratuitas por mês por número e, depois, cerca de R$ 0,035 cada no Brasil.
- Com 70 respostas por mês, são cerca de R$ 2,50 por usuário ativo, fora servidor e banco de dados.
- Lembretes fora da janela de 24 horas usam modelo de utilidade, com custo semelhante.
- O resumo das 5h30 também usa esse modelo: uma mensagem por dia com algo marcado, o que pode somar cerca de R$ 1 por mês para cada pessoa com WhatsApp conectado. Com muitos usuários, vale conferir esse custo na tabela da Meta.

A **Conversa** dentro do site não passa pela Meta e não tem custo por mensagem. Para conter o custo do WhatsApp, o app limita as mensagens por pessoa (`LIMITE_MENSAGENS_DIA`), responde uma vez por dia a números sem conta e a contas com o teste vencido, e não envia lembretes a essas contas.

## Dados e segurança

- Toda consulta é filtrada pela pessoa logada, e há testes garantindo que uma conta não alcança os dados de outra.
- As senhas ficam guardadas só como hash (scrypt), com limite de tentativas por e-mail e por endereço.
- As respostas de entrada, cadastro e nova senha não revelam quem tem conta.
- A entrada com o Google só vale no navegador que a começou e exige e-mail confirmado pelo Google.
- O link de um painel compartilhado fica guardado só como hash, vence em 30 dias, entrega só os dados dos blocos daquele painel e não abre a conta.
- O código que conecta o WhatsApp fica guardado só como hash, vale por 15 minutos, funciona uma vez e tem limite de tentativas por número. Ao conectar, a pessoa recebe um aviso por e-mail.
- O webhook só aceita avisos assinados pela Meta, e cada mensagem é tratada uma vez.
- A autorização do Google Agenda fica cifrada no banco.
- O texto original das mensagens não é guardado, e os registros do servidor mascaram o telefone.
- A pessoa pode baixar todos os dados e apagar a conta pela aba Conta.
- Nunca envie o `.env` para um repositório. Ele e `data/` já estão no `.gitignore`.

## Limites desta versão

- O e-mail da conta não pode ser trocado pelo próprio site.
- Quem entra com o Google usa a conta Google com o mesmo e-mail da conta do Nuvexx.
- Entende texto e, pelo WhatsApp, áudio com um pedido de cada vez: dois gastos no mesmo áudio ou na mesma frase não viram dois lançamentos. Foto e vídeo recebem um aviso, e a conversa do site só aceita texto.
- Não há ligação automática com bancos nem Open Finance: os saldos vêm do que é anotado no app. Isso exigiria contratar um integrador autorizado.
- Não há transferência entre contas: ela precisa ser anotada como uma saída e uma entrada.
- Um lançamento futuro conta como feito quando chega a data, mesmo que o pagamento não tenha acontecido. Se não aconteceu, é preciso editar ou apagar.
- A sincronização com o Google Agenda é de mão única, e as tarefas não vão para o Google.
- Todas as contas usam o fuso de `APP_TIMEZONE`.
- O WhatsApp conecta só números do Brasil. As contas pelo site não têm essa restrição.
- Com os nomes de usuário do WhatsApp, a Meta pode omitir o número de quem manda a mensagem. Como a conta é ligada pelo número, essa pessoa fica sem resposta, e o caso aparece nos registros do servidor.
- A cobrança da assinatura ainda não foi integrada: `ASSINATURA_URL` só mostra um link, e nada libera a conta sozinho depois do pagamento.
- Ainda não há página pública de apresentação além da tela de entrada.

## Problemas comuns

| O que acontece | O que fazer |
|---|---|
| O app não inicia em produção | A mensagem no terminal diz qual variável falta |
| O e-mail de cadastro não chega | Veja o registro do servidor e confira `SMTP_URL`, `EMAIL_REMETENTE` e a autenticação do domínio. Depois, olhe o spam |
| Alguém não consegue se cadastrar | Com `CADASTRO_ABERTO=false`, inclua o e-mail em `EMAILS_LIBERADOS` |
| O botão do Google não aparece | Falta `GOOGLE_CLIENT_ID` ou `GOOGLE_CLIENT_SECRET` |
| O Google mostra erro de redirecionamento | O endereço cadastrado precisa ser igual a `APP_URL` + `/google/retorno` |
| A opção de WhatsApp não aparece | Falta `WHATSAPP_NUMERO_PUBLICO` |
| A Meta não valida o webhook | Confira se o endereço é HTTPS e termina em `/webhook`, e se o token é igual ao do `.env` |
| A mensagem chega, mas não há resposta | Veja o registro do servidor. Em geral é token vencido ou ID do número errado |
| A mensagem nem aparece | Confira se o campo `messages` está assinado e se o app da Meta está em modo Ativo |
| Lembrete não chega | Confira o e-mail e se os lembretes por e-mail estão ligados na aba Conta |
