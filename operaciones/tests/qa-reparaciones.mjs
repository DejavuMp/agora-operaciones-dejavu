import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {makeRequest,makeQuote,safeUrl,summary,encodeCsv,ROUTES,STATUSES} from "../reparaciones-model.mjs";
import {createInviteToken,invitePayload,supplierResponse,quoteFromInvite,supplierInviteUrl,TOKEN_PATTERN} from "../reparaciones-invitaciones-model.mjs";
import {photoRefId,photoMarker,validatePhotoData,sparkPhotoPayload,MAX_PHOTO_CHARS} from "../reparaciones-fotos-spark.mjs";
import {HCB_PROJECT,HCB_STAND,HCB_ASSETS,HCB_INSPECTIONS,HCB_CASE,hcbAssetById,hcbImportPlan} from "../hot-cruji-bravo-caso.mjs";
import {groupRepairs,bundleByItem,bundleStatus,bundleSummary,HCB_GROUP_ANCHOR} from "../reparaciones-agrupadas.mjs";
const id="d630d5ec-4e3a-4d51-92b2-0d917f43ebc9";
const user={uid:"u-01",email:"staff@example.test",name:"Staff de prueba"};
const raw={project:"Hot Cruji Bravo",asset:"Stand principal",assetId:"",scope:"Elemento específico",
 area:"Panel frontal",problem:"Panel suelto",solutionMode:"propuesta",materialLink:"https://example.org/planos",priority:"Alta"};
test("genera folio, asigna creador y nunca preautoriza presupuestos",()=>{
 const r=makeRequest(raw,user,id,"fechaServidor");
 assert.equal(r.id,id);assert.equal(r.createdBy,user.uid);assert.equal(r.status,"pendiente");
 assert.equal(r.repairRoute,"pendiente");assert.equal(r.revision,1);
 assert.deepEqual(r.quotes,[]);assert.deepEqual(r.photos,[]);assert.equal(r.estimatedCost,0);
 assert.equal(r.assetId,"");assert.equal(r.createdAt,"fechaServidor");
});
test("valida los campos mínimos y enlaces exclusivamente HTTPS",()=>{
 assert.throws(()=>makeRequest({...raw,problem:""},user,id,"fecha"),/Completa/);
 assert.throws(()=>makeRequest({...raw,materialLink:"http://example.com"},user,id,"fecha"),/HTTPS/);
 assert.equal(safeUrl("javascript:alert(1)"),"");
 assert.equal(safeUrl("https://dejavu.example/a"),"https://dejavu.example/a");
});
test("cotizaciones con proveedor, costo y URL segura",()=>{
 const q=makeQuote({provider:"Taller A",amount:"1234.50",scope:"Cambiar panel",link:"https://example.com/cotiza"},id);
 assert.equal(q.amount,1234.5);assert.equal(q.provider,"Taller A");
 assert.throws(()=>makeQuote({provider:"Taller",amount:-1},id),/importe/);
 assert.throws(()=>makeQuote({provider:"Taller",amount:15,link:"http://example.org"},id),/HTTPS/);
});
test("presenta rutas, estatus, relación con inventario y enlace privado",()=>{
 const r={...makeRequest(raw,user,id,"fecha"),assetId:"pieza-001",quotes:[],photos:[]};
 const text=summary(r,"https://dejavu.example/reparaciones.html?solicitud="+id);
 assert.match(text,/pieza-001/);assert.match(text,/Hot Cruji Bravo/);
 assert.match(text,/Enlace privado de seguimiento/);
 assert.ok(ROUTES.includes("comparar"));assert.ok(STATUSES.includes("entregado"));
});
test("exportación CSV conserva columnas y desactiva fórmulas de hojas de cálculo",()=>{
 const data=encodeCsv([{id,project:"=IMPORTXML(1)",asset:"Stand",area:"Zona"}]);
 assert.match(data,/"'=IMPORTXML\(1\)"/);
 assert.match(data,/id,project,asset,area/);
});
test("control de acceso del repositorio preserva cierres por defecto y lista de estados",()=>{
 const path=fileURLToPath(new URL("../../firestore.rules",import.meta.url));
 const rules=readFileSync(path,"utf8");
 assert.match(rules,/match \/agora_repair_requests\/\{id\}/);
 assert.match(rules,/match \/agora_repair_assets\/\{id\}/);
 assert.match(rules,/match \/agora_repair_events\/\{eventId\}/);
 assert.match(rules,/allow delete: if false;/);
 assert.match(rules,/request\.resource\.data\.createdBy == resource\.data\.createdBy/);
});

