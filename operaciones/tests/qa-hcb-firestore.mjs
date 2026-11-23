/**
 * Prueba real de alta inicial Hot Cruji Bravo contra Firebase Emulator.
 * Cuentas ficticias; NUNCA consulta Firestore de producción.
 */
import {readFileSync} from "node:fs";
import {initializeTestEnvironment,assertSucceeds,assertFails} from "@firebase/rules-unit-testing";
import {doc,collection,query,where,getDocs,writeBatch,setDoc,serverTimestamp,Timestamp} from "firebase/firestore";
import {HCB_PROJECT,HCB_STAND,HCB_ASSETS,HCB_INSPECTIONS,hcbAssetById} from "../hot-cruji-bravo-caso.mjs";
import {makeRequest} from "../reparaciones-model.mjs";
const project="demo-agora-ops";
const env=await initializeTestEnvironment({
 projectId:project,
 firestore:{host:"127.0.0.1",port:Number(process.env.FIRESTORE_EMULATOR_PORT||8080),rules:readFileSync("firestore.rules","utf8")}
});
try{
 await env.withSecurityRulesDisabled(async x=>{
  await setDoc(doc(x.firestore(),"agora_users","hcb-coordinator"),{
    name:"Coordinación de prueba",email:"coordinador@example.invalid",role:"coordinador",active:true,
    createdAt:Timestamp.now(),updatedAt:Timestamp.now()
  });
 });
 const db=env.authenticatedContext("hcb-coordinator",{email:"coordinador@example.invalid",email_verified:true}).firestore();
 const user={uid:"hcb-coordinator",name:"Coordinación de prueba",email:"coordinador@example.invalid"};
 for(const group of [HCB_ASSETS.slice(0,7),HCB_ASSETS.slice(7)]){
  const batch=writeBatch(db);
  for(const a of group){
   batch.set(doc(db,"agora_repair_assets",a.id),{
    id:a.id,project:HCB_PROJECT,stand:HCB_STAND,piece:a.piece,
    description:a.code+" · "+a.description,materialLink:"",condition:"Por revisar",photoPaths:[],
    createdBy:user.uid,createdAt:serverTimestamp(),updatedAt:serverTimestamp(),revision:1
   });
  }
  await assertSucceeds(batch.commit());
 }
 const batch=writeBatch(db);
 for(const task of HCB_INSPECTIONS){
  const related=hcbAssetById(task.assetId);
  const request=makeRequest({
   project:HCB_PROJECT,asset:HCB_STAND,assetId:related?.id||"",
   scope:"Elemento específico",area:task.area,cause:"Inspección inicial de inventario · sin daño confirmado",
   problem:task.problem,solutionMode:"propuesta",instructions:task.instructions,
   materialLink:"",priority:task.priority,dueDate:""
  },user,task.id,serverTimestamp());
  batch.set(doc(db,"agora_repair_requests",task.id),request);
  batch.set(doc(collection(db,"agora_repair_events")),{
   requestId:task.id,actorUid:user.uid,actorEmail:user.email,
   action:"creada",detail:task.code+" · Revisión documental inicial; daños sin confirmar",
   createdAt:serverTimestamp()
  });
 }
 await assertSucceeds(batch.commit());
 const assets=await assertSucceeds(getDocs(query(collection(db,"agora_repair_assets"),where("project","==",HCB_PROJECT))));
 const requests=await assertSucceeds(getDocs(query(collection(db,"agora_repair_requests"),where("project","==",HCB_PROJECT))));
 if(assets.size!==13||requests.size!==5)throw Error("Inventario o revisiones incompletas: "+assets.size+" / "+requests.size);
 const outsider=env.unauthenticatedContext().firestore();
 await assertFails(getDocs(collection(outsider,"agora_repair_assets")));
 console.log("OK Hot Cruji Bravo: 13 activos + 5 inspecciones y bitácora, sin fotos falsas ni permisos públicos");
}finally{await env.cleanup();}
