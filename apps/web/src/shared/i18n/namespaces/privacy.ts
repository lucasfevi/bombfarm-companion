import type { UsagePingAccountField, UsagePingField } from "@bombfarm/contracts";

type PolicySection = { readonly title: string; readonly p: readonly string[] };

export const en = {
  privacyNavLabel: "Privacy",
  privacyTitle: "Privacy policy",
  privacyUpdated: "Last updated {date}",
  privacyIntro:
    "Bomb Farm Companion is an unofficial, open-source fan tool for Bomb Farm, made by an independent developer and not affiliated with the game's makers. This page covers the Windows desktop app, this website and Premium accounts: what each one collects, why, how long it is kept, and how to have it deleted.",
  privacyPingTitle: "What the desktop app sends us",
  privacyPingIntro:
    "The installed desktop app sends one short message to our server about a minute after it opens, then once an hour while it runs. We use it to count how many people use the app, how many come back, and which versions are still in use, and so the developer can see which game accounts use the app and when each was last active. Each message contains:",
  privacyPingFields: {
    v: "The version of the message format.",
    kind: "Whether it is the start-up message or an hourly one.",
    flavor: "Which build you installed: stable, beta or a developer build.",
    version: "The app's version number.",
    install:
      "A random code created for this installation. It says nothing about you or your computer; it only lets us tell one installation from another.",
    account: "Your game account, as below — only while the setting is on.",
  } satisfies Record<UsagePingField, string>,
  privacyPingAccountFields: {
    id: "Your game account id.",
    name: "Your player name.",
  } satisfies Record<UsagePingAccountField, string>,
  privacyPingOptOut:
    "To stop it, turn off Settings → Usage count → “Include my account in the usage count” in the desktop app. While it is off, the message carries only the format version, the kind, the build and the app version — no installation code, no account, no name — and the installation code is deleted from your computer. Turning it back on creates a new code that cannot be linked to the old one. Our server does not store your IP address and keeps no access log. Development builds never send the message.",
  privacySections: [
    {
      title: "How long we keep it",
      p: [
        "Individual messages are deleted after 30 days.",
        "For each installation code we keep when it was first and last seen, the app version and the build; for each game account, when it was first and last seen and the player name. These records are deleted 12 months after they were last seen.",
        "We keep daily totals — how many installations and accounts were active each day — for as long as the project runs. They contain no codes, ids or names.",
      ],
    },
    {
      title: "Where it is stored and who else handles it",
      p: [
        "Messages arrive at a server we rent from DigitalOcean in New York, United States, and are stored in a database run by Supabase in the eastern United States. Both act only on our instructions. Because both are outside Brazil, providing this service transfers your data internationally.",
        "Only the developer, acting as the administrator, can look up the account records — game account id, player name, and when each account was first and last seen — and only after signing in. That lookup runs on Vercel in the eastern United States, which, like the two above, is outside Brazil and acts only on our instructions. It does not show installation codes.",
        "We do not sell your data, share it with the game's makers, or use it for advertising.",
      ],
    },
    {
      title: "What stays on your computer",
      p: [
        "With your permission, the desktop app reads your game account from the game's own server, using the session your game client already holds. What it reads — heroes, items, progress — is stored on your computer and is never sent to us. You can withdraw that permission at any time in Settings.",
        "The app's diagnostic logs are written to your computer only. They reach us only if you choose to send them.",
      ],
    },
    {
      title: "Other services the desktop app talks to",
      p: [
        "The game's server, for your own account, only after you give permission — and, if you turn on “Let the app forge, equip and reset points”, to make those changes for you and to burn items for Forge Essence.",
        "GitHub, to check for updates and to download a published snapshot of market prices.",
        "The Steam Community Market, to look up public item prices.",
        "Our own server, about every five minutes, to read how many players are online in the game. That request carries nothing about you, and the server does not store your IP address.",
        "Only the requests to the game's own server include your account.",
      ],
    },
    {
      title: "This website",
      p: [
        "This website is a static site hosted by Vercel. Saves you import stay in your browser's storage on your device and are never uploaded.",
        "It loads public data from GitHub (the latest release and market prices). It uses no analytics and no tracking cookies. Like any web host, Vercel may keep standard technical logs of requests.",
      ],
    },
    {
      title: "Premium accounts",
      p: [
        "Premium is an optional paid tier. Everything from here to “Your rights” applies only if you create a Premium account; if you never do, none of it is collected. You create the account on the Premium account website by signing in with Discord, Google or Steam.",
        "For a Premium account we keep a random code that identifies the account, and the account id of each sign-in you add: your Discord account id, your Google account id and your SteamID. We ask Discord and Google only for that id — not your email, name or picture. Signing in with Steam also proves which SteamID is yours.",
        "Once you sign in on the desktop app, it can send us your game account id and the SteamID the game stores on your computer. We link them to your Premium account only if that SteamID matches the one you signed in with. Nothing else from the game is sent, and never your game session.",
        "With a linked game account we also keep its player name and when it was last seen. We fill them in once when the link is made, from the name the usage count above already recorded, and keep them current from that same hourly message. While “Include my account in the usage count” is off, no name is sent and the stored one is no longer updated.",
        "Sign-in sessions are random codes that keep you signed in. We store them only in a scrambled form that cannot be turned back into the code.",
        "Before your first purchase we ask for your country and, if you are in Brazil, your CPF. We need the CPF for Brazilian tax documents.",
        "For each purchase we keep which Premium plan or pass you bought, when, the amount, whether you paid by card or boleto, the country that issued your card and the country of your billing address, any refund or chargeback, and Stripe's reference numbers for them. For cards we also keep Stripe's card fingerprint, a code that recognises the same card again without revealing its number. We also keep your Premium periods: when your Premium starts and ends, and why (subscription, pass or a grant from the developer).",
        "We never see or store your card number. Payments are handled by Stripe, which collects your payment details, email and billing address and sends your receipts and payment emails. We send no email ourselves.",
        "We use this data to run your Premium account and take payment — performing our contract with you (LGPD art. 7, V). We keep payment and tax records because the law requires it — legal obligation (art. 7, II).",
        "To prevent abuse, after a 7-day withdrawal refund or a chargeback we keep codes that stop the same account, SteamID, game account, card or CPF from buying again — our legitimate interest (art. 7, IX). The developer can lift this on request.",
      ],
    },
    {
      title: "Where Premium data is stored and who else handles it",
      p: [
        "Premium account data is stored by Supabase in its own database in the eastern United States, separate from the usage data above. The Premium account website runs on Vercel, and our server on DigitalOcean, as above. Discord, Google and Steam confirm who you are when you sign in with them. Stripe processes payments and holds your payment details.",
        "Focus NFe (only if we issue tax invoices) receives your CPF, the amount and the date to issue the Brazilian service invoice (NFS-e), which also goes to the city tax authority.",
        "GitHub stores an encrypted copy of the Premium database each night, kept for 90 days, so we can recover from a failure.",
        "Supabase, Vercel, DigitalOcean, GitHub and Focus NFe act only on our instructions; Stripe, Discord, Google and Steam also act under their own privacy policies. Most of them are outside Brazil, so this is an international transfer of your data. Only the developer, acting as the administrator, can look up Premium account records, including a linked game account's player name, with the same signed-in access described above, to answer support requests; every change made this way is logged with its reason.",
      ],
    },
    {
      title: "How long Premium data is kept",
      p: [
        "Temporary sign-in codes are deleted within a day of expiring. A session is deleted within a day of expiring, of going unused for too long, or of you signing out.",
        "Your account, sign-ins and game account link are kept until you delete your account. The player name and last-seen time kept with a link are deleted along with it.",
        "Payment, refund, chargeback and tax-invoice records are kept for six years after the payment — or, for a subscription or pass, six years after it ends — because the law requires it.",
        "The anti-abuse codes are kept for two years after they are placed, even after you delete your account, as one-way codes that cannot be turned back into your data.",
        "Nightly encrypted copies are deleted after 90 days.",
      ],
    },
    {
      title: "Deleting your Premium account",
      p: [
        "You can delete your Premium account yourself on the Premium account website once you have no active subscription. Deletion signs you out everywhere and removes your sign-ins and game account link, with its player name; only the random account code remains, marked as deleted, with nothing that identifies you. Records we must keep by law stay, with your identity replaced by codes. Any remaining Premium time is lost.",
        "A deleted account may still sit in the encrypted nightly copies for up to 90 days. So that a restore never brings it back, we note the deleted account's random code and the time of deletion outside the database, and delete it again if we ever restore a copy. That note holds nothing else.",
        "Your rights below apply to Premium data too; include one of your Premium account's sign-ins (for example your SteamID) in your email so we can find it.",
      ],
    },
    {
      title: "Your rights",
      p: [
        "Under Brazil's LGPD and similar laws you can ask us to confirm whether we hold data about you, see it, correct it, delete it, or learn who we share it with. Email us with your game account id and we will answer within 15 days.",
        "You do not need to email us to stop the collection: turning the setting off does that immediately.",
      ],
    },
    {
      title: "Children",
      p: ["The app is not directed at children. If you believe we hold data about a child, email us and we will delete it."],
    },
    {
      title: "Changes to this policy",
      p: [
        "If we change what the app collects, we will update this page and its date before the change ships, and say so in the release notes.",
      ],
    },
    {
      title: "Contact",
      p: ["Questions and requests: {email}."],
    },
  ] as readonly PolicySection[],
};