test("tokens externos tienen 256 bits y URL temporal individual",()=>{
 const b=Uint8Array.from({length:32},(_,i)=>i+10);
 const token=createInviteToken(b);
 assert.equal(token.length,43);assert.match(token,TOKEN_PATTERN);
 const url=supplierInviteUrl("https://dejavump.github.io/agora-operaciones-dejavu/operaciones/reparaciones.html",token);
 assert.ok(url.includes("reparacion-cotizar.html?solicitud="));
 assert.throws(()=>createInviteToken(new Uint8Array(8)),/32 bytes/);
});
test("invitación muestra solo ficha pública sin campos financieros internos",()=>{
 const raw={...makeRequest(rawSample(),user,id,"server"),createdByEmail:"coordinacion@example.invalid",
  estimatedCost:999,decisionNote:"Información interna",quotes:[{provider:"A",amount:1000}]};
 const invite=invitePayload(raw,"coordinacion","Taller Norte","servidor","caducidad");
 assert.equal(invite.requestId,id);assert.equal(invite.status,"pending");
 assert.equal(invite.snapshot.project,"Hot Cruji Bravo");
 assert.ok(!("estimatedCost" in invite.snapshot));
 assert.ok(!("quotes" in invite.snapshot));
 assert.ok(!("createdByEmail" in invite.snapshot));
});
test("respuesta del proveedor valida monto y enlace HTTPS; importación una vez",()=>{
 const response=supplierResponse({provider:"Taller Norte",amount:"1400.50",scope:"Cambio de panel",email:"hola@proveedor.mx"});
 assert.equal(response.amount,1400.5);
 assert.throws(()=>supplierResponse({provider:"A",scope:"",amount:0}),/trabajo/);
 assert.throws(()=>supplierResponse({provider:"Taller",scope:"Reparación",amount:-2}),/Importe/);
 const token=createInviteToken(Uint8Array.from({length:32},(_,i)=>i+1));
 const q=quoteFromInvite({status:"submitted",response},token,id);
 assert.equal(q.sourceInviteId,token);assert.equal(q.amount,1400.5);
 assert.throws(()=>quoteFromInvite({status:"pending",response},token,id),/válida/);
});
function rawSample(){return {project:"Hot Cruji Bravo",asset:"Stand",scope:"Elemento específico",area:"Panel",problem:"Daño visible"};}

test("página de proveedor no exige identidad ni muestra presupuestos internos",()=>{
 const base=fileURLToPath(new URL("../",import.meta.url));
 const html=readFileSync(base+"reparacion-cotizar.html","utf8");
 const js=readFileSync(base+"reparacion-cotizar.js","utf8");
 assert.match(html,/name="provider"/);
 assert.match(html,/name="amount"/);
 assert.match(html,/noindex,nofollow/);
 assert.match(js,/getDocFromServer\(record\(\)\)/);
 assert.match(js,/supplierResponse/);
 assert.doesNotMatch(js,/signInWithPopup|localStorage|sessionStorage/);
});
test("vista previa de foto está restringida a JPEG compartido",()=>{
 const invite=invitePayload({id,project:"Stand",asset:"Panel",area:"Frente",problem:"Daño visible"},
  "coordinator","Proveedor","fecha","expiry","data:image/jpeg;base64,/9j/2Q==");
 assert.match(invite.snapshot.photoPreview,/^data:image\/jpeg;base64,/);
 const invalid=invitePayload({id,project:"Stand",asset:"Panel",area:"Frente",problem:"Daño visible"},
  "coordinator","Proveedor","fecha","expiry","data:text/html;base64,AAAA");
 assert.equal(invalid.snapshot.photoPreview,"");
});

