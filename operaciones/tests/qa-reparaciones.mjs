import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {makeRequest,makeQuote,safeUrl,summary,encodeCsv,ROUTES,STATUSES} from "../reparaciones-model.mjs";
import {createInviteToken,invitePayload,supplierResponse,quoteFromInvite,supplierInviteUrl,TOKEN_PATTERN} from "../reparaciones-invitaciones-model.mjs";
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
