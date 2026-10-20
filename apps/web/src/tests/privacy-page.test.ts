import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { USAGE_PING_ACCOUNT_FIELDS, USAGE_PING_FIELDS } from '@bombfarm/contracts';
import { PRIVACY_CONTACT_EMAIL, PrivacyPage } from '@/features/privacy';
import { STRINGS, type Lang } from '@/shared/i18n';

const LANGS: readonly Lang[] = ['en', 'pt'];
const render = (lang: Lang) => renderToStaticMarkup(createElement(PrivacyPage, { t: STRINGS[lang], lang }));
const asHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');

describe('privacy page', () => {
  for (const lang of LANGS) {
    it(`${lang}: describes every field the desktop usage ping sends, the account's included`, () => {
      const html = render(lang);
      for (const field of USAGE_PING_FIELDS) {
        expect(html, field).toContain(`data-field="${field}"`);
        expect(html).toContain(asHtml(STRINGS[lang].privacyPingFields[field]));
      }
      for (const field of USAGE_PING_ACCOUNT_FIELDS) {
        expect(html, field).toContain(`data-field="account.${field}"`);
        expect(html).toContain(asHtml(STRINGS[lang].privacyPingAccountFields[field]));
      }
    });

    it(`${lang}: the contact address is a working mail link and no placeholder is left unfilled`, () => {
      const html = render(lang);
      expect(html).toContain(`href="mailto:${PRIVACY_CONTACT_EMAIL}"`);
      expect(html).not.toMatch(/\{(email|date)\}/);
    });
  }

  it('dates the policy in each language', () => {
    expect(render('en')).toContain('Last updated October 20, 2026');
    expect(render('pt')).toContain('Atualizada em 20 de outubro de 2026');
  });

  it('says a Premium sign-in keeps only the account id, never an email, in each language', () => {
    expect(render('en')).toContain('We ask Discord and Google only for that id — not your email, name or picture.');
    expect(render('pt')).toContain('Pedimos ao Discord e ao Google só esse id — não o seu e-mail, nome ou foto.');
  });

  it('says who can see the account records, and where, in each language', () => {
    expect(render('en')).toContain('in a private dashboard that only the developer can sign in to. It runs on Vercel');
    expect(render('pt')).toContain('num painel privado em que só o desenvolvedor consegue entrar. Ele roda na Vercel');
  });

  it('says a linked game account keeps its player name, refreshed only while the usage count is on, in each language', () => {
    expect(render('en')).toContain('With a linked game account we also keep its player name and when it was last seen.');
    expect(render('en')).toContain('is off, no name is sent and the stored one is no longer updated.');
    expect(render('pt')).toContain('Com uma conta do jogo vinculada, guardamos também o nome de jogador dela');
    expect(render('pt')).toContain('estiver desligada, nenhum nome é enviado e o nome guardado deixa de ser atualizado.');
  });

  it('says what a purchase keeps and who handles the payment, in each language', () => {
    const en = render('en');
    expect(en).toContain('we ask for your country and, if you are in Brazil, your CPF.');
    expect(en).toContain('whether you paid by card or boleto, the country that issued your card and the country of your billing address');
    expect(en).toContain(asHtml("Stripe's card fingerprint, a code that recognises the same card again without revealing its number"));
    expect(en).toContain('We never see or store your card number.');
    expect(en).toContain('We send no email ourselves.');
    expect(en).toContain('Stripe processes payments and holds your payment details.');
    expect(en).toContain('Focus NFe (only if we issue tax invoices) receives your CPF, the amount and the date');
    const pt = render('pt');
    expect(pt).toContain('pedimos o seu país e, se você estiver no Brasil, o seu CPF.');
    expect(pt).toContain('se pagou com cartão ou boleto, o país emissor do cartão e o país do endereço de cobrança');
    expect(pt).toContain('a impressão digital do cartão da Stripe, um código que reconhece o mesmo cartão sem revelar o número');
    expect(pt).toContain('Nunca vemos nem guardamos o número do seu cartão.');
    expect(pt).toContain('Nós mesmos não enviamos e-mails.');
    expect(pt).toContain('A Stripe processa os pagamentos e guarda os dados de pagamento.');
    expect(pt).toContain('A Focus NFe (só se emitirmos notas fiscais) recebe o seu CPF, o valor e a data');
  });

  it('gives the legal bases for purchases, in each language', () => {
    const en = render('en');
    expect(en).toContain('performing our contract with you (LGPD art. 7, V)');
    expect(en).toContain('legal obligation (art. 7, II)');
    expect(en).toContain('our legitimate interest (art. 7, IX). The developer can lift this on request.');
    const pt = render('pt');
    expect(pt).toContain('execução do contrato com você (LGPD art. 7º, V)');
    expect(pt).toContain('cumprimento de obrigação legal (art. 7º, II)');
    expect(pt).toContain('nosso legítimo interesse (art. 7º, IX). O desenvolvedor pode remover o bloqueio a pedido.');
  });

  it('says how long purchase records and anti-abuse codes are kept, and what deletion does to them, in each language', () => {
    const en = render('en');
    expect(en).toContain('are kept for six years after the payment — or, for a subscription or pass, six years after it ends — because the law requires it.');
    expect(en).toContain('kept for two years after they are placed, even after you delete your account');
    expect(en).toContain('once you have no active subscription.');
    expect(en).toContain('Records we must keep by law stay, with your identity replaced by codes. Any remaining Premium time is lost.');
    const pt = render('pt');
    expect(pt).toContain('ficam guardados por seis anos após o pagamento — ou, no caso de uma assinatura ou passe, seis anos após o fim — porque a lei exige.');
    expect(pt).toContain('por dois anos depois de criados, mesmo depois que você exclui a conta');
    expect(pt).toContain('desde que não tenha assinatura ativa.');
    expect(pt).toContain('Os registros que a lei nos obriga a guardar permanecem, com a sua identidade trocada por códigos. O tempo de Premium restante é perdido.');
  });

  it('names every processor and the support log, in each language', () => {
    expect(render('en')).toContain('Supabase, Vercel, DigitalOcean, GitHub and Focus NFe act only on our instructions');
    expect(render('pt')).toContain('Supabase, Vercel, DigitalOcean, GitHub e Focus NFe atuam apenas conforme as nossas instruções');
    expect(render('en')).toContain('to answer support requests; every change made there is logged with its reason.');
    expect(render('pt')).toContain('para atender pedidos de suporte; toda alteração feita ali fica registrada com o motivo.');
  });

  it('says what Premium records and anti-abuse codes cover, in each language', () => {
    const en = render('en');
    expect(en).toContain('your Premium periods');
    expect(en).toContain('the same account, SteamID, game account, card or CPF');
    expect(en).toContain('refund or chargeback');
    const pt = render('pt');
    expect(pt).toContain('os seus períodos de Premium');
    expect(pt).toContain('a mesma conta, SteamID, conta do jogo, cartão ou CPF');
    expect(pt).toContain('reembolso ou contestação');
  });

  it('the two languages carry the same sections, paragraph for paragraph', () => {
    const shape = (lang: Lang) => STRINGS[lang].privacySections.map((section) => section.p.length);
    expect(shape('pt')).toEqual(shape('en'));
  });
});
