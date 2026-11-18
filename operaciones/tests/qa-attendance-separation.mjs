import assert from "node:assert/strict";
import {verifiedAttendance,attendanceLabel,attendanceReference} from "../ops-attendance-review.mjs";
import {projectStaffView} from "../ops-safe-view.mjs";
import {readFileSync} from "node:fs";
const start="2026-11-18T09:00:00-06:00",end="2026-11-18T16:00:00-06:00";
const clock={ownerUid:"uid-1",eventId:"evt-1",personId:"person-1",status:"finalizada",
 startedAt:new Date(start),endedAt:new Date(end)};
const log={id:"j_uid-1_evt-1",eventId:"evt-1",ownerUid:"uid-1",personId:"person-1",
 start:new Date(start).toISOString(),end:new Date(end).toISOString(),
 breakMins:30,activity:"Jornada realizada",paymentStatus:"solicitado"};
const good=verifiedAttendance({clock,log});
assert.equal(good.minutes,390);
assert.equal(good.approvedHours,6.5);
assert.equal(attendanceLabel("solicitado"),"Esperando validación de coordinación");
assert.equal(attendanceLabel("validado"),"Horas validadas");
assert.deepEqual(attendanceReference({...log,paymentStatus:"validado"}),{
 source:"agora_operaciones",sourceId:"j_uid-1_evt-1",personUid:"uid-1",
 eventId:"evt-1",operationStatus:"validado"});
assert.throws(()=>verifiedAttendance({log,clock:{...clock,status:"en_curso"}}),/entrada y salida/);
assert.throws(()=>verifiedAttendance({log:{...log,ownerUid:"uid-2"},clock}),/no corresponde/);
assert.throws(()=>verifiedAttendance({log:{...log,start:"2026-11-18T13:00:00-06:00"},clock}),/no coincide/);
assert.throws(()=>verifiedAttendance({log:{...log,start:"fecha inválida"},clock}),/no coincide/);
assert.throws(()=>verifiedAttendance({log:{...log,breakMins:500},clock}),/descanso/);
assert.throws(()=>verifiedAttendance({log:{...log,breakMins:0,activity:"no"},clock}),/describir/);
const board={events:[{id:"evt-1",title:"Prueba",project:"Demo",staff:[
 {personId:"person-1",start,end,assignedByName:"Supervisor A",
  rateAmount:200,rateUnit:"hora",paymentMethod:"transferencia",rateSource:"paga"},
 {personId:"person-2",start,end,assignedByName:"Supervisor B",
  rateAmount:5000,rateUnit:"jornada",paymentMethod:"efectivo"}]}],
 settings:{pagaRates:[{role:"Secreto",values:[100,200,300]}],
 projectOvertime:{demo:{mode:"tarifa_hora",hourlyRate:300}}}};
const projected=projectStaffView({id:"person-1",name:"Integrante A"},board);
assert.equal(projected.events[0].staff[0].assignedByName,"Supervisor A");
for(const secret of ["rateAmount","rateUnit","paymentMethod","rateSource",
 "pagaRates","projectOvertime","5000","Secreto","Supervisor B"]){
 assert.ok(!JSON.stringify(projected).includes(secret),"Staff no ve dato económico: "+secret);
}
const html=readFileSync("operaciones/index.html","utf8");
const staffHtml=readFileSync("operaciones/visor.html","utf8");
const cloud=readFileSync("operaciones/cloud-v4.js","utf8");
const staff=readFileSync("operaciones/jornadas-live.js","utf8");
for(const item of ["Tabulador interno · PAGA","Importar / actualizar hoja PAGA",
 "data-paga-choice","ev-overtime-mode","PDF para Solicitudes de Pagos",
 "Exportar pagos CSV","Pago pactado:","Tarifa interna por hora"]){
 assert.ok(!html.includes(item),"Eliminar económica de coordinación: "+item);
}
assert.ok(html.includes("Validación de jornadas"));
assert.ok(html.includes("data-action=\"validate-hours\""));
assert.ok(!html.includes("data-action=\"mark-paid\""));
assert.ok(!html.includes("data-action=\"schedule-pay\""));
assert.ok(staffHtml.includes("Validación de horas"));
assert.ok(staffHtml.includes("no hay tarifas")||staffHtml.includes("No hay tarifas"));
assert.ok(!staffHtml.includes("Descargar resumen PDF"));
assert.ok(staff.includes("Confirmo mis horas y las envío a coordinación"));
assert.ok(cloud.includes("reviewAttendance"));
assert.ok(!cloud.includes("downloadCoordinatorReceipt"));
console.log("OK: aprobación de horas basada en Firebase y pantallas sin economía ni descargas.");
