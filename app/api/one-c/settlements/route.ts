import {suppliersDemo} from '../../../../lib/demo-reports.mjs';
export const dynamic='force-dynamic';
export async function GET(){return Response.json({configured:true,mode:'server',demo:true})}
export async function POST(request:Request){try{const body=await request.json();return Response.json(suppliersDemo(body.from,body.to));}catch{return Response.json({error:'Выберите корректный период до года.'},{status:400})}}
