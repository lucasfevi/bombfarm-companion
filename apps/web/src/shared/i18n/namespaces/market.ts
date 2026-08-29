export const en = {
  marketNoListings: "No listings",
  marketNotOnMarket: "Not on the market",
  marketNotTradable: "Not tradable",

  // Steam prices each region on its own rather than converting, so only a native quote is the
  // number on the page the item links to. The two tooltips exist to keep that distinction visible.
  marketQuoteNativeTooltip: "Steam's own {currency} price for this listing, read {age}.",
  marketQuoteConvertedTooltip:
    "Converted from the USD price at the day's rate, read {age}. Steam sets its own {currency} price, so the listing page will show a different number.",

  marketRefreshLabel: "Refresh",
  marketRefreshName: "Refresh market prices",
  marketPricesUpdated: "Prices updated {age}",

  marketAgeJustNow: "just now",
  marketAgeMinutes: "{value} min ago",
  marketAgeHours: "{value} h ago",
  marketAgeDays: "{value} d ago",
  marketAgeUnknown: "at an unknown time",
};

export const pt: typeof en = {
  marketNoListings: "Sem ofertas",
  marketNotOnMarket: "Fora do mercado",
  marketNotTradable: "Não negociável",

  marketQuoteNativeTooltip: "Preço em {currency} que a própria Steam mostra nesta oferta, lido {age}.",
  marketQuoteConvertedTooltip:
    "Convertido do preço em USD pela cotação do dia, lido {age}. A Steam define o preço em {currency} por conta própria, então a página da oferta vai mostrar outro número.",

  marketRefreshLabel: "Atualizar",
  marketRefreshName: "Atualizar os preços do mercado",
  marketPricesUpdated: "Preços atualizados {age}",

  marketAgeJustNow: "agora mesmo",
  marketAgeMinutes: "há {value} min",
  marketAgeHours: "há {value} h",
  marketAgeDays: "há {value} d",
  marketAgeUnknown: "em um momento desconhecido",
};