test("Spark: guardado por fotografía y sin Cloud Storage",()=>{
 const imageId="b630d5ec-4e3a-4d51-92b2-0d917f43ebc9";
 const marker=photoMarker(imageId);
 assert.equal(photoRefId(marker),imageId);
 assert.equal(photoRefId("agora-repairs/"+id+"/x/imagen.jpg"),null);
 assert.equal(photoRefId("firestore:../../otro"),null);
 const dataUrl="data:image/jpeg;base64,/9j/2Q==";
 const d=sparkPhotoPayload({id:imageId,kind:"request",ownerId:id,
  uploadedBy:user.uid,dataUrl,label:"Daño del panel",stage:"antes",createdAt:"servidor"});
 assert.equal(d.dataUrl,dataUrl);
 assert.equal(d.ownerId,id);
 assert.equal(d.stage,"antes");
 assert.throws(()=>validatePhotoData("data:text/html;base64,AAAA"),/JPEG/);
 assert.throws(()=>validatePhotoData("data:image/jpeg;base64,"+"A".repeat(MAX_PHOTO_CHARS)),/límite/);
});
test("El frontend Spark no depende de APIs de Storage o facturación",()=>{
 const base=fileURLToPath(new URL("../",import.meta.url));
 const ui=readFileSync(base+"reparaciones.js","utf8");
 const invite=readFileSync(base+"reparaciones-invitaciones-ui.mjs","utf8");
 assert.doesNotMatch(ui,/getStorage\(|getBlob\(|uploadBytes\(/);
 assert.doesNotMatch(invite,/getStorage\(|getBlob\(/);
 assert.match(ui,/agora_repair_photos/);
 assert.match(ui,/compressSparkPhoto/);
 assert.match(ui,/runTransaction/);
});

test("Hot Cruji Bravo: inventario inicial sustentado y sin daños inventados",()=>{
 assert.equal(HCB_PROJECT,"Hot Cruji Bravo");
 assert.equal(HCB_CASE.photosExpected,42);
 assert.equal(HCB_CASE.photosAttached,0);
 assert.equal(HCB_ASSETS.length,13);
 assert.equal(HCB_INSPECTIONS.length,5);
 const seen=new Set();
 for(const a of HCB_ASSETS){
  assert.match(a.id,/^[a-f0-9-]{36}$/);
  assert.ok(a.description.length<=790,"Descripción legible para Firestore");
  assert.ok(a.piece.length<=120);
  assert.equal(a.condition,"Por revisar");
  assert.ok(!seen.has(a.id));seen.add(a.id);
 }
 for(const q of HCB_INSPECTIONS){
  assert.match(q.id,/^[a-f0-9-]{36}$/);
  assert.ok(!seen.has(q.id));seen.add(q.id);
  assert.ok(hcbAssetById(q.assetId),"Cada inspección referencia inventario conocido");
  assert.match(q.problem,/Revisión pendiente:/);
  assert.ok(q.area.length<=120&&q.problem.length<=2000&&q.instructions.length<=2000);
 }
 const all=hcbImportPlan();
 assert.equal(all.assets.length,13);assert.equal(all.inspections.length,5);
 assert.equal(hcbImportPlan(HCB_ASSETS.map(a=>a.id),HCB_INSPECTIONS.map(q=>q.id)).assets.length,0);
 assert.equal(hcbImportPlan(HCB_ASSETS.map(a=>a.id),HCB_INSPECTIONS.map(q=>q.id)).inspections.length,0);
});
test("Hot Cruji Bravo: la pantalla registra un caso real solo con coordinación y sin inventar fotos",()=>{
 const base=fileURLToPath(new URL("../",import.meta.url));
 const js=readFileSync(base+"reparaciones.js","utf8");
 const html=readFileSync(base+"reparaciones.html","utf8");
 assert.match(html,/id="hcbImport"/);
 assert.match(html,/data-coord hidden/);
 assert.match(js,/if\(!coordinator\|\|!currentUser\)/);
 assert.match(js,/getDocsFromServer/);
 assert.match(js,/hcbImportPlan/);
 assert.match(js,/serverTimestamp\(\)/);
 assert.match(js,/Fotografías originales: 0 de 42 cargadas/);
});

test("Solicitudes de reparación es el flujo principal, inventario permanece secundario sin borrar datos",()=>{
 const base=fileURLToPath(new URL("../",import.meta.url));
 const html=readFileSync(base+"reparaciones.html","utf8");
 const js=readFileSync(base+"reparaciones.js","utf8");
 const main=html.indexOf('id="repairMain"'),inventory=html.indexOf('id="inventoryAdvanced"');
 assert.ok(main>0&&inventory>main,"Primero se presentan las solicitudes");
 assert.match(html,/<title>ÁGORA · Solicitudes de Reparación<\/title>/);
 assert.match(html,/<details id="inventoryAdvanced" class="panel" data-coord hidden>/);
 assert.match(html,/id="newRepair"/);
 assert.match(html,/id="repairQueue"/);
 assert.match(html,/id="requestForm"/);
 assert.match(html,/id="assetForm"/);
 assert.match(html,/id="hcbImport"/);
 assert.match(html,/El inventario no es requisito/);
 for(const field of ["project","asset","area","problem","priority","dueDate","scope",
   "cause","solutionMode","instructions","materialLink","assetId"]){
  assert.ok(html.includes('name="'+field+'"'),"Formulario conserva: "+field);
 }
 assert.ok(html.indexOf('id="hcbPhotoImport"')<inventory,"Importación fotográfica accesible desde solicitudes");
 assert.equal((html.match(/id="hcbPhotoImport"/g)||[]).length,1);
 assert.match(js,/if\(coordinator\)\{listenCatalog\(token\);listenMembers\(token\);\}/);
 assert.match(js,/batch\.set\(requestRef\(id\),record\)/);
 assert.match(js,/batch\.set\(logRef\(\)/);
 assert.match(js,/importHotCrujiPhotoCase/);
});

test("Hot Cruji Bravo aparece como una sola solicitud general con conceptos independientes",()=>{
 const fake=HCB_INSPECTIONS.map((t,i)=>({
  id:t.id,project:"Hot Cruji Bravo",asset:"Stand Modo Bravo · Centro Santa Fe",
  area:t.area,problem:t.problem,createdAt:{seconds:i+10},status:"pendiente",
  priority:t.priority,photos:[],quotes:[]
 }));
 fake.push({id:HCB_GROUP_ANCHOR,project:"Hot Cruji Bravo",
  asset:"Stand Modo Bravo · Centro Santa Fe",area:"Revisión de puerta",
  problem:"Revisar herrajes",createdAt:{seconds:90},status:"revision",photos:[],quotes:[]});
 fake.push({id:"e630d5ec-4e3a-4d51-92b2-0d917f43ebc9",project:"Otro proyecto",
  asset:"Otro stand",area:"Gráfica",problem:"Desgaste",createdAt:{seconds:99},
  status:"terminado",photos:[],quotes:[]});
 const groups=groupRepairs(fake);
 assert.equal(groups.length,2);
 const combined=bundleByItem(fake,HCB_INSPECTIONS[1].id);
 assert.ok(combined);
 assert.equal(combined.id,HCB_GROUP_ANCHOR,"Conservar folio general de Hot Cruji");
 assert.equal(combined.items.length,6);
 assert.equal(combined.open,6);
 assert.equal(combined.done,0);
 assert.match(bundleStatus(combined),/6 pendientes/);
 const summary=bundleSummary(combined,"https://example.org/solicitud-general");
 for(const item of combined.items){
  assert.ok(summary.includes(item.area));
  if(item.id!==combined.id)assert.ok(!summary.includes(item.id),"No exponer subfolios internos en el PDF general");
 }
 assert.match(summary,/Total de conceptos: 6/);
 assert.match(summary,/Folio general:/);
 assert.match(summary,/solicitud-general/);
});
test("Nuevas solicitudes aceptan varios arreglos con un solo flujo visible sin borrar documentos técnicos",()=>{
 const base=fileURLToPath(new URL("../",import.meta.url));
 const html=readFileSync(base+"reparaciones.html","utf8");
 const js=readFileSync(base+"reparaciones.js","utf8");
 assert.match(html,/id="addRepairItem"/);
 assert.match(html,/id="additionalRepairs"/);
 assert.match(js,/function addRepairLine/);
 assert.match(js,/grouped=groupRepairs\(rows\)/);
 assert.match(js,/batch\.set\(requestRef\(id\),record\)/);
 assert.match(js,/activeRepairItemId=b\.dataset\.repairItem/);
 assert.match(js,/bundleSummary\(group,link\(selected\)\)/);
 assert.match(js,/group\.items\.map\(\(item,i\)/);
 assert.match(js,/getDocFromServer\(requestRef\(id\)\)/);
 assert.doesNotMatch(js,/deleteDoc\(|batch\.delete\(/);
});
