import "../firebase-init.js";
import {clean,safeUrl,makeRequest,makeQuote,summary,encodeCsv,STATUSES,ROUTES} from "./reparaciones-model.mjs";
import {quoteFromInvite} from "./reparaciones-invitaciones-model.mjs";
import {mountInvitations} from "./reparaciones-invitaciones-ui.mjs";
import {compressSparkPhoto,photoRefId,photoMarker,sparkPhotoPayload} from "./reparaciones-fotos-spark.mjs";
import {HCB_PROJECT,HCB_STAND,HCB_CASE,HCB_ASSETS,HCB_INSPECTIONS,hcbAssetById,hcbImportPlan} from "./hot-cruji-bravo-caso.mjs";
import {GoogleAuthProvider,onAuthStateChanged,signInWithPopup,signInWithRedirect,signOut} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import {collection,doc,query,where,limit,onSnapshot,getDocFromServer,getDocsFromServer,serverTimestamp,writeBatch,runTransaction} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";
// Plan Spark: fotos comprimidas en documentos privados de Firestore. Sin Storage.
const fb=window.AGORA_FIREBASE,auth=fb?.auth,db=fb?.firestore;
const $=id=>document.getElementById(id),esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const COLL="agora_repair_requests",EVENTS="agora_repair_events";
let currentUser=null,coordinator=false,rows=[],ownedRows=[],assignedRows=[],staffMembers=[],assets=[],selected="",selectedAsset="",unsub=null,unsubAssigned=null,unsubMembers=null,unsubEvents=null,unsubAssets=null,unsubInvites=null,session=0;
function feedback(message,error=false){$("message").textContent=message;$("message").className=error?"error":"ok";}
function gate(text,canLogin=true){$("workspace").hidden=true;$("gate").hidden=false;$("gateText").textContent=text;$("login").hidden=!canLogin;}
const requestRef=id=>doc(db,COLL,id),logRef=()=>doc(collection(db,EVENTS));
const link=id=>{const u=new URL("./reparaciones.html",location.href);u.searchParams.set("solicitud",id);return u.href;};
function reset(){session++;if(unsub){unsub();unsub=null;}if(unsubEvents){unsubEvents();unsubEvents=null;}if(unsubAssets){unsubAssets();unsubAssets=null;}if(unsubInvites){unsubInvites();unsubInvites=null;}if(unsubAssigned){unsubAssigned();unsubAssigned=null;}if(unsubMembers){unsubMembers();unsubMembers=null;}rows=[];ownedRows=[];assignedRows=[];staffMembers=[];assets=[];selected="";selectedAsset="";currentUser=null;coordinator=false;$("detail").textContent="";$("records").textContent="";}
async function start(user){
 reset();if(!user){gate("Inicia sesión con tu cuenta vinculada a ÁGORA.");return;}
 if(!user.emailVerified){gate("Verifica tu correo de Google antes de ingresar.",false);return;}
 const token=++session;
 try{
  const [u,m]=await Promise.all([
   getDocFromServer(doc(db,"agora_users",user.uid)),
   getDocFromServer(doc(db,"agora_ops_members",user.uid))
  ]);
  if(token!==session)return;
  const internal=u.exists()&&u.data().active===true&&["admin","coordinador"].includes(u.data().role);
  const staff=m.exists()&&m.data().active===true&&m.data().role==="staff";
  if(!internal&&!staff){gate("Tu cuenta no tiene acceso activo a Operaciones. Solicita vinculación a coordinación.",false);return;}
  currentUser={uid:user.uid,email:user.email||"",name:user.displayName||user.email||"Usuario"};
  coordinator=internal;
  $("who").textContent=currentUser.name+" · "+(coordinator?"Coordinación":"Staff");
  document.querySelectorAll("[data-coord]").forEach(el=>el.hidden=!coordinator);
  $("gate").hidden=true;$("workspace").hidden=false;
  listenCatalog(token);
  if(coordinator)listenMembers(token);
  else unsubAssigned=onSnapshot(query(collection(db,COLL),where("assignedUid","==",user.uid),limit(150)),s=>{
   if(token!==session||s.metadata.fromCache)return;
   assignedRows=s.docs.map(d=>({...d.data(),id:d.id}));refreshRequests();
  },e=>feedback("No se cargaron tus reparaciones asignadas: "+e.message,true));
  const q=coordinator?query(collection(db,COLL),limit(150)):query(collection(db,COLL),where("createdBy","==",user.uid),limit(150));
  unsub=onSnapshot(q,{includeMetadataChanges:true},s=>{
   if(token!==session)return;
   if(s.metadata.fromCache){feedback("Sincronizando datos con Firebase…");return;}
   ownedRows=s.docs.map(d=>({...d.data(),id:d.id}));refreshRequests();
  },e=>{gate("No se pueden consultar las solicitudes: "+(e.message||e)+". Revisa las reglas Firestore.",true);feedback("Lectura denegada o sin conexión.",true);});
 }catch(e){if(token===session){gate("No se pudo validar tu cuenta: "+(e.message||e),false);feedback("No se otorgó acceso sin verificar permisos.",true);}}
}
$("login").onclick=async()=>{try{await signInWithPopup(auth,new GoogleAuthProvider());}catch(e){if(e.code==="auth/popup-blocked")await signInWithRedirect(auth,new GoogleAuthProvider());else feedback(e.message,true);}};
$("logout").onclick=()=>signOut(auth);
if(auth&&db)onAuthStateChanged(auth,start,e=>gate("Error de autenticación: "+e.message,false));
else gate("Firebase no está disponible. No se permite guardar localmente.",false);
const form=$("requestForm");
form.onsubmit=async e=>{
 e.preventDefault();if(!currentUser)return feedback("Debes iniciar sesión.",true);
 const btn=$("submitRequest");btn.disabled=true;
 try{
  const id=crypto.randomUUID(),raw=Object.fromEntries(new FormData(form).entries());
  const item=makeRequest(raw,currentUser,id,serverTimestamp());
  const batch=writeBatch(db);
  batch.set(requestRef(id),item);
  batch.set(logRef(),{requestId:id,actorUid:currentUser.uid,actorEmail:currentUser.email,action:"creada",detail:"Nueva solicitud",createdAt:serverTimestamp()});
  await batch.commit();form.reset();select(id);feedback("Solicitud guardada. Folio: "+id+". Ahora puedes subir las fotos.");
 }catch(ex){feedback("No se pudo guardar en Firebase: "+ex.message,true);}finally{btn.disabled=false;}
};
function renderList(){
 const term=$("filter").value.trim().toLowerCase();
 const status=$("statusFilter").value;
 const filtered=rows.filter(r=>[r.id,r.project,r.asset,r.area,r.status].join(" ").toLowerCase().includes(term)&&(!status||r.status===status));
 const pending=rows.filter(r=>["pendiente","revision","cotizando"].includes(r.status)).length;
 const working=rows.filter(r=>["autorizado","reparacion"].includes(r.status)).length;
 const done=rows.filter(r=>["terminado","entregado"].includes(r.status)).length;
 $("repairMetrics").textContent=pending+" por decidir o cotizar · "+working+" en proceso · "+done+" terminadas o entregadas";
 $("records").innerHTML=filtered.map(r=>`<button class="record ${r.id===selected?"selected":""}" data-record="${esc(r.id)}">
  <b>${esc(r.asset)} · ${esc(r.area)}</b><span class="status">${esc(r.status)}</span>
  <small>${esc(r.project)} · ${esc(r.priority)} · Folio ${esc(r.id.slice(0,8))}</small></button>`).join("")||'<p class="muted">No hay solicitudes con este filtro.</p>';
 $("records").querySelectorAll("[data-record]").forEach(b=>b.onclick=()=>select(b.dataset.record));
}
function refreshRequests(){
 const merged=new Map([...ownedRows,...assignedRows].map(r=>[r.id,r]));
 rows=[...merged.values()].sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
 $("total").textContent="("+rows.length+")";
 renderList();
 if(selected)renderDetail(selected);
 else if(new URLSearchParams(location.search).get("solicitud"))select(new URLSearchParams(location.search).get("solicitud"));
}
function listenMembers(token){
 unsubMembers=onSnapshot(query(collection(db,"agora_ops_members"),limit(300)),s=>{
  if(token!==session)return;
  staffMembers=s.docs.map(x=>({...x.data(),uid:x.id})).filter(x=>x.active&&x.role==="staff")
   .sort((a,b)=>(a.email||"").localeCompare(b.email||""));
  if(selected)renderDetail(selected);
 },e=>feedback("No se pudo cargar el catálogo de personal: "+e.message,true));
}
$("filter").oninput=renderList;
$("statusFilter").onchange=renderList;
function select(id){
 selected=id;const u=new URL(location.href);u.searchParams.set("solicitud",id);history.replaceState({}, "",u.href);
 renderList();renderDetail(id);
 if(!rows.some(x=>x.id===id) && /^[a-f0-9-]{36}$/.test(id)){
  getDocFromServer(requestRef(id)).then(snap=>{
   if(selected!==id||!snap.exists())return;
   rows=[...rows.filter(x=>x.id!==id),{...snap.data(),id}];
   renderList();renderDetail(id);
  }).catch(()=>feedback("Este folio no está disponible para tu cuenta.",true));
 }
}
function qr(){
 const el=$("qr");if(!el)return;el.replaceChildren();const url=link(selected);
 if(window.QRCode)new window.QRCode(el,{text:url,width:128,height:128,colorDark:"#17191d",colorLight:"#ffffff",correctLevel:window.QRCode.CorrectLevel.M});
 else el.textContent="Copia el enlace privado (QR temporalmente no disponible).";
}
function detailRow(name,value){return `<dt>${esc(name)}</dt><dd>${esc(value||"—")}</dd>`;}
async function getSparkPhoto(path){
 const id=photoRefId(path);
 if(!id)throw Error("Esta fotografía antigua pertenece a Storage, que no está habilitado");
 const snap=await getDocFromServer(doc(db,"agora_repair_photos",id));
 if(!snap.exists())throw Error("No hay foto registrada o no tienes permiso para consultarla");
 return snap.data().dataUrl;
}
async function renderPhotos(record){
 const parent=$("photos");if(!parent)return;
 parent.textContent="Cargando fotografías privadas...";
 if(!record.photos?.length){parent.textContent="Sin fotografías todavía.";return;}
 parent.replaceChildren();
 for(const item of record.photos.slice(0,12)){
  const img=document.createElement("img"),anchor=document.createElement("a");
  img.alt=item.label||"Evidencia de reparación";img.loading="lazy";
  anchor.rel="noopener noreferrer";anchor.target="_blank";anchor.append(img);parent.append(anchor);
  try{
   const data=await getSparkPhoto(item.path);
   if(selected!==record.id)return;
   img.src=data;anchor.href=data;anchor.download=(item.label||"evidencia")+".jpg";
  }catch(_){anchor.replaceWith(document.createTextNode("Foto no disponible · "));}
 }
}
function renderDetail(id){
 if(unsubInvites){unsubInvites();unsubInvites=null;}
 const r=rows.find(x=>x.id===id);if(!r){$("detail").innerHTML='<p class="muted">El folio todavía no se encuentra en tus solicitudes o no tienes permiso para verlo.</p>';return;}
 const quotes=(r.quotes||[]).map(q=>`<div class="quote ${q.id===r.selectedQuoteId?"selected":""}"><strong>${esc(q.provider)} · $${Number(q.amount).toFixed(2)} MXN</strong>
 <p>${esc(q.scope||"Sin alcance")} · ${esc(q.note||"")}</p>
 ${safeUrl(q.link)?`<a href="${esc(safeUrl(q.link))}" rel="noopener noreferrer" target="_blank">Ver cotización</a>`:""}
 ${coordinator?`<button data-pick="${esc(q.id)}" type="button">${q.id===r.selectedQuoteId?"Seleccionada":"Elegir cotización"}</button>`:""}</div>`).join("")||'<p class="muted">Aún no hay cotizaciones registradas.</p>';
 $("detail").innerHTML=`<div class="detail-head"><div><h2>${esc(r.asset)} · ${esc(r.area)}</h2><p class="muted">Folio completo: ${esc(r.id)}</p></div><span class="status">${esc(r.status)}</span></div>
 <dl>${detailRow("Proyecto",r.project)}${detailRow("Problema",r.problem)}${detailRow("Motivo",r.cause)}${detailRow("Instrucciones",r.solutionMode==="propuesta"?"Solicitar propuesta":r.instructions)}
 ${detailRow("Requerido",r.dueDate)}${detailRow("Prioridad",r.priority)}${detailRow("Reportó",r.createdByName)}
 ${detailRow("Ruta",r.repairRoute)}${detailRow("Responsable",r.assignedTo)}${detailRow("Coordinación",r.decisionBy)}${detailRow("Notas",r.decisionNote)}</dl>
 ${safeUrl(r.materialLink)?`<p><a href="${esc(safeUrl(r.materialLink))}" target="_blank" rel="noopener noreferrer">Abrir materiales / planos</a></p>`:""}
 <div class="actions"><button id="copy">Copiar ficha</button><button id="email">Correo</button><button id="whatsapp">WhatsApp</button><button id="pdf">PDF</button><button id="png">Imagen PNG</button><button id="copyLink">Copiar enlace</button></div>
 <div class="two" style="align-items:start"><div><h3 style="font-size:14px">Enlace y QR privado</h3><div id="qr"></div><p class="form-help">Requiere una cuenta con permisos para abrir el expediente. No compartir con acceso anónimo.</p></div>
 <div><h3 style="font-size:14px">Evidencias</h3><div id="photos" class="photos"></div><label>Adjuntar fotografías JPEG/PNG<input id="photoFiles" type="file" multiple accept="image/*"></label><label>Tipo de evidencia<select id="photoStage"><option value="antes">Antes</option><option value="avance">Durante</option><option value="despues">Después</option></select></label><button id="uploadPhotos">Guardar fotografías</button><p class="form-help">Máximo 12 evidencias por folio. Vista previa JPEG comprimida, menor a 90 KB. Conserva el original en Drive.</p></div></div>
 ${!coordinator?`<hr><h3 style="font-size:15px">Registrar avance del arreglo</h3>
 <form id="progressForm"><label>¿Qué se hizo o qué falta?<textarea name="detail" minlength="3" maxlength="500" required placeholder="Ej. Se reparó la estructura y se anexaron fotos del resultado"></textarea></label>
 <button type="submit" class="primary">Guardar avance</button></form>
 <h3 style="font-size:14px">Mis movimientos</h3><ul id="history"><li>Cargando...</li></ul>`:""}
 <hr><h3 style="font-size:15px">Cotizaciones</h3>${coordinator?quotes:'<p class="muted">Las cotizaciones y los importes los revisa coordinación.</p>'}
 ${coordinator?`<section id="supplierInvites" style="margin-top:20px"></section><hr>`:""}
 ${coordinator?`<form id="quoteForm"><h3 style="font-size:13px">Agregar cotización</h3><div class="two"><label>Proveedor<input name="provider" maxlength="160" required></label><label>Importe MXN<input type="number" min="0" max="99999999" step=".01" name="amount" required></label></div><label>Alcance / trabajo<input name="scope" maxlength="500"></label><label>Enlace HTTPS de cotización<input name="link" type="url"></label><label>Observaciones<input name="note" maxlength="500"></label><button type="submit">Guardar propuesta</button></form>
 <hr><form id="decisionForm"><h3 style="font-size:15px">Decisión de coordinación</h3>
 <div class="two"><label>Quién lo resolverá<select name="repairRoute">${ROUTES.map(v=>`<option value="${v}" ${v===r.repairRoute?"selected":""}>${esc(({pendiente:"Pendiente",staff:"Staff",agencia:"Coordinación / agencia",proveedor:"Proveedor existente",nuevo:"Proveedor nuevo",cotizar:"Solicitar cotización",comparar:"Comparar cotizaciones"})[v])}</option>`).join("")}</select></label>
 <label>Estado<select name="status">${STATUSES.map(v=>`<option value="${v}" ${v===r.status?"selected":""}>${esc(v)}</option>`).join("")}</select></label></div>
 <label>Responsable / empresa<input name="assignedTo" maxlength="160" value="${esc(r.assignedTo)}"></label>
 <label>Cuenta ÁGORA del staff asignado<select name="assignedUid">
 <option value="">Sin cuenta asignada / proveedor externo</option>
 ${staffMembers.map(m=>`<option value="${esc(m.uid)}" ${m.uid===r.assignedUid?"selected":""}>${esc(m.email||m.personId||m.uid)}</option>`).join("")}
 </select></label>
 <label>Costo estimado MXN<input name="estimatedCost" type="number" min="0" step=".01" max="99999999" value="${Number(r.estimatedCost||0)}"></label>
 <label>Observaciones / justificación<textarea name="decisionNote" maxlength="2000">${esc(r.decisionNote)}</textarea></label>
 <button type="submit" class="primary">Guardar decisión y seguimiento</button></form>
 <hr><h3 style="font-size:14px">Historial de movimientos</h3><ul id="history"><li>Cargando historial...</li></ul>`:""}`;
 qr();renderPhotos(r);
 $("copy").onclick=()=>copy(summary(r,link(r.id)));
 $("copyLink").onclick=()=>copy(link(r.id));
 $("email").onclick=()=>{location.href="mailto:?subject="+encodeURIComponent("ÁGORA · Reparación "+r.asset+" · "+r.id.slice(0,8))+"&body="+encodeURIComponent(summary(r,link(r.id)).slice(0,4500));};
 $("whatsapp").onclick=()=>window.open("https://wa.me/?text="+encodeURIComponent(summary(r,link(r.id)).slice(0,3500)),"_blank","noopener,noreferrer");
 $("pdf").onclick=()=>makePdf(r);
 $("png").onclick=()=>makePng(r);
 $("uploadPhotos").onclick=()=>uploadPhotos(r);
 if(!coordinator){
  $("progressForm").onsubmit=e=>{e.preventDefault();saveProgress(r,e.target);};
  loadHistory(r);return;
 }
 unsubInvites=mountInvitations($("supplierInvites"),{db,request:r,user:currentUser,notice:feedback,alreadyImported:token=>(r.quotes||[]).some(q=>q.sourceInviteId===token),importProposal:invite=>importExternalQuote(r,invite)});
 $("decisionForm").onsubmit=e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target).entries());saveDecision(r,f);};
 $("quoteForm").onsubmit=e=>{e.preventDefault();addQuote(r,Object.fromEntries(new FormData(e.target).entries()));};
 document.querySelectorAll("[data-pick]").forEach(b=>b.onclick=()=>chooseQuote(r,b.dataset.pick));
 loadHistory(r);
}
function copy(value){if(navigator.clipboard&&isSecureContext)navigator.clipboard.writeText(value).then(()=>feedback("Copiado."),()=>feedback("No se pudo copiar.",true));else prompt("Copia el texto:",value);}
async function update(id,action,detail,mutate){
 if(!currentUser||!coordinator)throw Error("Solo coordinación puede tomar decisiones");
 return runTransaction(db,async tx=>{
  const snap=await tx.get(requestRef(id));if(!snap.exists())throw Error("El folio ya no existe");
  const old=snap.data(),data=mutate(old);
  tx.update(requestRef(id),{...data,revision:old.revision+1,updatedAt:serverTimestamp()});
  tx.set(logRef(),{requestId:id,actorUid:currentUser.uid,actorEmail:currentUser.email,action,detail:clean(detail,500),createdAt:serverTimestamp()});
 });
}
async function saveProgress(r,form){
 if(!currentUser||coordinator)return feedback("Acceso no autorizado.",true);
 const detail=clean(form.elements.detail.value,500);
 if(detail.length<3)return feedback("Describe el avance realizado.",true);
 const button=form.querySelector("[type=submit]");button.disabled=true;
 try{
  const batch=writeBatch(db);
  batch.set(logRef(),{requestId:r.id,actorUid:currentUser.uid,
   actorEmail:currentUser.email,action:"avance",detail,createdAt:serverTimestamp()});
  await batch.commit();form.reset();feedback("Avance guardado y disponible para coordinación.");
 }catch(e){feedback("No se guardó el avance: "+e.message,true)}
 finally{button.disabled=false}
}
async function saveDecision(r,f){
 try{
  if(!ROUTES.includes(f.repairRoute)||!STATUSES.includes(f.status))throw Error("Estado o ruta no válida");
  const cost=Number(f.estimatedCost);if(!Number.isFinite(cost)||cost<0||cost>99999999)throw Error("Costo inválido");
  await update(r.id,"decisión","Ruta "+f.repairRoute+" / Estado "+f.status,()=>({
   repairRoute:f.repairRoute,status:f.status,assignedTo:clean(f.assignedTo,160),
   decisionNote:clean(f.decisionNote,2000),estimatedCost:cost,assignedUid:clean(f.assignedUid,128),decisionBy:currentUser.name
  }));feedback("Decisión registrada en Firebase.");
 }catch(e){feedback("No se guardó la decisión: "+e.message,true);}
}
async function addQuote(r,data){
 try{
  const q=makeQuote(data,crypto.randomUUID());
  await update(r.id,"cotización","Propuesta de "+q.provider,old=>{
   if((old.quotes||[]).length>=8)throw Error("Máximo 8 cotizaciones por solicitud");
   return {quotes:[...(old.quotes||[]),q],status:old.status==="pendiente"?"cotizando":old.status};
  });feedback("Cotización registrada.");
 }catch(e){feedback("No se guardó la propuesta: "+e.message,true);}
}
async function importExternalQuote(r,invite){
 if(!coordinator||!currentUser)throw Error("No tienes acceso de coordinación");
 await runTransaction(db,async tx=>{
  const inviteSnap=await tx.get(doc(db,"agora_repair_invites",invite.id));
  const requestSnap=await tx.get(requestRef(r.id));
  if(!inviteSnap.exists()||!requestSnap.exists())throw Error("La invitación o el folio ya no existen");
  const source=inviteSnap.data(),old=requestSnap.data();
  if(source.requestId!==r.id||source.status!=="submitted")throw Error("La propuesta no está disponible");
  if((old.quotes||[]).some(q=>q.sourceInviteId===invite.id))throw Error("La propuesta ya está integrada");
  if((old.quotes||[]).length>=8)throw Error("Límite de 8 cotizaciones por solicitud");
  const quote=quoteFromInvite(source,invite.id,crypto.randomUUID());
  tx.update(requestRef(r.id),{
   quotes:[...(old.quotes||[]),quote],status:old.status==="pendiente"?"cotizando":old.status,
   revision:old.revision+1,updatedAt:serverTimestamp()
  });
  tx.set(logRef(),{requestId:r.id,actorUid:currentUser.uid,actorEmail:currentUser.email,
   action:"cotización externa",detail:"Propuesta recibida de "+quote.provider,createdAt:serverTimestamp()});
 });
}
async function chooseQuote(r,id){
 try{await update(r.id,"selección de cotización","Propuesta seleccionada",old=>{
  const q=(old.quotes||[]).find(x=>x.id===id);if(!q)throw Error("Cotización no encontrada");
  return {selectedQuoteId:id,estimatedCost:q.amount,repairRoute:"proveedor",assignedTo:q.provider,decisionBy:currentUser.name,status:"revision"};
 });feedback("Propuesta seleccionada para revisión.");}catch(e){feedback(e.message,true);}
}
async function uploadPhotos(r){
 const files=[...($("photoFiles")?.files||[])];
 if(!files.length)return feedback("Selecciona fotografías.",true);
 if(files.length+(r.photos||[]).length>12)return feedback("Máximo 12 fotografías por reparación.",true);
 const button=$("uploadPhotos");button.disabled=true;
 try{
  for(const file of files){
   const dataUrl=await compressSparkPhoto(file);
   const photoId=crypto.randomUUID(),path=photoMarker(photoId);
   const stage=$("photoStage")?.value||"avance",label=clean(file.name,120);
   const image=sparkPhotoPayload({id:photoId,kind:"request",ownerId:r.id,
    uploadedBy:currentUser.uid,dataUrl,label,stage,createdAt:serverTimestamp()});
   await runTransaction(db,async tx=>{
    const snap=await tx.get(requestRef(r.id));if(!snap.exists())throw Error("Folio no encontrado");
    const old=snap.data(),photos=[...(old.photos||[])];
    if(photos.length>=12)throw Error("Límite de evidencias alcanzado");
    photos.push({path,label,stage});
    tx.set(doc(db,"agora_repair_photos",photoId),image);
    tx.update(requestRef(r.id),{photos,revision:old.revision+1,updatedAt:serverTimestamp()});
    tx.set(logRef(),{requestId:r.id,actorUid:currentUser.uid,actorEmail:currentUser.email,
      action:"evidencia",detail:label,createdAt:serverTimestamp()});
   });
  }
  feedback("Evidencias comprimidas y guardadas en Firestore, sin facturación de Storage.");
 }catch(e){feedback("No se guardó la evidencia: "+e.message,true)}
 finally{button.disabled=false;}
}
async function loadHistory(r){
 if(unsubEvents){unsubEvents();unsubEvents=null;}
 const q=coordinator?query(collection(db,EVENTS),where("requestId","==",r.id),limit(100)):
   query(collection(db,EVENTS),where("actorUid","==",currentUser.uid),limit(150));
 unsubEvents=onSnapshot(q,snap=>{
  if(selected!==r.id)return;
  const el=$("history");if(!el)return;
  const log=snap.docs.map(d=>d.data()).filter(x=>x.requestId===r.id).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
  el.innerHTML=log.map(x=>`<li>${esc(x.createdAt?.toDate?.().toLocaleString("es-MX")||"Guardado")} · ${esc(x.action)} · ${esc(x.actorEmail)} · ${esc(x.detail)}</li>`).join("")||"<li>Sin movimientos registrados</li>";
 },()=>{const el=$("history");if(el)el.textContent="Historial no disponible hasta activar las reglas.";});
}
function blobDownload(blob,file){const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=file;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);}
function qrCanvas(){return $("qr")?.querySelector("canvas")||null;}
function makePdf(r){
 const lib=window.jspdf?.jsPDF;if(!lib){feedback("No se cargó el generador PDF; usa Imprimir del navegador.",true);window.print();return;}
 try{const p=new lib({unit:"mm",format:"a4"}),txt=summary(r,link(r.id)),lines=p.splitTextToSize(txt,175);let y=22;
 p.setFontSize(13);p.setFont("helvetica","bold");p.text("DEJAVÚ · SOLICITUD DE REPARACIÓN",18,y);p.setFont("helvetica","normal");p.setFontSize(9);y+=12;
 for(const line of lines){if(y>270){p.addPage();y=20;}p.text(line,18,y);y+=5;}
 if(y>220){p.addPage();y=20;}
 p.setFillColor(24,27,32);p.roundedRect(18,y+3,92,11,2,2,"F");
 p.setTextColor(255,255,255);p.setFontSize(10);
 p.textWithLink("ABRIR SOLICITUD PRIVADA",22,y+10,{url:link(r.id)});
 p.setTextColor(32,35,40);
 const qr=qrCanvas();if(qr)p.addImage(qr.toDataURL("image/png"),"PNG",18,y+18,29,29);
 p.save("agora-reparacion-"+r.id.slice(0,8)+".pdf");
 }catch(e){feedback("No se pudo generar PDF: "+e.message,true);}
}
function makePng(r){
 try{
  const lines=[],w=1100,pad=48;const tmp=document.createElement("canvas").getContext("2d");tmp.font="23px Arial";
  for(const text of summary(r,link(r.id)).split("\n")){let line="";
   for(const word of text.split(" ")){const test=line?line+" "+word:word;if(line&&tmp.measureText(test).width>w-2*pad){lines.push(line);line=word;}else line=test;}
   lines.push(line);
  }
  const height=Math.max(640,160+lines.length*34+145),c=document.createElement("canvas");c.width=w;c.height=height;
  const x=c.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,w,height);x.fillStyle="#17191d";x.fillRect(0,0,w,16);
  x.fillStyle="#202329";x.font="bold 29px Arial";x.fillText("ÁGORA · REPARACIONES",pad,75);x.font="23px Arial";
  lines.forEach((line,i)=>x.fillText(line,pad,124+i*34));
  const qr=qrCanvas();if(qr)x.drawImage(qr,pad,height-135,110,110);
  c.toBlob(b=>b?blobDownload(b,"agora-reparacion-"+r.id.slice(0,8)+".png"):feedback("No se pudo crear PNG.",true),"image/png");
 }catch(e){feedback("Error al crear PNG: "+e.message,true);}
}
$("csv").onclick=()=>blobDownload(new Blob([encodeCsv(rows)],{type:"text/csv;charset=utf-8"}),"agora-reparaciones.csv");

