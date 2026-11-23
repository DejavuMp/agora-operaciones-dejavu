import "../firebase-init.js";
import {TOKEN_PATTERN,supplierResponse} from "./reparaciones-invitaciones-model.mjs";
import {doc,getDocFromServer,updateDoc,serverTimestamp} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";
const $=id=>document.getElementById(id);
const fb=window.AGORA_FIREBASE,db=fb?.firestore;
const token=new URL(location.href).searchParams.get("solicitud")||"";
const fields=[
 ["Proyecto","project"],["Stand / mueble","asset"],["Pieza","area"],["Problema","problem"],
 ["Tipo de atención","scope"],["Prioridad","priority"],["Fecha solicitada","dueDate"]
];
const record=()=>doc(db,"agora_repair_invites",token);
function stop(message){
 $("loading").hidden=false;$("publicWorkspace").hidden=true;
 $("status").textContent="No se puede utilizar esta invitación.";$("error").textContent=message;
}
function show(invite){
 const detail=$("detail");detail.replaceChildren();
 for(const [label,key] of fields){
  if(!invite.snapshot?.[key])continue;
  const dt=document.createElement("dt"),dd=document.createElement("dd");
  dt.textContent=label;dd.textContent=invite.snapshot[key];detail.append(dt,dd);
 }
 const preview=invite.snapshot?.photoPreview||"";
 const valid=typeof preview==="string"&&preview.startsWith("data:image/jpeg;base64,")&&preview.length<=150000;
 $("photoBlock").hidden=!valid;
 if(valid)$("photoPreview").src=preview;
 const material=invite.snapshot?.materialLink||"";
 if(material.startsWith("https://")){
  const a=document.createElement("a");a.textContent="Abrir planos o materiales compartidos";a.href=material;
  a.target="_blank";a.rel="noopener noreferrer";
  $("materials").replaceChildren(a);
 }
 $("expires").textContent="Invitación vigente hasta: "+invite.expiresAt.toDate().toLocaleString("es-MX",{dateStyle:"medium",timeStyle:"short"});
 $("loading").hidden=true;$("publicWorkspace").hidden=false;
 if(invite.status==="submitted"){
  $("responseCard").replaceChildren();
  const h=document.createElement("h2"),p=document.createElement("p");
  h.textContent="Cotización recibida";p.textContent="Tu propuesta ya fue registrada. Dejavú revisará el presupuesto y se pondrá en contacto.";
  $("responseCard").append(h,p);
 }
}
async function init(){
 if(!TOKEN_PATTERN.test(token))return stop("El enlace es incorrecto. Solicita uno nuevo a coordinación.");
 if(!db)return stop("No fue posible conectar con el sistema. Inténtalo de nuevo.");
 try{
  const snapshot=await getDocFromServer(record());
  if(!snapshot.exists())return stop("El enlace no existe, ha expirado o fue cancelado.");
  const info=snapshot.data();
  if(!["pending","submitted"].includes(info.status)||info.expiresAt?.toMillis()<=Date.now())return stop("Este enlace ya no está vigente.");
  show(info);
 }catch(e){stop("No fue posible consultar la solicitud. Verifica que el enlace esté vigente. "+(e?.code==="permission-denied"?"Acceso restringido.":""));}
}
$("quoteForm").onsubmit=async e=>{
 e.preventDefault();const button=$("submit");button.disabled=true;
 $("message").textContent="Enviando propuesta...";
 try{
  const data=supplierResponse(Object.fromEntries(new FormData(e.target).entries()));
  await updateDoc(record(),{status:"submitted",response:data,submittedAt:serverTimestamp(),updatedAt:serverTimestamp()});
  $("message").textContent="Cotización enviada correctamente.";await init();
 }catch(error){
  $("message").textContent=/permission-denied/.test(error.code||"")?
   "No se recibió: el enlace ya venció, fue usado o quedó revocado. Solicita otro a Dejavú.":
   "No se pudo registrar la cotización. "+error.message;
 }finally{button.disabled=false;}
};
init();
