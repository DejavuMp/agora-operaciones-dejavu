import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const html=readFileSync("operaciones/index.html","utf8");
const cloud=readFileSync("operaciones/cloud-v4.js","utf8");
const staff=readFileSync("operaciones/jornadas-live.js","utf8");
const visor=readFileSync("operaciones/visor.html","utf8");
assert.match(cloud,/where\("startedAt",">=",new Date\(Date\.now\(\)-48\*3600000\)\)/,
  "Coordinación consulta jornadas recientes, incluidas las terminadas");
assert.match(cloud,/where\("status","==","en_descanso"\)/,"Se escuchan descansos en curso");
assert.match(cloud,/where\("status","==","en_ruta"\)/,"Se escuchan traslados en curso");
assert.match(cloud,/reviewAttendance/,"Coordinación valida horas oficiales");
assert.doesNotMatch(cloud,/downloadCoordinatorReceipt/,"No se exportan archivos para Pagos");
assert.doesNotMatch(html,/data-action="receipt-pdf"/,"No se ofrecen PDF económicos");
assert.match(staff,/Confirmo mis horas y las envío a coordinación/,"Staff confirma horas");
assert.match(visor,/Validación de horas/,"Staff solo ve validación operativa");
const start=html.indexOf("function opsPresenceRows("),end=html.indexOf("function renderLiveDashboard(){",start);
assert.ok(start>0&&end>start);
const logic=html.slice(start,end);
const now=new Date("2026-11-18T12:00:00Z").getTime();
const users=[1,2,3,4,5,6,7].map(n=>({id:"p"+n,name:"Prueba "+n,authUid:n===6?"":"staff"+n}));
const activity={
 id:"evt",title:"Volanteo QA",status:"confirmado",region:"CDMX Norte",
 start:"2026-11-18T09:00:00",end:"2026-11-18T18:00:00",
 staff:users.map((u,i)=>({personId:u.id,start:i===6?"2026-11-18T15:00:00":"2026-11-18T09:00:00"}))
};
const db={people:users,events:[activity]};
const clocks=[
 {eventId:"evt",personId:"p1",ownerUid:"staff1",status:"en_curso"},
 {eventId:"evt",personId:"p2",ownerUid:"staff2",status:"en_curso"},
 {eventId:"evt",personId:"p4",ownerUid:"staff4",status:"finalizada"}
];
const breaks=[{personId:"p1",eventId:"evt",status:"en_descanso"}];
const trips=[{personId:"p3",eventId:"evt",status:"en_ruta"}];
const getPerson=id=>users.find(x=>x.id===id);
const startOfDay=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate());
const plusDays=(d,n)=>new Date(d.getTime()+n*86400000);
const isoLocal=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")+"T"+String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0");
const dateMs=d=>new Date(d).getTime();
const overlap=(a,b,c,d)=>dateMs(a)<dateMs(d)&&dateMs(c)<dateMs(b);
const run=new Function("db","liveClocks","liveBreaks","liveTrips","getPerson","startOfDay","plusDays",
 "isoLocal","overlap","dateMs","eventRegion","liveCoordinates","now",
 logic+"; return opsPresenceRows(now)");
const rows=run(db,clocks,breaks,trips,getPerson,startOfDay,plusDays,isoLocal,overlap,dateMs,
e=>e.region,()=>null,now);
assert.equal(rows.length,7,"Todos los integrantes asignados están visibles, no solo los activos");
for(const [person,expected] of [["p1","descanso"],["p2","trabajando"],["p3","traslado"],
 ["p4","finalizado"],["p5","sin_entrada"],["p6","sin_cuenta"],["p7","programado"]]){
 assert.equal(rows.find(x=>x.personId===person)?.code,expected,person+" status");
}
const renderStart=html.indexOf("function opsPresenceRows("),
  renderEnd=html.indexOf("function renderOpsBoard(){",renderStart);
const renderSource=html.slice(renderStart,renderEnd);
const renderPanel=new Function("db","liveClocks","liveBreaks","liveTrips","getPerson",
 "startOfDay","plusDays","isoLocal","overlap","dateMs","eventRegion","liveCoordinates",
 "ui","esc","getSite",renderSource+";return renderLiveDashboard()");
const panel=renderPanel(db,clocks,breaks,trips,getPerson,startOfDay,plusDays,isoLocal,overlap,
  dateMs,e=>e.region,()=>null,{role:"coordinador"},s=>String(s),()=>null);
for(const label of ["Trabajando","En descanso","En traslado","Sin entrada","Jornada terminada","Programado"]){
  assert.ok(panel.includes(label),"El dashboard muestra estado "+label);
}
console.log("OK: presencia por estado y validación de horas sin pagos.");