/* Catálogo de activos: fotografías persistentes vinculadas a cada pieza, sin duplicar módulos. */
function listenCatalog(token){
 unsubAssets=onSnapshot(query(collection(db,"agora_repair_assets"),limit(300)),snap=>{
  if(token!==session)return;assets=snap.docs.map(d=>({...d.data(),id:d.id})).sort((a,b)=>a.project.localeCompare(b.project));renderCatalog();
 },e=>feedback("No se pudo cargar inventario: "+e.message,true));
}
function renderCatalog(){
 $("assetTotal").textContent="("+assets.length+")";
 const picker=$("assetPicker"),before=picker.value;
 picker.replaceChildren(new Option("Seleccionar / reportar sin catálogo",""));
 for(const a of assets)picker.add(new Option(a.project+" · "+a.stand+" / "+a.piece,a.id));
 picker.value=assets.some(a=>a.id===before)?before:"";
 const box=$("assetCards");box.replaceChildren();
 if(!assets.length){box.textContent="No hay piezas inventariadas todavía.";return;}
 const term=$("assetSearch").value.trim().toLowerCase();
 const filtered=assets.filter(a=>[a.project,a.stand,a.piece,a.description].join(" ").toLowerCase().includes(term));
 for(const a of filtered.slice(0,30)){
  const btn=document.createElement("button");
  btn.className=a.id===selectedAsset?"primary":"";
  btn.textContent=a.stand+" · "+a.piece+" ("+a.condition+")";
  btn.title=a.project;btn.onclick=()=>showAsset(a.id);
  box.append(btn);
 }
 if(filtered.length>30){const p=document.createElement("p");p.className="muted";p.textContent="Mostrando 30 de "+filtered.length+" piezas. Usa el buscador para acotar.";box.append(p);}
 if(selectedAsset)showAsset(selectedAsset);
}

