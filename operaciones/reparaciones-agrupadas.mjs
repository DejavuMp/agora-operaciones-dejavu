/* Una solicitud visible por proyecto y stand.
 * Los documentos técnicos existentes siguen intactos para auditoría,
 * fotografías, decisiones, accesos y cotizaciones por concepto.
 */
export const HCB_GROUP_ANCHOR="0bc8b614-99ea-5822-b91e-6e0ea766822e";
const norm=v=>String(v??"").trim().replace(/\s+/g," ").toLocaleLowerCase("es-MX");
export function bundleKey(r){
 return norm(r.project)+"|"+norm(r.asset);
}
export function groupRepairs(records){
 const groups=new Map();
 for(const r of records){
  const key=bundleKey(r);
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(r);
 }
 return [...groups.values()].map(items=>{
  const ordered=[...items].sort((a,b)=>
   (a.createdAt?.seconds??0)-(b.createdAt?.seconds??0)||String(a.id).localeCompare(String(b.id)));
  const preferred=ordered.find(x=>norm(x.project)==="hot cruji bravo"&&x.id===HCB_GROUP_ANCHOR);
  const anchor=preferred||ordered[0];
  return {key:bundleKey(anchor),id:anchor.id,project:anchor.project,asset:anchor.asset,items:ordered,
   open:ordered.filter(x=>!["terminado","entregado"].includes(x.status)).length,
   done:ordered.filter(x=>["terminado","entregado"].includes(x.status)).length};
 }).sort((a,b)=>{
  const max=arr=>Math.max(0,...arr.map(r=>r.updatedAt?.seconds||r.createdAt?.seconds||0));
  return max(b.items)-max(a.items);
 });
}
export function bundleByItem(records,id){
 return groupRepairs(records).find(g=>g.items.some(r=>r.id===id))||null;
}
export function bundleStatus(group){
 if(!group)return "sin datos";
 if(group.done===group.items.length)return "terminado";
 return group.open+" pendiente"+(group.open===1?"":"s");
}
export function bundleSummary(group,link=""){
 if(!group)return "";
 const lines=[
 "ÁGORA DEJAVÚ · SOLICITUD GENERAL DE REPARACIONES",
 "Folio general: "+group.id,
 "Proyecto: "+group.project,
 "Stand / equipo: "+group.asset,
 "Total de conceptos: "+group.items.length,
 "Pendientes: "+group.open+" · Terminados/entregados: "+group.done,
 "",
 "CONCEPTOS DE REPARACIÓN"
 ];
 for(const [i,r] of group.items.entries()){
  lines.push(
   (i+1)+". "+r.area,
   "   Problema: "+(r.problem||"Por revisar"),
   "   Prioridad: "+(r.priority||"Normal")+" · Estado: "+(r.status||"pendiente"),
   "   Responsable: "+(r.assignedTo||"Por asignar"),
   "   Ruta: "+(r.repairRoute||"pendiente"),
   "   Fotos vinculadas: "+(r.photos?.length||0),
   "   Importe estimado: $"+Number(r.estimatedCost||0).toFixed(2)+" MXN",
   ...(r.quotes||[]).map(q=>"   Cotización: "+q.provider+" · $"+Number(q.amount).toFixed(2)+" MXN"+(q.id===r.selectedQuoteId?" · SELECCIONADA":"")),
   "   Control técnico: "+r.id,
   ""
  );
 }
 lines.push("Importes por concepto (no constituyen total autorizado).",
  "Enlace privado a la solicitud: "+link);
 return lines.join("\n");
}
