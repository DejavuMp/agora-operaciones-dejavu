/* Dominio compartido por la pantalla y las pruebas, sin datos reales ni efectos secundarios. */
export const STATUSES=["pendiente","revision","cotizando","autorizado","reparacion","terminado","entregado"];
export const ROUTES=["pendiente","staff","agencia","proveedor","nuevo","cotizar","comparar"];
export const PRIORITIES=["Normal","Alta","Urgente"];
export const SCOPES=["Área del stand","Elemento específico","Stand completo","Mueble suelto"];
export const clean=(v,max=200)=>String(v??"").trim().slice(0,max);
export function safeUrl(value){
 const text=clean(value,1000);if(!text)return "";
 try{const url=new URL(text);return url.protocol==="https:"?url.href:""}catch{return ""}
}
export function makeRequest(raw,user,id,stamp){
 if(!/^[a-f0-9-]{36}$/.test(id))throw Error("Folio no válido");
 const r={
  id,assetId:clean(raw.assetId,36),project:clean(raw.project,120),asset:clean(raw.asset,120),
  scope:SCOPES.includes(raw.scope)?raw.scope:SCOPES[1],area:clean(raw.area,120),
  cause:clean(raw.cause,250),problem:clean(raw.problem,2000),
  solutionMode:raw.solutionMode==="propuesta"?"propuesta":"instrucciones",
  instructions:clean(raw.instructions,2000),materialLink:safeUrl(raw.materialLink),
  dueDate:clean(raw.dueDate,10),priority:PRIORITIES.includes(raw.priority)?raw.priority:"Normal",
  createdBy:user.uid,createdByEmail:clean(user.email,240),createdByName:clean(user.name,120),
  createdAt:stamp,updatedAt:stamp,status:"pendiente",repairRoute:"pendiente",
  assignedTo:"",decisionBy:"",decisionNote:"",estimatedCost:0,
  quotes:[],selectedQuoteId:"",photos:[],revision:1
 };
 if(!r.project||!r.asset||!r.area||!r.problem)throw Error("Completa proyecto, activo, pieza y problema");
 if(raw.materialLink&&!r.materialLink)throw Error("El enlace de materiales debe ser HTTPS");
 return r;
}
export function makeQuote(raw,id){
 const q={id,provider:clean(raw.provider,160),amount:Number(raw.amount),
  scope:clean(raw.scope,500),link:safeUrl(raw.link),note:clean(raw.note,500)};
 if(!q.provider||!Number.isFinite(q.amount)||q.amount<0||q.amount>99999999)throw Error("Proveedor e importe MXN válidos son obligatorios");
 if(raw.link&&!q.link)throw Error("La cotización requiere un enlace HTTPS");
 return q;
}
export function summary(r,link=""){
 const quote=(r.quotes||[]).map((q,i)=>`${i+1}. ${q.provider}: $${Number(q.amount).toFixed(2)} MXN · ${q.scope||"Sin alcance"}${q.id===r.selectedQuoteId?" · SELECCIONADA":""}${q.link?" · "+q.link:""}`).join("\n")||"Pendientes";
 return [
 "ÁGORA DEJAVÚ · SOLICITUD DE REPARACIÓN",
 "Folio: "+r.id,"Proyecto: "+r.project,"Elemento: "+r.asset+" / "+r.area,"ID inventario: "+(r.assetId||"No vinculado"),
 "Alcance: "+r.scope,"Motivo: "+(r.cause||"Sin especificar"),
 "Problema: "+r.problem,"Trabajo / propuesta: "+(r.solutionMode==="propuesta"?"Solicitar propuesta":r.instructions),
 "Materiales: "+(r.materialLink||"Sin enlace"),"Necesario para: "+(r.dueDate||"Sin fecha"),
 "Prioridad: "+r.priority,"Reportó: "+r.createdByName+" ("+r.createdByEmail+")",
 "Estado: "+r.status,"Ruta de arreglo: "+r.repairRoute,
 "Responsable: "+(r.assignedTo||"Por asignar"),"Decidió: "+(r.decisionBy||"Pendiente"),
 "Costo estimado: $"+Number(r.estimatedCost||0).toFixed(2)+" MXN",
 "Cotizaciones:\n"+quote,"Notas: "+(r.decisionNote||""),
 "Fotografías registradas: "+(r.photos||[]).length,
 "Enlace privado de seguimiento: "+link
 ].join("\n");
}
export function encodeCsv(rows){
 const cols=["id","project","asset","area","createdByName","priority","status","repairRoute","assignedTo","dueDate","estimatedCost"];
 const q=v=>{let s=String(v??"");if(/^[\\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
 return "\ufeff"+[cols.join(","),...rows.map(r=>cols.map(k=>q(r[k])).join(","))].join("\r\n");
}
