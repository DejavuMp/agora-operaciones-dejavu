import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {buildRepairsPhotoPdf} from "../reparaciones-pdf-fotos.mjs";
class FakePdf {
 constructor(){this.pages=1;this.currentPage=1;this.images=[];this.written=[];this.links=[];}
 setProperties(x){this.properties=x;}
 setFillColor(){} rect(){} setTextColor(){} setFont(){} setFontSize(){} setDrawColor(){}
 line(){} roundedRect(){}
 text(s){this.written.push(String(s));}
 splitTextToSize(s,max){return String(s).split(/\n/).flatMap(line=>{
  const list=[];for(let i=0;i<line.length;i+=110)list.push(line.slice(i,i+110));
  return list.length?list:[""];
 });}
 getImageProperties(){return {width:900,height:650};}
 addImage(...args){this.images.push(args);}
 addPage(){this.pages++;}
 getNumberOfPages(){return this.pages;}
 setPage(n){this.currentPage=n;}
 link(...a){this.links.push(a);}
}
const id="0bc8b614-99ea-5822-b91e-6e0ea766822e";
const rows=[
 {id:"a1",area:"Puerta",status:"pendiente",priority:"Alta",dueDate:"2026-12-05",
  problem:"Revisar bisagras",instructions:"Ajustar tope y validar acceso",solutionMode:"instrucciones",
  assignedTo:"Por asignar",repairRoute:"agencia",estimatedCost:0,
  photos:[{path:"firestore:ok1",stage:"antes",label:"bisagra.jpg"},
   {path:"firestore:ok2",stage:"avance",label:"puerta.jpg"}],quotes:[]},
 {id:"a2",area:"Gráficos de vinil",status:"cotizando",priority:"Normal",
  problem:"Desgaste visible",instructions:"Reponer vinil sin modificar logo",solutionMode:"propuesta",
  photos:[{path:"firestore:missing",stage:"antes",label:"esquina.jpg"}],
  quotes:[{provider:"Proveedor de prueba",amount:1200,scope:"Reemplazo parcial"}]}
];
test("PDF multipágina de una solicitud general con imágenes, ajustes y cotizaciones",async()=>{
 const group={id,project:"Hot Cruji Bravo",asset:"Stand Modo Bravo",items:rows};
 const calls=[];
 const result=await buildRepairsPhotoPdf({
  jsPDF:FakePdf,group,url:"https://example.org/privado",
  readPhoto:async(path)=>{
   calls.push(path);
   if(path==="firestore:missing")throw Error("Sin permiso");
   return "data:image/jpeg;base64,/9j/2Q==";
  }
 });
 assert.equal(result.embedded,2);
 assert.equal(result.readErrors,1);
 assert.equal(result.totalPages,result.pdf.getNumberOfPages());
 assert.deepEqual(calls,["firestore:ok1","firestore:ok2","firestore:missing"]);
 const text=result.pdf.written.join(" ");
 for(const expected of ["Hot Cruji Bravo","Puerta","Revisar bisagras",
  "Ajustar tope","Gráficos de vinil","Reponer vinil","Proveedor de prueba",
  "SOLICITUD GENERAL","bisagra.jpg","puerta.jpg"]){
  assert.ok(text.includes(expected),"Falta en PDF: "+expected);
 }
 assert.ok(result.pdf.links.length>0);
 assert.ok(result.pdf.images.length===2);
});
test("PDF no usa Storage, imágenes públicas ni URLs de fotos",()=>{
 const base=fileURLToPath(new URL("../",import.meta.url));
 const src=readFileSync(base+"reparaciones-pdf-fotos.mjs","utf8");
 const ui=readFileSync(base+"reparaciones.js","utf8");
 assert.doesNotMatch(src,/getDownloadURL|uploadBytes|getStorage|localStorage|fetch\(/);
 assert.match(ui,/readPhoto:getSparkPhoto/);
 assert.match(ui,/PDF con fotos y ajustes/);
 assert.match(ui,/await buildRepairsPhotoPdf/);
});
test("Rechaza crear PDFs sin acceso a solicitud general",async()=>{
 await assert.rejects(buildRepairsPhotoPdf({jsPDF:FakePdf,group:{items:[]},readPhoto:async()=>""}),
  /no disponible/);
});