function renderHotCrujiPreview(){
 const target=$("hcbPreview"),names=document.createElement("p"),list=document.createElement("ol");
 names.textContent=HCB_CASE.overall+". Huella final por verificar. Sin fotos cargadas.";
 for(const a of HCB_ASSETS){
  const li=document.createElement("li");li.textContent=a.code+" · "+a.piece+" — "+a.description;list.append(li);
 }
 const heading=document.createElement("p");heading.textContent="Inspecciones por realizar, sin diagnóstico de daños:";
 const tasks=document.createElement("ul");
 for(const q of HCB_INSPECTIONS){const li=document.createElement("li");li.textContent=q.code+" · "+q.area;tasks.append(li);}
 target.replaceChildren(names,list,heading,tasks);
}
renderHotCrujiPreview();
function hcbAssetDoc(a){
 return {id:a.id,project:HCB_PROJECT,stand:HCB_STAND,piece:a.piece,
  description:a.code+" · "+a.description,materialLink:"",
  condition:"Por revisar",photoPaths:[],createdBy:currentUser.uid,
  createdAt:serverTimestamp(),updatedAt:serverTimestamp(),revision:1};
}
async function registerHotCrujiCase(){
 if(!coordinator||!currentUser)throw Error("Solo coordinación puede registrar el expediente");
 // Leer desde servidor antes de cada alta: jamás sobrescribir piezas del equipo.
 const [assetSnapshot,requestSnapshot]=await Promise.all([
  getDocsFromServer(query(collection(db,"agora_repair_assets"),where("project","==",HCB_PROJECT))),
  getDocsFromServer(query(collection(db,COLL),where("project","==",HCB_PROJECT)))
 ]);
 const foundAssets=assetSnapshot.docs.map(d=>({...d.data(),id:d.id}));
 const foundRequests=requestSnapshot.docs.map(d=>({...d.data(),id:d.id}));
 const duplicates=new Set(foundAssets.map(x=>x.id));
 const byPiece=new Map(foundAssets.map(x=>[String(x.piece||"").trim().toLowerCase(),x.id]));
 const existingRequests=new Set(foundRequests.map(x=>x.id));
 const alreadyInspected=new Set(foundRequests
  .filter(x=>x.cause==="Inspección inicial de inventario · sin daño confirmado").map(x=>x.area));
 const plan=hcbImportPlan([...duplicates], [...existingRequests]);
 const toCreate=plan.assets.filter(x=>!byPiece.has(x.piece.trim().toLowerCase()));
 const inspections=plan.inspections.filter(x=>!alreadyInspected.has(x.area));
 if(!toCreate.length&&!inspections.length){
  $("hcbImportStatus").textContent="El caso ya está registrado. Se conservaron todas las piezas y revisiones existentes.";
  $("assetSearch").value=HCB_PROJECT;renderCatalog();
  return;
 }
 if(toCreate.length){
  const batch=writeBatch(db);
  for(const a of toCreate)batch.set(doc(db,"agora_repair_assets",a.id),hcbAssetDoc(a));
  await batch.commit();
 }
 if(inspections.length){
  const batch=writeBatch(db);
  for(const task of inspections){
   const related=hcbAssetById(task.assetId);
   const actualAssetId=related?(byPiece.get(related.piece.trim().toLowerCase())||related.id):"";
   const request=makeRequest({
    project:HCB_PROJECT,asset:HCB_STAND,assetId:actualAssetId,
    scope:"Elemento específico",area:task.area,
    cause:"Inspección inicial de inventario · sin daño confirmado",
    problem:task.problem,solutionMode:"propuesta",instructions:task.instructions,
    materialLink:"",priority:task.priority,dueDate:""
   },currentUser,task.id,serverTimestamp());
   batch.set(requestRef(task.id),request);
   batch.set(logRef(),{requestId:task.id,actorUid:currentUser.uid,
     actorEmail:currentUser.email,action:"creada",
     detail:task.code+" · Revisión documental inicial; daños sin confirmar",
     createdAt:serverTimestamp()});
  }
  await batch.commit();
 }
 $("assetSearch").value=HCB_PROJECT;renderCatalog();
 $("hcbImportStatus").textContent="Expediente registrado: "+toCreate.length+
  " piezas nuevas y "+inspections.length+" inspecciones nuevas. No se duplicaron piezas existentes. Fotografías originales: 0 de 42 cargadas.";
 feedback("Hot Cruji Bravo preparado en Firestore. Revisa cada pieza y adjunta evidencia real.");
}
$("hcbImport").onclick=async()=>{
 const button=$("hcbImport");
 button.disabled=true;
 $("hcbImportStatus").textContent="Consultando el inventario existente y registrando solo los elementos faltantes...";
 try{await registerHotCrujiCase();}
 catch(error){
  $("hcbImportStatus").textContent="No se completó el registro: "+error.message+
   ". Reintentar es seguro: los registros ya creados se conservan.";
  feedback("No se pudo completar Hot Cruji Bravo: "+error.message,true);
 }finally{button.disabled=false;}
};

