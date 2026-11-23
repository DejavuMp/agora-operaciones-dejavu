/** Prueba edición solicitada, únicamente contra el emulador Firestore local. */
import {readFileSync} from "node:fs";
import {initializeTestEnvironment,assertSucceeds,assertFails} from "@firebase/rules-unit-testing";
import {doc,collection,getDoc,getDocs,query,where,writeBatch,setDoc,updateDoc,runTransaction,serverTimestamp,Timestamp} from "firebase/firestore";
import {makeRequest} from "../reparaciones-model.mjs";
import {repairEditPatch,repairGroupPatch,checkEditRevision} from "../reparaciones-editar.mjs";
const projectId="demo-agora-ops";
const env=await initializeTestEnvironment({
 projectId,
 firestore:{host:"127.0.0.1",port:Number(process.env.FIRESTORE_EMULATOR_PORT||8080),
  rules:readFileSync("firestore.rules","utf8")}
});
const ids=["fece1743-6f23-4fe8-95ad-339b477c2c10","fece1743-6f23-4fe8-95ad-339b477c2c11"];
const actor={uid:"reparaciones-editor",email:"editor@example.invalid",name:"Coordinación prueba"};
try{
 await env.withSecurityRulesDisabled(async ctx=>{
  const fs=ctx.firestore();
  await setDoc(doc(fs,"agora_users",actor.uid),{name:actor.name,email:actor.email,
   role:"coordinador",active:true,createdAt:Timestamp.now(),updatedAt:Timestamp.now()});
  await setDoc(doc(fs,"agora_ops_members","repair-staff"),{active:true,role:"staff",email:"staff@example.invalid"});
 });
 const db=env.authenticatedContext(actor.uid,{email:actor.email,email_verified:true}).firestore();
 const staff=env.authenticatedContext("repair-staff",{email:"staff@example.invalid",email_verified:true}).firestore();
 const batch=writeBatch(db);
 for(let i=0;i<ids.length;i++){
  const item=makeRequest({project:"Hot Cruji Bravo",asset:"Stand Modo Bravo · Centro Santa Fe",
   area:"Pieza "+(i+1),problem:"Desgaste visible "+(i+1),scope:"Elemento específico",
   solutionMode:"propuesta",priority:"Normal"},actor,ids[i],serverTimestamp());
  batch.set(doc(db,"agora_repair_requests",ids[i]),item);
  batch.set(doc(collection(db,"agora_repair_events")),{requestId:ids[i],
   actorUid:actor.uid,actorEmail:actor.email,action:"creada",
   detail:"Solicitud para prueba de edición",createdAt:serverTimestamp()});
 }
 await assertSucceeds(batch.commit());
 const edit=repairEditPatch({area:"Panel negro",problem:"Reparación de acabado",
  scope:"Elemento específico",priority:"Alta",cause:"Montaje",dueDate:"2026-12-05",
  solutionMode:"instrucciones",instructions:"Resanar solo donde proceda"});
 await assertSucceeds(runTransaction(db,async tx=>{
  const ref=doc(db,"agora_repair_requests",ids[0]),snap=await tx.get(ref);
  checkEditRevision(snap.data(),1);
  tx.update(ref,{...edit,revision:2,updatedAt:serverTimestamp()});
  tx.set(doc(collection(db,"agora_repair_events")),{requestId:ids[0],
   actorUid:actor.uid,actorEmail:actor.email,action:"decisión",
   detail:"Edición de concepto: Panel negro",createdAt:serverTimestamp()});
 }));
 const changed=await assertSucceeds(getDoc(doc(db,"agora_repair_requests",ids[0])));
 if(changed.data().area!=="Panel negro"||changed.data().revision!==2||changed.data().priority!=="Alta")
  throw Error("La edición de un arreglo no persistió");
 if(changed.data().photos.length!==0||changed.data().createdBy!==actor.uid)
  throw Error("La edición alteró datos inmutables");
 const general=repairGroupPatch({project:"Hot Cruji Bravo",asset:"Stand reparaciones · Centro Santa Fe"});
 await assertSucceeds(runTransaction(db,async tx=>{
  const refs=ids.map(id=>doc(db,"agora_repair_requests",id));
  const snaps=await Promise.all(refs.map(ref=>tx.get(ref)));
  const revisions=[2,1];
  for(let i=0;i<refs.length;i++)checkEditRevision(snaps[i].data(),revisions[i]);
  for(let i=0;i<refs.length;i++){
   tx.update(refs[i],{...general,revision:snaps[i].data().revision+1,
    updatedAt:serverTimestamp()});
   tx.set(doc(collection(db,"agora_repair_events")),{requestId:ids[i],
    actorUid:actor.uid,actorEmail:actor.email,action:"decisión",
    detail:"Edición general: Stand reparaciones",createdAt:serverTimestamp()});
  }
 }));
 const both=await assertSucceeds(getDocs(query(collection(db,"agora_repair_requests"),where("project","==","Hot Cruji Bravo"))));
 if(both.size!==2||both.docs.some(x=>x.data().asset!=="Stand reparaciones · Centro Santa Fe"))
  throw Error("Los conceptos no conservaron la misma solicitud general");
 const events=await assertSucceeds(getDocs(query(collection(db,"agora_repair_events"),where("requestId","==",ids[0]))));
 if(events.size!==3)throw Error("No se conservó la auditoría de los cambios");
 await assertFails(updateDoc(doc(staff,"agora_repair_requests",ids[0]),{
  area:"Cambio sin autorización",revision:4,updatedAt:serverTimestamp()
 }));
 console.log("OK: edición por coordinación, datos generales, historial persistente y Staff sin permiso de edición.");
}finally{await env.cleanup();}
