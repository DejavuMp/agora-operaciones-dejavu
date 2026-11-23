import "../firebase-init.js";
import {clean,safeUrl,makeRequest,makeQuote,summary,encodeCsv,STATUSES,ROUTES} from "./reparaciones-model.mjs";
import {GoogleAuthProvider,onAuthStateChanged,signInWithPopup,signInWithRedirect,signOut} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import {collection,doc,query,where,limit,onSnapshot,getDocFromServer,serverTimestamp,writeBatch,runTransaction} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";
import {getStorage,ref as storageRef,uploadBytes,getBlob} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-storage.js";
const fb=window.AGORA_FIREBASE,auth=fb?.auth,db=fb?.firestore,storage=fb?.app?getStorage(fb.app):null;
const $=id=>document.getElementById(id),esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const COLL="agora_repair_requests",EVENTS="agora_repair_events";
let currentUser=null,coordinator=false,rows=[],assets=[],selected="",selectedAsset="",unsub=null,unsubEvents=null,unsubAssets=null,session=0;
function feedback(message,error=false){$("message").textContent=message;$("message").className=error?"error":"ok";}
function gate(text,canLogin=true){$("workspace").hidden=true;$("gate").hidden=false;$("gateText").textContent=text;$("login").hidden=!canLogin;}
const requestRef=id=>doc(db,COLL,id),logRef=()=>doc(collection(db,EVENTS));
const link=id=>{const u=new URL("./reparaciones.html",location.href);u.searchParams.set("solicitud",id);return u.href;};
function reset(){session++;if(unsub){unsub();unsub=null;}if(unsubEvents){unsubEvents();unsubEvents=null;}if(unsubAssets){unsubAssets();unsubAssets=null;}rows=[];assets=[];selected="";selectedAsset="";currentUser=null;coordinator=false;$("detail").textContent="";$("records").textContent="";}
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
  const q=coordinator?query(collection(db,COLL),limit(150)):query(collection(db,COLL),where("createdBy","==",user.uid),limit(150));
  unsub=onSnapshot(q,{includeMetadataChanges:true},s=>{
   if(token!==session)return;
   if(s.metadata.fromCache){feedback("Sincronizando datos con Firebase…");return;}
   rows=s.docs.map(d=>({...d.data(),id:d.id})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
   $("total").textContent="("+rows.length+")";
   renderList();if(selected)renderDetail(selected);
   else if(new URLSearchParams(location.search).get("solicitud"))select(new URLSearchParams(location.search).get("solicitud"));
   feedback("Registros sincronizados con Firebase.");
  },e=>{gate("No se pueden consultar las solicitudes: "+(e.message||e)+". Revisa las reglas Firestore.",true);feedback("Lectura denegada o sin conexión.",true);});
 }catch(e){if(token===session){gate("No se pudo validar tu cuenta: "+(e.message||e),false);feedback("No se otorgó acceso sin verificar permisos.",true);}}
}
$("login").onclick=async()=>{try{await signInWithPopup(auth,new GoogleAuthProvider());}catch(e){if(e.code==="auth/popup-blocked")await signInWithRedirect(auth,new GoogleAuthProvider());else feedback(e.message,true);}};
$("logout").onclick=()=>signOut(auth);
if(auth&&db&&storage)onAuthStateChanged(auth,start,e=>gate("Error de autenticación: "+e.message,false));
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
 const filtered=rows.filter(r=>[r.id,r.project,r.asset,r.area,r.status].join(" ").toLowerCase().includes(term));
 $("records").innerHTML=filtered.map(r=>`<button class="record ${r.id===selected?"selected":""}" data-record="${esc(r.id)}">
  <b>${esc(r.asset)} · ${esc(r.area)}</b><span class="status">${esc(r.status)}</span>
  <small>${esc(r.project)} · ${esc(r.priority)} · Folio ${esc(r.id.slice(0,8))}</small></button>`).join("")||'<p class="muted">No hay solicitudes con este filtro.</p>';
 $("records").querySelectorAll("[data-record]").forEach(b=>b.onclick=()=>select(b.dataset.record));
}
$("filter").oninput=renderList;
function select(id){
 selected=id;const u=new URL(location.href);u.searchParams.set("solicitud",id);history.replaceState({}, "",u.href);
 renderList();renderDetail(id);
}
function qr(){
 const el=$("qr");if(!el)return;el.replaceChildren();const url=link(selected);
 if(window.QRCode)new window.QRCode(el,{text:url,width:128,height:128,colorDark:"#17191d",colorLight:"#ffffff",correctLevel:window.QRCode.CorrectLevel.M});
 else el.textContent="Copia el enlace privado (QR temporalmente no disponible).";
}
function detailRow(name,value){return `<dt>${esc(name)}</dt><dd>${esc(value||"—")}</dd>`;}
async function renderPhotos(record){
 const parent=$("photos");if(!parent)return;parent.textContent="Cargando fotografías protegidas...";
 if(!record.photos?.length){parent.textContent="Sin fotografías todavía.";return;}
 parent.replaceChildren();
 for(const item of record.photos.slice(0,12)){
  const img=document.createElement("img");img.alt=item.label||"Evidencia de reparación";img.loading="lazy";
  const anchor=document.createElement("a");anchor.rel="noopener noreferrer";anchor.target="_blank";anchor.append(img);parent.append(anchor);
  try{const blob=await getBlob(storageRef(storage,item.path));if(selected!==record.id)return;const url=URL.createObjectURL(blob);img.src=url;anchor.href=url;anchor.download=(item.label||"evidencia")+".jpg";}
  catch(_){anchor.replaceWith(document.createTextNode("Foto no disponible · "));}
 }
}
function renderDetail(id){
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
 <div class="actions"><button id="copy">Copiar ficha</button><button id="email">Correo</button><button id="pdf">PDF</button><button id="png">Imagen PNG</button><button id="copyLink">Copiar enlace</button></div>
 <div class="two" style="align-items:start"><div><h3 style="font-size:14px">Enlace y QR privado</h3><div id="qr"></div><p class="form-help">Requiere una cuenta con permisos para abrir el expediente. No compartir con acceso anónimo.</p></div>
 <div><h3 style="font-size:14px">Evidencias</h3><div id="photos" class="photos"></div><label>Adjuntar fotografías JPEG/PNG<input id="photoFiles" type="file" multiple accept="image/*"></label><button id="uploadPhotos">Guardar fotografías</button><p class="form-help">Máximo 12 evidencias por folio, 5 MB por imagen guardada.</p></div></div>
 <hr><h3 style="font-size:15px">Cotizaciones</h3>${quotes}
 ${coordinator?`<form id="quoteForm"><h3 style="font-size:13px">Agregar cotización</h3><div class="two"><label>Proveedor<input name="provider" maxlength="160" required></label><label>Importe MXN<input type="number" min="0" max="99999999" step=".01" name="amount" required></label></div><label>Alcance / trabajo<input name="scope" maxlength="500"></label><label>Enlace HTTPS de cotización<input name="link" type="url"></label><label>Observaciones<input name="note" maxlength="500"></label><button type="submit">Guardar propuesta</button></form>
 <hr><form id="decisionForm"><h3 style="font-size:15px">Decisión de coordinación</h3>
 <div class="two"><label>Quién lo resolverá<select name="repairRoute">${ROUTES.map(v=>`<option value="${v}" ${v===r.repairRoute?"selected":""}>${esc(({pendiente:"Pendiente",staff:"Staff",agencia:"Coordinación / agencia",proveedor:"Proveedor existente",nuevo:"Proveedor nuevo",cotizar:"Solicitar cotización",comparar:"Comparar cotizaciones"})[v])}</option>`).join("")}</select></label>
 <label>Estado<select name="status">${STATUSES.map(v=>`<option value="${v}" ${v===r.status?"selected":""}>${esc(v)}</option>`).join("")}</select></label></div>
 <label>Responsable / empresa<input name="assignedTo" maxlength="160" value="${esc(r.assignedTo)}"></label>
 <label>Costo estimado MXN<input name="estimatedCost" type="number" min="0" step=".01" max="99999999" value="${Number(r.estimatedCost||0)}"></label>
 <label>Observaciones / justificación<textarea name="decisionNote" maxlength="2000">${esc(r.decisionNote)}</textarea></label>
 <button type="submit" class="primary">Guardar decisión y seguimiento</button></form>
 <hr><h3 style="font-size:14px">Historial de movimientos</h3><ul id="history"><li>Cargando historial...</li></ul>`:""}`;
 qr();renderPhotos(r);
 $("copy").onclick=()=>copy(summary(r,link(r.id)));
 $("copyLink").onclick=()=>copy(link(r.id));
 $("email").onclick=()=>{location.href="mailto:?subject="+encodeURIComponent("ÁGORA · Reparación "+r.asset+" · "+r.id.slice(0,8))+"&body="+encodeURIComponent(summary(r,link(r.id)).slice(0,4500));};
 $("pdf").onclick=()=>makePdf(r);
 $("png").onclick=()=>makePng(r);
 $("uploadPhotos").onclick=()=>uploadPhotos(r);
 if(!coordinator)return;
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
async function saveDecision(r,f){
 try{
  if(!ROUTES.includes(f.repairRoute)||!STATUSES.includes(f.status))throw Error("Estado o ruta no válida");
  const cost=Number(f.estimatedCost);if(!Number.isFinite(cost)||cost<0||cost>99999999)throw Error("Costo inválido");
  await update(r.id,"decisión","Ruta "+f.repairRoute+" / Estado "+f.status,()=>({
   repairRoute:f.repairRoute,status:f.status,assignedTo:clean(f.assignedTo,160),
   decisionNote:clean(f.decisionNote,2000),estimatedCost:cost,decisionBy:currentUser.name
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
async function chooseQuote(r,id){
 try{await update(r.id,"selección de cotización","Propuesta seleccionada",old=>{
  const q=(old.quotes||[]).find(x=>x.id===id);if(!q)throw Error("Cotización no encontrada");
  return {selectedQuoteId:id,estimatedCost:q.amount,repairRoute:"proveedor",assignedTo:q.provider,decisionBy:currentUser.name,status:"revision"};
 });feedback("Propuesta seleccionada para revisión.");}catch(e){feedback(e.message,true);}
}
async function resize(file){
 const url=URL.createObjectURL(file);
 try{
  const image=await new Promise((resolve,reject)=>{const im=new Image;im.onload=()=>resolve(im);im.onerror=reject;im.src=url;});
  const scale=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight));
  const canvas=document.createElement("canvas");canvas.width=Math.round(image.naturalWidth*scale);canvas.height=Math.round(image.naturalHeight*scale);
  const ctx=canvas.getContext("2d");ctx.fillStyle="white";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",.82));if(!blob||blob.size>5*1024*1024)throw Error("Imagen superior a 5 MB");
  return blob;
 }finally{URL.revokeObjectURL(url);}
}
async function uploadPhotos(r){
 const files=[...($("photoFiles")?.files||[])];if(!files.length)return feedback("Selecciona una o más fotos.",true);
 if(files.length+(r.photos||[]).length>12)return feedback("Máximo 12 fotografías por solicitud.",true);
 const button=$("uploadPhotos");button.disabled=true;
 try{
  for(const file of files){
   if(!file.type.startsWith("image/"))throw Error("Solo se admiten imágenes");
   const data=await resize(file),path=`agora-repairs/${r.id}/${currentUser.uid}/${crypto.randomUUID()}.jpg`;
   await uploadBytes(storageRef(storage,path),data,{contentType:"image/jpeg",customMetadata:{requestId:r.id}});
   await runTransaction(db,async tx=>{
    const snap=await tx.get(requestRef(r.id));if(!snap.exists())throw Error("Folio no encontrado");
    const old=snap.data(),photos=[...(old.photos||[])];
    if(photos.length>=12)throw Error("Límite de imágenes del folio");
    photos.push({path,label:clean(file.name,120)});
    tx.update(requestRef(r.id),{photos,revision:old.revision+1,updatedAt:serverTimestamp()});
    tx.set(logRef(),{requestId:r.id,actorUid:currentUser.uid,actorEmail:currentUser.email,action:"evidencia",detail:clean(file.name,120),createdAt:serverTimestamp()});
   });
  }feedback("Evidencias guardadas y asociadas al folio.");
 }catch(e){feedback("No se completó la carga: "+e.message+". Puede haber una imagen pendiente de asociar; avisa a coordinación.",true)}
 finally{button.disabled=false;}
}
async function loadHistory(r){
 if(unsubEvents){unsubEvents();unsubEvents=null;}
 if(!coordinator)return;
 unsubEvents=onSnapshot(query(collection(db,EVENTS),where("requestId","==",r.id),limit(100)),snap=>{
  if(selected!==r.id)return;
  const el=$("history");if(!el)return;
  const log=snap.docs.map(d=>d.data()).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
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
 const qr=qrCanvas();if(qr){if(y>230){p.addPage();y=20;}p.addImage(qr.toDataURL("image/png"),"PNG",18,y+4,29,29);}
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
 for(const a of assets){
  const btn=document.createElement("button");
  btn.className=a.id===selectedAsset?"primary":"";
  btn.textContent=a.stand+" · "+a.piece+" ("+a.condition+")";
  btn.title=a.project;btn.onclick=()=>showAsset(a.id);
  box.append(btn);
 }
 if(selectedAsset)showAsset(selectedAsset);
}
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
  try{const blob=await getBlob(storageRef(storage,path));if(selectedAsset!==id)return;img.src=URL.createObjectURL(blob);}
  catch{img.alt="Foto sin acceso";img.title="No se pudo leer esta imagen";}
 }
}
async function uploadAssetPhotos(asset){
 const files=[...($("assetPhotosInput")?.files||[])];
 if(!files.length)return feedback("Selecciona fotografías de la pieza.",true);
 if(files.length+(asset.photoPaths||[]).length>20)return feedback("Máximo 20 fotos por pieza.",true);
 const button=$("assetUpload");button.disabled=true;
 try{
  for(const file of files){
   if(!file.type.startsWith("image/"))throw Error("Solo imágenes.");
   const jpg=await resize(file),path=`agora-repair-assets/${asset.id}/${currentUser.uid}/${crypto.randomUUID()}.jpg`;
   await uploadBytes(storageRef(storage,path),jpg,{contentType:"image/jpeg"});
   await runTransaction(db,async tx=>{
    const ref=doc(db,"agora_repair_assets",asset.id),snap=await tx.get(ref);
    if(!snap.exists())throw Error("La pieza no existe");
    const old=snap.data(),photoPaths=[...(old.photoPaths||[])];
    if(photoPaths.length>=20)throw Error("La pieza llegó a su límite de fotos");
    photoPaths.push(path);
    tx.update(ref,{photoPaths,revision:old.revision+1,updatedAt:serverTimestamp()});
   });
  }
  feedback("Fotos almacenadas en el inventario de la pieza.");
 }catch(e){feedback("Error al guardar fotografías del inventario: "+e.message,true);}finally{button.disabled=false;}
}