export const pt: typeof en = {
  privacyNavLabel: "Privacidade",
  privacyTitle: "Política de privacidade",
  privacyUpdated: "Atualizada em {date}",
  privacyIntro:
    "O Bomb Farm Companion é uma ferramenta de fã, não oficial e de código aberto, para o Bomb Farm, feita por um desenvolvedor independente e sem vínculo com os criadores do jogo. Esta página cobre o app para Windows, este site e as contas Premium: o que cada um coleta, por quê, por quanto tempo guardamos e como pedir a exclusão.",
  privacyPingTitle: "O que o app envia para nós",
  privacyPingIntro:
    "O app instalado envia uma mensagem curta ao nosso servidor cerca de um minuto depois de abrir e, em seguida, uma vez por hora enquanto estiver aberto. Usamos isso para contar quantas pessoas usam o app, quantas voltam e quais versões ainda estão em uso, e para que o desenvolvedor possa ver quais contas do jogo usam o app e quando cada uma esteve ativa pela última vez. Cada mensagem contém:",
  privacyPingFields: {
    v: "A versão do formato da mensagem.",
    kind: "Se é a mensagem de abertura ou uma das mensagens de hora em hora.",
    flavor: "Qual versão você instalou: estável, beta ou de desenvolvimento.",
    version: "O número da versão do app.",
    install:
      "Um código aleatório criado para esta instalação. Ele não diz nada sobre você nem sobre o seu computador; só nos permite distinguir uma instalação de outra.",
    account: "A sua conta do jogo, como abaixo — só enquanto a opção estiver ligada.",
  },
  privacyPingAccountFields: {
    id: "O id da sua conta do jogo.",
    name: "O seu nome de jogador.",
  },
  privacyPingOptOut:
    "Para parar, desligue Configurações → Contagem de uso → “Incluir minha conta na contagem de uso” no app. Enquanto estiver desligada, a mensagem leva só a versão do formato, o tipo, a versão instalada e a versão do app — sem código de instalação, sem conta, sem nome — e o código da instalação é apagado do seu computador. Ao religar, é criado um código novo, que não pode ser ligado ao antigo. O nosso servidor não guarda o seu endereço IP e não mantém registro de acessos. Versões de desenvolvimento nunca enviam a mensagem.",
  privacySections: [
    {
      title: "Por quanto tempo guardamos",
      p: [
        "As mensagens individuais são apagadas após 30 dias.",
        "Para cada código de instalação, guardamos quando foi visto pela primeira e pela última vez, a versão do app e a versão instalada; para cada conta do jogo, quando foi vista pela primeira e pela última vez e o nome de jogador. Esses registros são apagados 12 meses depois da última vez em que foram vistos.",
        "Guardamos totais diários — quantas instalações e contas estiveram ativas em cada dia — enquanto o projeto existir. Eles não contêm códigos, ids nem nomes.",
      ],
    },
    {
      title: "Onde fica guardado e quem mais tem acesso",
      p: [
        "As mensagens chegam a um servidor que alugamos da DigitalOcean em Nova York, Estados Unidos, e são guardadas num banco de dados operado pela Supabase no leste dos Estados Unidos. As duas atuam apenas conforme as nossas instruções. Como ambas ficam fora do Brasil, prestar este serviço envolve transferência internacional dos seus dados.",
        "Só o desenvolvedor, como administrador, pode consultar os registros das contas — o id da conta do jogo, o nome de jogador e quando cada conta foi vista pela primeira e pela última vez — e só depois de fazer login. Essa consulta roda na Vercel, no leste dos Estados Unidos, que, como as duas acima, fica fora do Brasil e atua apenas conforme as nossas instruções. Ela não mostra os códigos de instalação.",
        "Não vendemos os seus dados, não os compartilhamos com os criadores do jogo e não os usamos para publicidade.",
      ],
    },
    {
      title: "O que fica no seu computador",
      p: [
        "Com a sua permissão, o app lê a sua conta do jogo no próprio servidor do jogo, usando a sessão que o seu cliente do jogo já tem. O que ele lê — heróis, itens, progresso — fica guardado no seu computador e nunca é enviado para nós. Você pode retirar essa permissão a qualquer momento nas Configurações.",
        "Os registros de diagnóstico do app são gravados só no seu computador. Eles só chegam até nós se você decidir enviá-los.",
      ],
    },
    {
      title: "Outros serviços com que o app se comunica",
      p: [
        "O servidor do jogo, para a sua própria conta, só depois que você der permissão — e, se você ligar “Deixar o app forjar, equipar e redistribuir pontos”, para fazer essas alterações por você e para queimar itens e obter Essência de Forja.",
        "O GitHub, para verificar atualizações e baixar um retrato publicado dos preços do mercado.",
        "O Mercado da Comunidade Steam, para consultar preços públicos de itens.",
        "O nosso próprio servidor, a cada cerca de cinco minutos, para ler quantos jogadores estão online no jogo. Essa requisição não leva nada sobre você, e o servidor não guarda o seu endereço IP.",
        "Só as requisições ao próprio servidor do jogo incluem a sua conta.",
      ],
    },
    {
      title: "Este site",
      p: [
        "Este site é estático e hospedado pela Vercel. Os saves que você importa ficam no armazenamento do seu navegador, no seu dispositivo, e nunca são enviados.",
        "Ele carrega dados públicos do GitHub (a versão mais recente e os preços do mercado). Não usa ferramentas de análise nem cookies de rastreamento. Como qualquer hospedagem, a Vercel pode manter registros técnicos padrão das requisições.",
      ],
    },
    {
      title: "Contas Premium",
      p: [
        "O Premium é um plano pago e opcional. Tudo daqui até “Os seus direitos” vale só se você criar uma conta Premium; se nunca criar, nada disso é coletado. A conta é criada no site da conta Premium, entrando com Discord, Google ou Steam.",
        "De uma conta Premium guardamos um código aleatório que identifica a conta e o id de cada forma de entrar que você adicionar: o id da sua conta do Discord, o id da sua conta do Google e o seu SteamID. Pedimos ao Discord e ao Google só esse id — não o seu e-mail, nome ou foto. Entrar com a Steam também comprova qual SteamID é seu.",
        "Depois que você entra no app, ele pode nos enviar o id da sua conta do jogo e o SteamID que o jogo guarda no seu computador. Só os vinculamos à sua conta Premium se esse SteamID for o mesmo com que você entrou. Nada mais do jogo é enviado, e nunca a sua sessão do jogo.",
        "Com uma conta do jogo vinculada, guardamos também o nome de jogador dela e quando ela foi vista pela última vez. Preenchemos esses dados uma vez, no momento do vínculo, a partir do nome que a contagem de uso descrita acima já registrou, e os mantemos atualizados por essa mesma mensagem de hora em hora. Enquanto “Incluir minha conta na contagem de uso” estiver desligada, nenhum nome é enviado e o nome guardado deixa de ser atualizado.",
        "As sessões de acesso são códigos aleatórios que mantêm você conectado. Guardamos só uma forma embaralhada deles, que não pode ser convertida de volta no código.",
        "Antes da sua primeira compra, pedimos o seu país e, se você estiver no Brasil, o seu CPF. Precisamos do CPF para os documentos fiscais brasileiros.",
        "De cada compra guardamos qual plano ou passe Premium você comprou, quando, o valor, se pagou com cartão ou boleto, o país emissor do cartão e o país do endereço de cobrança, qualquer reembolso ou contestação, e os números de referência da Stripe. Para cartões guardamos também a impressão digital do cartão da Stripe, um código que reconhece o mesmo cartão sem revelar o número. Guardamos ainda os seus períodos de Premium: quando o Premium começa e termina, e por quê (assinatura, passe ou concessão do desenvolvedor).",
        "Nunca vemos nem guardamos o número do seu cartão. Os pagamentos são feitos pela Stripe, que coleta os dados de pagamento, o e-mail e o endereço de cobrança e envia os recibos e avisos de pagamento. Nós mesmos não enviamos e-mails.",
        "Usamos esses dados para manter a sua conta Premium e receber o pagamento — execução do contrato com você (LGPD art. 7º, V). Guardamos os registros de pagamento e fiscais porque a lei exige — cumprimento de obrigação legal (art. 7º, II).",
        "Para evitar abusos, depois de um reembolso de arrependimento em 7 dias ou de uma contestação, guardamos códigos que impedem a mesma conta, SteamID, conta do jogo, cartão ou CPF de comprar de novo — nosso legítimo interesse (art. 7º, IX). O desenvolvedor pode remover o bloqueio a pedido.",
      ],
    },
    {
      title: "Onde ficam os dados Premium e quem mais tem acesso",
      p: [
        "Os dados das contas Premium são guardados pela Supabase num banco de dados próprio no leste dos Estados Unidos, separado dos dados de uso descritos acima. O site da conta Premium roda na Vercel, e o nosso servidor na DigitalOcean, como acima. Discord, Google e Steam confirmam quem você é quando você entra com eles. A Stripe processa os pagamentos e guarda os dados de pagamento.",
        "A Focus NFe (só se emitirmos notas fiscais) recebe o seu CPF, o valor e a data para emitir a nota fiscal de serviço (NFS-e), que também vai para a prefeitura.",
        "O GitHub guarda toda noite uma cópia criptografada do banco de dados Premium, mantida por 90 dias, para podermos recuperar falhas.",
        "Supabase, Vercel, DigitalOcean, GitHub e Focus NFe atuam apenas conforme as nossas instruções; Stripe, Discord, Google e Steam também seguem as próprias políticas de privacidade. A maioria fica fora do Brasil, então isso envolve transferência internacional dos seus dados. Só o desenvolvedor, como administrador, pode consultar os registros das contas Premium, incluindo o nome de jogador de uma conta do jogo vinculada, com o mesmo acesso autenticado descrito acima, para atender pedidos de suporte; toda alteração feita por esse acesso fica registrada com o motivo.",
      ],
    },
    {
      title: "Por quanto tempo guardamos os dados Premium",
      p: [
        "Códigos temporários de acesso são apagados em até um dia depois de expirarem. Uma sessão é apagada em até um dia depois de expirar, de ficar sem uso por tempo demais ou de você sair.",
        "A sua conta, as formas de entrar e o vínculo com a conta do jogo ficam guardados até você excluir a conta. O nome de jogador e o horário da última vez em que a conta foi vista, guardados com um vínculo, são apagados junto com ele.",
        "Registros de pagamento, reembolso, contestação e nota fiscal ficam guardados por seis anos após o pagamento — ou, no caso de uma assinatura ou passe, seis anos após o fim — porque a lei exige.",
        "Os códigos contra abuso ficam guardados por dois anos depois de criados, mesmo depois que você exclui a conta, como códigos de mão única que não podem ser convertidos de volta nos seus dados.",
        "As cópias noturnas criptografadas são apagadas após 90 dias.",
      ],
    },
    {
      title: "Excluir a sua conta Premium",
      p: [
        "Você mesmo pode excluir a sua conta Premium no site da conta Premium, desde que não tenha assinatura ativa. A exclusão desconecta você de todos os lugares e remove as formas de entrar e o vínculo com a conta do jogo, com o nome de jogador; só o código aleatório da conta permanece, marcado como excluído, sem nada que identifique você. Os registros que a lei nos obriga a guardar permanecem, com a sua identidade trocada por códigos. O tempo de Premium restante é perdido.",
        "Uma conta excluída pode continuar nas cópias noturnas criptografadas por até 90 dias. Para que uma restauração nunca a traga de volta, anotamos o código aleatório da conta excluída e o horário da exclusão fora do banco de dados, e a excluímos de novo se algum dia restaurarmos uma cópia. Essa anotação não contém mais nada.",
        "Os seus direitos descritos abaixo valem também para os dados Premium; inclua no e-mail uma das formas de entrar da conta Premium (por exemplo, o seu SteamID) para que possamos encontrá-la.",
      ],
    },
    {
      title: "Os seus direitos",
      p: [
        "Pela LGPD, você pode pedir que confirmemos se temos dados seus, acessá-los, corrigi-los, excluí-los ou saber com quem os compartilhamos. Envie um e-mail com o id da sua conta do jogo e responderemos em até 15 dias.",
        "Você não precisa enviar e-mail para interromper a coleta: desligar a opção faz isso na hora.",
      ],
    },
    {
      title: "Crianças",
      p: ["O app não é voltado para crianças. Se você acredita que temos dados de uma criança, envie um e-mail e nós os excluiremos."],
    },
    {
      title: "Alterações nesta política",
      p: [
        "Se mudarmos o que o app coleta, atualizaremos esta página e a sua data antes de a mudança ser lançada, e avisaremos nas notas da versão.",
      ],
    },
    {
      title: "Contato",
      p: ["Dúvidas e pedidos: {email}."],
    },
  ],
};
