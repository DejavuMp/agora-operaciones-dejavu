import {collection,doc,onSnapshot,query,where,limit,writeBatch,updateDoc,serverTimestamp,Timestamp} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";
import {createInviteToken,invitePayload,supplierInviteUrl} from "./reparaciones-invitaciones-model.mjs";
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ST={pending:"Esperando propuesta",submitted:"Propuesta recibida",revoked:"Invitación cancelada"};
const ID="agora_repair_invites";
const invitationText=(request,url)=>"Dejavú Marketing · Solicitud de cotización\nProyecto: "+request.project+"\nPieza: "+request.asset+" / "+request.area+"\nAbre este enlace para enviar tu propuesta: "+url+"\nEnlace individual, temporal y de un solo uso.";
export function mountInvitations(container,{db,request,user,notice,alreadyImported,importProposal}){
 if(!container)return()=>{};
 container.innerHTML='<h3 style="font-size:15px">Solicitar cotización a proveedor</h3>'+
 '<p class="muted">Genera una invitación temporal. El proveedor solo verá la descripción compartida y podrá responder una vez, sin entrar a ÁGORA.</p>'+
 '<form id="createInvite"><div class="two"><label>Proveedor (opcional)<input name="supplierHint" maxlength="160" placeholder="Nombre o empresa"></label>'+
 '<label>Vigencia<select name="days"><option value="3">3 días</option><option value="7" selected>7 días</option><option value="14">14 días</option><option value="21">21 días</option></select></label></div>'+
 '<button type="submit" class="primary">Crear enlace de cotización</button></form>'+
 '<div id="inviteItems" aria-live="polite"><p class="muted">Consultando invitaciones...</p></div>';
 const items=container.querySelector("#inviteItems"),form=container.querySelector("#createInvite");
 let disposed=false;
 const render=(docs)=>{
  if(disposed)return;
  const records=docs.map(x=>({...x.data(),id:x.id})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
  items.replaceChildren();
  if(!records.length){items.textContent="Sin invitaciones todavía.";return;}
  for(const rec of records){
   const url=supplierInviteUrl(location.href,rec.id),expired=rec.expiresAt?.toMillis()<=Date.now();
   const submitted=rec.status==="submitted",integrated=alreadyImported(rec.id);
   const card=document.createElement("div");card.className="quote";
   card.innerHTML='<strong>'+esc(rec.supplierHint||"Proveedor por definir")+'</strong>'+
    '<p class="muted">'+esc(expired?"Vencida":ST[rec.status]||"Estado desconocido")+
    ' · '+esc(rec.expiresAt?.toDate?.().toLocaleDateString("es-MX")||"")+'</p>'+
    (submitted?'<p><b>Propuesta:</b> '+esc(rec.response?.provider||"")+" · $"+
      Number(rec.response?.amount||0).toFixed(2)+" MXN</p>":"")+
    (integrated?'<span class="tag">Agregada a comparación</span>':"")+
    '<div class="actions"></div>';
   const actions=card.querySelector(".actions");
   const button=(title,fn)=>{
    const b=document.createElement("button");b.type="button";b.textContent=title;
    b.onclick=fn;actions.append(b);return b;
   };
   if(!expired&&rec.status!=="revoked"){
    button("Copiar enlace",()=>copy(url,notice));
    button("Copiar mensaje",()=>copy(invitationText(request,url),notice));
    button("WhatsApp",()=>window.open("https://wa.me/?text="+encodeURIComponent(invitationText(request,url)),"_blank","noopener,noreferrer"));
    button("Correo",()=>{location.href="mailto:?subject="+encodeURIComponent("Cotización de reparación · "+request.asset)+"&body="+encodeURIComponent(invitationText(request,url));});
    const details=document.createElement("details");details.innerHTML="<summary>Ver QR</summary>";
    const code=document.createElement("div");details.append(code);card.append(details);
    details.addEventListener("toggle",()=>{if(details.open&&!code.children.length&&window.QRCode)
      new window.QRCode(code,{text:url,width:128,height:128,colorDark:"#14171b",colorLight:"#ffffff"});});
    button("Revocar",async()=>{
      if(!confirm("¿Cancelar este enlace de proveedor?"))return;
      try{await updateDoc(doc(db,ID,rec.id),{status:"revoked",updatedAt:serverTimestamp()});notice("Invitación revocada.");}
      catch(e){notice("No se revocó: "+e.message,true);}
    });
   }
   if(submitted&&!integrated){
    const b=button("Agregar a comparación",async()=>{
      b.disabled=true;
      try{await importProposal(rec);notice("Cotización externa integrada al expediente.");}
      catch(e){notice("No se pudo integrar: "+e.message,true);}
      finally{b.disabled=false;}
    });b.classList.add("primary");
   }
   items.append(card);
  }
 };
 const unsub=onSnapshot(query(collection(db,ID),where("requestId","==",request.id),limit(50)),s=>render(s.docs),e=>{if(!disposed)items.textContent="No se pudo consultar las invitaciones: "+e.message;});
 form.onsubmit=async e=>{
  e.preventDefault();const b=form.querySelector("[type=submit]");b.disabled=true;
  try{
   const data=Object.fromEntries(new FormData(form).entries());
   const days=Number(data.days);
   if(![3,7,14,21].includes(days))throw Error("Vigencia no válida");
   const bytes=crypto.getRandomValues(new Uint8Array(32)),token=createInviteToken(bytes);
   const exp=Timestamp.fromMillis(Date.now()+days*86400000),payload=invitePayload(request,user.uid,data.supplierHint,serverTimestamp(),exp);
   const batch=writeBatch(db);
   batch.set(doc(db,ID,token),payload);
   batch.set(doc(collection(db,"agora_repair_events")),{
    requestId:request.id,actorUid:user.uid,actorEmail:user.email,action:"invitación",
    detail:"Invitación temporal a "+(data.supplierHint||"proveedor")+" ("+days+" días)",createdAt:serverTimestamp()
   });
   await batch.commit();
   form.reset();
   const url=supplierInviteUrl(location.href,token);
   notice("Enlace de cotización creado y guardado.");
   copy(invitationText(request,url),notice);
  }catch(error){notice("No se creó el enlace: "+error.message,true)}
  finally{b.disabled=false;}
 };
 return ()=>{disposed=true;unsub();};
}
function copy(value,notice){
 if(navigator.clipboard&&isSecureContext)navigator.clipboard.writeText(value).then(()=>notice("Copiado."),()=>prompt("Copia este texto:",value));
 else prompt("Copia este texto:",value);
}
