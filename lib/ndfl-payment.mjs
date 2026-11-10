// Only explicit personal-income-tax remittances, not salary or service descriptions.
export function isNdflPayment(t){
 if(t.group!=='outcome'||t.intercompany||/пен[яи]|штраф/i.test(t.category||''))return false;
 const description=(t.description||'').replace(/\u00a0/g,' ');
 return /(?:^|[^а-яё])ндфл(?:$|[^а-яё])|налог[а]?\s+на\s+доходы\s+физических\s+лиц/i.test(description)
   && /(?:уплат|перечислен|оплат)[а-яё]*\s+(?:налог[а-яё]*\s+)?(?:ндфл|налог[а]?\s+на\s+доходы\s+физических\s+лиц)|^\s*(?:ндфл|налог\s+на\s+доходы\s+физических\s+лиц)(?:$|[^а-яё])/i.test(description)
   && !/пен[яи]|штраф|зарплат|заработн|удержан|за\s+вычетом|возврат/i.test(description);
}
