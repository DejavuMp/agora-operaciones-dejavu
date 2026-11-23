/** Alta privada del caso fotográfico HCB. Requiere una cuenta REAL de coordinación.
 * El ZIP se lee localmente; solo miniaturas JPEG <=90KB se envían a Firestore.
 * No publica originales en Pages, ni crea costes o autorizaciones de reparación.
 */
import {collection,doc,query,where,getDocsFromServer,serverTimestamp,runTransaction,getDocFromServer} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";
import {makeRequest} from "./reparaciones-model.mjs";
import {compressSparkPhoto,photoMarker,sparkPhotoPayload} from "./reparaciones-fotos-spark.mjs";
import {HCB_PROJECT,HCB_STAND,HCB_ASSETS} from "./hot-cruji-bravo-caso.mjs";
import {HCB_PHOTO_ASSETS,HCB_PHOTO_ISSUES,HCB_PHOTOS,hcbPhotoId,validateHcbManifest} from "./hot-cruji-bravo-fotos.mjs";
import {openPrivateZip} from "./hot-cruji-bravo-zip.mjs";
const ALL_ASSETS=[...HCB_ASSETS,...HCB_PHOTO_ASSETS];
const cleanKey=v=>String(v||"").trim().toLocaleLowerCase("es-MX");
const byId=(group,id)=>doc(group.db,group.coll,id);
async function createExtraAssets(db,user,progress){
 const snap=await getDocsFromServer(query(collection(db,"agora_repair_assets"),where("project","==",HCB_PROJECT)));
 const known=new Map(snap.docs.map(x=>[cleanKey(x.data().piece),x.id]));
 for(const asset of HCB_PHOTO_ASSETS){
  if(known.has(cleanKey(asset.piece)))continue;
  const ref=doc(db,"agora_repair_assets",asset.id);
  await runTransaction(db,async tx=>{
   const current=await tx.get(ref);
   if(current.exists())return;
   tx.set(ref,{id:asset.id,project:HCB_PROJECT,stand:HCB_STAND,piece:asset.piece,
    description:asset.code+" · "+asset.description,materialLink:"",
    condition:"Por revisar",photoPaths:[],
    createdBy:user.uid,createdAt:serverTimestamp(),updatedAt:serverTimestamp(),revision:1});
  });
  known.set(cleanKey(asset.piece),asset.id);
  progress("Inventario adicional: "+asset.piece);
 }
 const refresh=await getDocsFromServer(query(collection(db,"agora_repair_assets"),where("project","==",HCB_PROJECT)));
 const result=new Map(refresh.docs.map(x=>[cleanKey(x.data().piece),x.id]));
 for(const item of ALL_ASSETS)if(!result.has(cleanKey(item.piece)))throw Error("Falta la pieza de inventario: "+item.piece);
 return new Map(ALL_ASSETS.map(x=>[x.code,result.get(cleanKey(x.piece))]));
}
async function ensureRepairReports(db,user,assets,progress){
 const snap=await getDocsFromServer(query(collection(db,"agora_repair_requests"),where("project","==",HCB_PROJECT)));
 const existing=new Map(snap.docs.filter(x=>HCB_PHOTO_ISSUES.some(y=>cleanKey(y.area)===cleanKey(x.data().area)))
   .map(x=>[cleanKey(x.data().area),x.id]));
 const results=new Map();
 for(const issue of HCB_PHOTO_ISSUES){
  const prior=existing.get(cleanKey(issue.area));
  if(prior){results.set(issue.code,prior);continue;}
  const ref=doc(db,"agora_repair_requests",issue.id);
  await runTransaction(db,async tx=>{
   const exists=await tx.get(ref);
   if(exists.exists())return;
   const request=makeRequest({
    project:HCB_PROJECT,asset:HCB_STAND,assetId:assets.get(issue.assetCode)||"",
    scope:"Elemento específico",area:issue.area,
    cause:"Observación fotográfica · pendiente de validación física",
    problem:issue.problem,solutionMode:"instrucciones",
    instructions:issue.instructions,materialLink:"",
    priority:issue.priority,dueDate:""
   },user,issue.id,serverTimestamp());
   tx.set(ref,request);
   tx.set(doc(collection(db,"agora_repair_events")),{
    requestId:issue.id,actorUid:user.uid,actorEmail:user.email,
    action:"creada",detail:issue.code+" · Reporte basado en fotos; sin reparación autorizada.",
    createdAt:serverTimestamp()});
  });
  results.set(issue.code,issue.id);
  progress("Solicitud preparada: "+issue.code+" · "+issue.area);
 }
 return results;
}
async function attachPhoto(db,user,item,ownerId,file,progress){
 const dataUrl=await compressSparkPhoto(file);
 const id=hcbPhotoId(item.index),marker=photoMarker(id);
 const photoRef=doc(db,"agora_repair_photos",id);
 const isRequest=item.ownerType==="request";
 const ownerRef=doc(db,isRequest?"agora_repair_requests":"agora_repair_assets",ownerId);
 let uploaded=false;
 await runTransaction(db,async tx=>{
  const [owner,photo]=await Promise.all([tx.get(ownerRef),tx.get(photoRef)]);
  if(!owner.exists())throw Error("No existe el folio o pieza para foto "+item.index);
  const before=owner.data(),field=isRequest?"photos":"photoPaths";
  const old=Array.isArray(before[field])?before[field]:[];
  if(photo.exists()){
   const linked=old.some(x=>isRequest?x?.path===marker:x===marker);
   if(!linked)throw Error("La foto "+item.index+" existe sin asociación correcta. Revisión manual.");
   return;
  }
  if(old.length>=(isRequest?12:20))throw Error("Límite de evidencias en folio o pieza: "+item.index);
  const label=("HCB foto "+String(item.index).padStart(2,"0")+" · "+file.name).slice(0,120);
  const stage=isRequest?"antes":"inventario";
  const payload=sparkPhotoPayload({id,kind:isRequest?"request":"asset",ownerId,uploadedBy:user.uid,
   dataUrl,label,stage,createdAt:serverTimestamp()});
  const next=isRequest?[...old,{path:marker,label,stage}]:[...old,marker];
  tx.set(photoRef,payload);
  tx.update(ownerRef,{[field]:next,revision:before.revision+1,updatedAt:serverTimestamp()});
  if(isRequest)tx.set(doc(collection(db,"agora_repair_events")),{
    requestId:ownerId,actorUid:user.uid,actorEmail:user.email,
    action:"evidencia",detail:label,createdAt:serverTimestamp()
  });
  uploaded=true;
 });
 return uploaded;
}
export async function importHotCrujiPhotoCase({db,user,zipFile,registerBase,progress}){
 if(!db||!user?.uid||typeof progress!=="function"||typeof registerBase!=="function")throw Error("Acceso ÁGORA inválido");
 validateHcbManifest();
 progress("Abriendo el ZIP original en este navegador, sin subirlo a ningún servidor...");
 const files=await openPrivateZip(zipFile);
 const missing=HCB_PHOTOS.filter(x=>!files.has(x.name));
 if(missing.length)throw Error("El ZIP no contiene las 42 fotos correctas. Faltan: "+missing.slice(0,3).map(x=>x.name).join(", "));
 progress("42 fotos comprobadas. Leyendo fichas actuales para no crear duplicados...");
 await registerBase();
 const assets=await createExtraAssets(db,user,progress);
 const issues=await ensureRepairReports(db,user,assets,progress);
 let created=0,existing=0;
 for(const item of HCB_PHOTOS){
  const entry=files.get(item.name);
  const file=await entry.toFile();
  const ownerId=item.ownerType==="request"?issues.get(item.code):assets.get(item.assetCode);
  if(!ownerId)throw Error("No hay folio o pieza para "+item.name);
  const saved=await attachPhoto(db,user,item,ownerId,file,progress);
  if(saved)created++;else existing++;
  progress("Evidencias Hot Cruji Bravo: "+(created+existing)+"/42 · "+created+" nuevas · "+existing+" ya existentes");
 }
 const requests=HCB_PHOTO_ISSUES.map(x=>({code:x.code,id:issues.get(x.code),area:x.area,photos:x.numbers.length}));
 return {created,existing,total:HCB_PHOTOS.length,requests,assetCount:ALL_ASSETS.length,
  message:"Las fotos son miniaturas privadas; conserva siempre el ZIP con los originales."};
}
