import type { UsagePingAccountField, UsagePingField } from "@bombfarm/contracts";

type PolicySection = { readonly title: string; readonly p: readonly string[] };

export const en = {
  privacyNavLabel: "Privacy",
  privacyTitle: "Privacy policy",
  privacyUpdated: "Last updated {date}",
  privacyIntro:
    "Bomb Farm Companion is an unofficial, open-source fan tool for Bomb Farm, made by an independent developer and not affiliated with the game's makers. This page covers the Windows desktop app and this website: what each one collects, why, how long it is kept, and how to have it deleted.",
  privacyPingTitle: "What the desktop app sends us",
  privacyPingIntro:
    "The installed desktop app sends one short message to our server about a minute after it opens, then once an hour while it runs. We use it to count how many people use the app, how many come back, and which versions are still in use. Each message contains:",
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
        "The game's server, for your own account, only after you give permission — and, if you turn on “Let the app forge, equip and reset points”, to make those changes for you.",
        "GitHub, to check for updates and to download a published snapshot of market prices.",
        "The Steam Community Market, to look up public item prices.",
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
    "O Bomb Farm Companion é uma ferramenta de fã, não oficial e de código aberto, para o Bomb Farm, feita por um desenvolvedor independente e sem vínculo com os criadores do jogo. Esta página cobre o app para Windows e este site: o que cada um coleta, por quê, por quanto tempo guardamos e como pedir a exclusão.",
  privacyPingTitle: "O que o app envia para nós",
  privacyPingIntro:
    "O app instalado envia uma mensagem curta ao nosso servidor cerca de um minuto depois de abrir e, em seguida, uma vez por hora enquanto estiver aberto. Usamos isso para contar quantas pessoas usam o app, quantas voltam e quais versões ainda estão em uso. Cada mensagem contém:",
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
        "O servidor do jogo, para a sua própria conta, só depois que você der permissão — e, se você ligar “Deixar o app forjar, equipar e redistribuir pontos”, para fazer essas alterações por você.",
        "O GitHub, para verificar atualizações e baixar um retrato publicado dos preços do mercado.",
        "O Mercado da Comunidade Steam, para consultar preços públicos de itens.",
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
