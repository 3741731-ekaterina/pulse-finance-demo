import type {Metadata} from 'next';
import './globals.css';
import './portfolio.css';
import './design-match.css';
import './money-layout.css';
import './unified-finance.css';
export const metadata:Metadata={title:'Рука на пульсе · Демо для портфолио',description:'Интерактивное портфолио: денежные потоки, НДС, взаиморасчёты и переводы. Все данные вымышлены.',openGraph:{title:'Рука на пульсе — финансовый дашборд',description:'Интерактивное демо с вымышленными данными: деньги, НДС и расчёты с поставщиками.',type:'website',locale:'ru_RU'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ru"><body><aside className="portfolio-banner"><strong>ДЕМО · Рука на пульсе</strong><span>Финансовый дашборд · все компании и операции вымышлены</span><a href="https://github.com/3741731-ekaterina/pulse-finance-demo" target="_blank" rel="noreferrer">Код проекта ↗</a></aside>{children}</body></html>}
