/* Flujo externo: enlace individual opaco; nunca expone el expediente interno. */
import {clean,safeUrl,makeQuote} from "./reparaciones-model.mjs";
export const TOKEN_PATTERN=/^[A-Za-z0-9_-]{43}$/;
export const INVITE_STATUSES=["pending","submitted","revoked"];
export function createInviteToken(bytes){
 if(!(bytes instanceof Uint8Array)||bytes.length!==32)throw Error("Se requieren 32 bytes aleatorios seguros");
 return btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
}
export function publicRequestSnapshot(request){
 return {
  project:clean(request.project,120),
  asset:clean(request.asset,120),
  area:clean(request.area,120),
  problem:clean(request.problem,2000),
  scope:clean(request.scope,60),
  priority:clean(request.priority,10),
  dueDate:clean(request.dueDate,10),
  materialLink:safeUrl(request.materialLink)
 };
}
export function invitePayload(request,createdBy,supplierHint,createdAt,expiresAt){
 if(!request?.id||!createdBy)throw Error("Solicitud y responsable obligatorios");
 return {requestId:request.id,snapshot:publicRequestSnapshot(request),
  supplierHint:clean(supplierHint,160),createdBy,createdAt,expiresAt,
  updatedAt:createdAt,status:"pending",response:null,submittedAt:null};
}
export function supplierResponse(raw){
 const r={provider:clean(raw.provider,160),email:clean(raw.email,240),
  amount:Number(raw.amount),scope:clean(raw.scope,500),note:clean(raw.note,500),
  link:safeUrl(raw.link)};
 if(!r.provider||!r.scope)throw Error("Indica el proveedor y el trabajo que incluye");
 if(!Number.isFinite(r.amount)||r.amount<0||r.amount>99999999)throw Error("Importe MXN no válido");
 if(raw.link&&!r.link)throw Error("Enlace de cotización: solo se permite HTTPS");
 if(r.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email))throw Error("Correo de proveedor no válido");
 return r;
}
export function quoteFromInvite(invite,token,id){
 if(!TOKEN_PATTERN.test(token)||invite.status!=="submitted"||!invite.response)throw Error("No hay propuesta externa válida");
 const q=makeQuote(invite.response,id);
 return {...q,sourceInviteId:token};
}
export function supplierInviteUrl(base,token){
 if(!TOKEN_PATTERN.test(token))throw Error("Enlace externo inválido");
 const u=new URL("./reparacion-cotizar.html",base);
 u.searchParams.set("solicitud",token);return u.href;
}
