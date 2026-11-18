import assert from "node:assert/strict";
import {receiptData} from "../ops-receipt.mjs";
import {downloadReceiptPdf,downloadMonthlyPdf,pdfFileName,receiptPdfRows,monthlyPdfRows,
  PDF_DISCLAIMER,JSPDF_URL} from "../ops-pdf-download.mjs";

class FakePDF {
  static last;
  constructor(){FakePDF.last=this;this.pages=1;this.texts=[];this.saved="";
    this.internal={getNumberOfPages:()=>this.pages};}
  setProperties(){return this}
  setFillColor(){return this}
  rect(){return this}
  setTextColor(){return this}
  setFont(){return this}
  setFontSize(){return this}
  setDrawColor(){return this}
  line(){return this}
  addPage(){this.pages++;return this}
  setPage(){return this}
  splitTextToSize(value,max){return String(value||"").match(new RegExp(".{1,"+Math.max(1,Math.floor(max/3))+"}","g"))||[""]}
  text(value){this.texts.push(...(Array.isArray(value)?value:[String(value)]));return this}
  save(name){this.saved=name;return this}
}
const event={id:"ejemplo",title:"Volanteo QA",workMode:"actividad_horas",
  venueName:"Sucursal de prueba",campaign:"Campaña demostración",
  start:"2026-11-18T10:00:00-06:00",end:"2026-11-18T16:00:00-06:00",
  staff:[{personId:"p1",start:"2026-11-18T09:30:00-06:00",end:"2026-11-18T16:30:00-06:00"}]};
const clock={status:"finalizada",startedAt:new Date("2026-11-18T09:31:00-06:00"),
  endedAt:new Date("2026-11-18T16:34:00-06:00"),lastGeo:{lat:19.3,lng:-99.1},
  endGeo:{lat:19.31,lng:-99.11}};
const person={id:"p1",name:"Integrante de prueba"};
const log={id:"LOG1",ownerUid:"uid1",personId:"p1",eventId:"ejemplo",breakMins:15,
  paymentStatus:"solicitado",notes:"Actividad registrada; pendiente de revisión."};
const info=receiptData({log,event,clock,person,personId:"p1"});
assert.match(JSPDF_URL,/^https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/jspdf\/2\.5\.2\/jspdf\.umd\.min\.js$/);
const fields=receiptPdfRows(info);
assert.ok(fields.some(([title,value])=>title==="Integrante"&&value===person.name));
assert.ok(fields.some(([title,value])=>title==="Horas netas"&&value.includes("h")));
assert.ok(!JSON.stringify(fields).includes("19.3"),"PDF no contiene coordenadas");
assert.ok(!JSON.stringify(fields).includes("bank"),"PDF no contiene datos bancarios");
assert.match(PDF_DISCLAIMER,/No equivale a CFDI/);
const filename=await downloadReceiptPdf(info,{PdfClass:FakePDF});
assert.match(filename,/^AGORA_Jornada_AGO-.*\.pdf$/);
assert.equal(FakePDF.last.saved,filename);
assert.ok(FakePDF.last.texts.some(x=>x.includes(person.name)),"Comprobante muestra nombre");
assert.ok(FakePDF.last.texts.some(x=>x.includes("Solicitudes")||x.includes("solicitud")),"Incluye destino del comprobante");
assert.equal(pdfFileName("AGO/2026: QA"),"AGORA_Jornada_AGO_2026_QA.pdf");

const report={month:"2026-11",staffName:person.name,activityCount:1,dayCount:1,
  rows:[{day:"2026-11-18",activity:"Volanteo QA",site:"Sucursal prueba",
    netMinutes:360,status:"capturado"}],
  total:{netMinutes:360,breakMinutes:15,overtimeCandidateMinutes:0}};
const monthRows=monthlyPdfRows(report);
assert.equal(monthRows[0][3],"6.00 h");
const monthFile=await downloadMonthlyPdf(report,{PdfClass:FakePDF});
assert.equal(monthFile,"AGORA_Resumen_2026-11.pdf");
assert.equal(FakePDF.last.saved,monthFile);
assert.ok(FakePDF.last.texts.some(x=>x.includes("Volanteo QA")));
assert.throws(()=>receiptPdfRows({}),/Faltan/);
assert.throws(()=>monthlyPdfRows({month:"2026-11"}),/resumen/);
console.log("OK: comprobantes PDF locales sin GPS ni banca; descarga individual y mensual.");
