import assert from "node:assert/strict";
import {parsePagaRows,pagaOptions,getPagaOption,normalizeTerms,agreedAmount,projectKey,
  overtimePolicy,createOvertimePolicy,methodName} from "../ops-paga.mjs";
import {projectStaffView,projectViewerView} from "../ops-safe-view.mjs";
import {receiptData} from "../ops-receipt.mjs";
import {readFileSync} from "node:fs";

const fakePaga=[
  ["Puesto","6hrs","9hrs","12hrs"],
  ["Montaje de prueba",321,432,543],
  ["Brigada de prueba",210,"",430],
  ["Sin tarifa",null,null,null],
  ["Montaje de prueba",999,999,999]
];
const options=parsePagaRows(fakePaga);
assert.equal(options.length,2);
assert.equal(pagaOptions(options).length,5);
const choice=pagaOptions(options).find(x=>x.role==="Montaje de prueba"&&x.hours===9);
assert.equal(choice.amount,432);
assert.equal(getPagaOption(options,choice.key).amount,432);
assert.equal(getPagaOption(options,"desconocido"),null);
assert.throws(()=>parsePagaRows([["Puesto","6hrs"],["Cliente",999]]),/6hrs/);
assert.throws(()=>parsePagaRows([]),/Puesto/);
const terms=normalizeTerms({rateSource:"paga",rateReference:choice.key,rateUnit:"jornada",
  rateAmount:choice.amount,paymentMethod:"transferencia"});
assert.equal(agreedAmount({...terms,start:"2026-11-18T10:00",end:"2026-11-18T19:00"}),432);
assert.equal(agreedAmount({rateUnit:"hora",rateAmount:100,start:"2026-11-18T10:00",end:"2026-11-18T13:00"}),300);
assert.equal(methodName("efectivo"),"Efectivo");
assert.throws(()=>normalizeTerms({rateSource:"paga",rateAmount:Infinity}),/rango/);
assert.equal(projectKey("  Lanzamiento CDMX  "),"lanzamiento cdmx");
assert.deepEqual(createOvertimePolicy("tarifa_hora",88),{mode:"tarifa_hora",hourlyRate:88});
assert.throws(()=>createOvertimePolicy("tarifa_hora",0),/tarifa/);
const projectOvertime={["lanzamiento cdmx"]:{mode:"tarifa_hora",hourlyRate:88}};
assert.equal(overtimePolicy({projectOvertime},"LANZAMIENTO CDMX").hourlyRate,88);
assert.equal(overtimePolicy({projectOvertime},"Proyecto distinto").hourlyRate,null);
const own={personId:"p1",start:"2026-11-18T09:00:00-06:00",end:"2026-11-18T18:00:00-06:00",
  ...terms,assignedByName:"Coordinación de prueba",assignedAt:"2026-11-17T10:00:00Z"};
const another={...own,personId:"p2",rateAmount:999999,
  assignedByName:"OTRO RESPONSABLE"};
const event={
  id:"ev1",title:"Proyecto de prueba",project:"Lanzamiento CDMX",
  start:"2026-11-18T09:00:00-06:00",end:"2026-11-18T18:00:00-06:00",
  staff:[own,another],status:"confirmado",workMode:"jornada_activaciones"};
const board={events:[event],people:[],sites:[],vehicles:[],
  settings:{pagaRates:options,projectOvertime,dailyLimit:8}};
const personal=projectStaffView({id:"p1",name:"Mi nombre"},board);
assert.equal(personal.events[0].staff.length,1);
assert.equal(personal.events[0].staff[0].assignedByName,own.assignedByName);
assert.equal(personal.events[0].staff[0].rateAmount,432);
assert.equal(personal.events[0].staff[0].paymentMethod,"transferencia");
assert.equal(personal.events[0].overtimePolicy.hourlyRate,88);
assert.ok(!JSON.stringify(personal).includes("999999"),"No divulga el sueldo ajeno");
assert.ok(!JSON.stringify(personal).includes("OTRO RESPONSABLE"),"No divulga el asignador de otra persona");
assert.ok(!JSON.stringify(personal).includes("pagaRates"),"No entrega catálogo completo");
const viewer=projectViewerView(board);
assert.ok(!JSON.stringify(viewer).includes("432"),"El visor general no muestra montos");
assert.ok(!JSON.stringify(viewer).includes("88"),"El visor general no muestra tarifa extra");
const clock={status:"finalizada",startedAt:new Date("2026-11-18T09:01:00-06:00"),
  endedAt:new Date("2026-11-18T19:01:00-06:00")};
const info=receiptData({log:{id:"L1",eventId:"ev1",personId:"p1",paymentStatus:"capturado",breakMins:20},
  event:personal.events[0],clock,person:{id:"p1",name:"Mi nombre"},personId:"p1"});
assert.equal(info.assignedByName,"Coordinación de prueba");
assert.equal(info.agreedBase,"$432.00");
assert.equal(info.paymentMethod,"Transferencia");
assert.match(info.overtimeRate,/88/);
const html=readFileSync("operaciones/index.html","utf8");
assert.match(html,/data-paga-choice/);
assert.match(html,/ev-overtime-mode/);
assert.match(html,/importPagaWorkbook/);
assert.match(html,/book\.SheetNames\.find\(n=>n\.trim\(\)\.toLowerCase\(\)==='paga'\)/);
assert.ok(!html.includes("Montaje de prueba"),"El HTML no incluye un catálogo precargado");
console.log("OK: PAGA importable, selección protegida, responsable por asignación y horas extra por proyecto.");