$("assetSearch").oninput=renderCatalog;
$("assetPicker").onchange=()=>{
 const a=assets.find(x=>x.id===$("assetPicker").value);if(!a)return;
 form.elements.project.value=a.project;form.elements.asset.value=a.stand;form.elements.area.value=a.piece;
 if(a.materialLink)form.elements.materialLink.value=a.materialLink;
};
$("assetForm").onsubmit=async e=>{
 e.preventDefault();if(!coordinator)return feedback("Solo coordinación puede registrar activos.",true);
 const btn=e.target.querySelector("button[type=submit]");btn.disabled=true;
 try{
  const data=Object.fromEntries(new FormData(e.target).entries());
  if(data.materialLink&&!safeUrl(data.materialLink))throw Error("El enlace debe ser HTTPS");
  const id=crypto.randomUUID();
  const item={id,project:clean(data.project,120),stand:clean(data.stand,120),piece:clean(data.piece,120),
   description:clean(data.description,800),materialLink:safeUrl(data.materialLink),
   condition:data.condition||"Por revisar",photoPaths:[],createdBy:currentUser.uid,
   createdAt:serverTimestamp(),updatedAt:serverTimestamp(),revision:1};
  if(!item.project||!item.stand||!item.piece)throw Error("Completa proyecto, stand y pieza");
  const batch=writeBatch(db);batch.set(doc(db,"agora_repair_assets",id),item);await batch.commit();
  e.target.reset();selectedAsset=id;feedback("Pieza creada. Ahora puedes adjuntar sus fotos.");
 }catch(err){feedback("No se guardó el inventario: "+err.message,true);}finally{btn.disabled=false;}
};
async function showAsset(id){
 const a=assets.find(x=>x.id===id);if(!a)return;
 selectedAsset=id;document.querySelectorAll("#assetCards button").forEach(b=>b.className=b.textContent===a.stand+" · "+a.piece+" ("+a.condition+")"?"primary":"");
 const panel=$("inventoryDetail");
 panel.innerHTML=`<hr><h3 style="font-size:14px">${esc(a.project)} · ${esc(a.stand)} · ${esc(a.piece)}</h3>
 <p>${esc(a.description||"Sin descripción")} · Estado: ${esc(a.condition)}</p>
 ${safeUrl(a.materialLink)?`<p><a href="${esc(safeUrl(a.materialLink))}" target="_blank" rel="noopener noreferrer">Abrir planos y materiales</a></p>`:""}
 <div id="assetPhotos" class="photos"></div>
 ${coordinator?`<label>Agregar fotografías de esta pieza<input type="file" multiple accept="image/*" id="assetPhotosInput"></label>
 <button id="assetUpload">Guardar fotografías de la pieza</button>`:""}
 <button id="assetToReport">Reportar daño en esta pieza</button>`;
 $("assetToReport").onclick=()=>{
  $("assetPicker").value=a.id;$("assetPicker").dispatchEvent(new Event("change"));
  form.elements.problem.focus();form.scrollIntoView({behavior:"smooth",block:"center"});
 };
 if(coordinator)$("assetUpload").onclick=()=>uploadAssetPhotos(a);
 const root=$("assetPhotos");
 if(!a.photoPaths?.length){root.textContent="Sin fotografías registradas.";return;}
 for(const path of a.photoPaths){
  const img=document.createElement("img");img.alt="Fotografía de "+a.piece;img.loading="lazy";
  root.append(img);
  try{
   const data=await getSparkPhoto(path);
   if(selectedAsset!==id)return;img.src=data;
  }catch{img.alt="Fotografía no disponible";img.title="No fue posible cargar esta imagen";}
 }
}
async function uploadAssetPhotos(asset){
 const files=[...($("assetPhotosInput")?.files||[])];
 if(!files.length)return feedback("Selecciona fotografías de la pieza.",true);
 if(files.length+(asset.photoPaths||[]).length>20)return feedback("Máximo 20 fotos por pieza.",true);
 const button=$("assetUpload");button.disabled=true;
 try{
  for(const file of files){
   const dataUrl=await compressSparkPhoto(file),photoId=crypto.randomUUID(),marker=photoMarker(photoId);
   const image=sparkPhotoPayload({id:photoId,kind:"asset",ownerId:asset.id,
     uploadedBy:currentUser.uid,dataUrl,label:clean(file.name,120),stage:"inventario",
     createdAt:serverTimestamp()});
   await runTransaction(db,async tx=>{
    const ref=doc(db,"agora_repair_assets",asset.id),snap=await tx.get(ref);
    if(!snap.exists())throw Error("Pieza de inventario no encontrada");
    const old=snap.data(),photoPaths=[...(old.photoPaths||[])];
    if(photoPaths.length>=20)throw Error("Límite de 20 fotos alcanzado");
    photoPaths.push(marker);
    tx.set(doc(db,"agora_repair_photos",photoId),image);
    tx.update(ref,{photoPaths,revision:old.revision+1,updatedAt:serverTimestamp()});
   });
  }
  feedback("Fotografías de inventario guardadas como vistas previas privadas en Firestore.");
 }catch(e){feedback("No se guardaron las fotografías: "+e.message,true)}
 finally{button.disabled=false;}
}
