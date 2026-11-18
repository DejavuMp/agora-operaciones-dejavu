/**
 * Exportación local de comprobantes de ÁGORA para adjuntar a Solicitudes de Recursos y Pagos.
 * No envía datos personales al CDN ni al sistema de pagos. El navegador produce el PDF.
 * Los importes no se aprueban ni transfieren desde esta función.
 */
export const JSPDF_URL="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js";
export const PDF_DISCLAIMER="Comprobante operativo para revisión. No equivale a CFDI, nómina, autorización de pago ni transferencia.";
let jsPdfPromise=null;
export function pdfFileName(folio,kind="jornada"){
  const safe=String(folio||"SIN-FOLIO").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-zA-Z0-9_-]+/g,"_").slice(0,75);
  return "AGORA_"+(kind==="mes"?"Resumen":"Jornada")+"_"+safe+".pdf";
}
function sanitize(value){
  return String(value??"").replace(/[\u0000-\u001f]+/g," ").trim().slice(0,1200);
}
export function receiptPdfRows(data){
  if(!data?.folio||!data?.name||!data?.officialStart||!data?.officialEnd)
    throw Error("Faltan los datos del comprobante oficial.");
  const rows=[
    ["Folio",data.folio],["Integrante",data.name],["Actividad",data.activity],
    ["Modalidad",data.type],["Campaña / proyecto",data.campaign],
    ["Asignado por",data.assignedByName],["Pago base acordado",data.agreedBase],
    ["Tarifa acordada",data.agreedRate],["Forma de pago",data.paymentMethod],
    ["Horas extras del proyecto",data.overtimeRate],["Estimación de horas extras (por validar)",data.overtimeEstimate],
    ["Sucursal / sede",data.site],["Entrada registrada",data.officialStart],
    ["Salida registrada",data.officialEnd],["Horas programadas",data.planned],
    ["Tiempo transcurrido",data.gross],["Descanso",data.rest],
    ["Horas netas",data.net],["Horas extra por revisar",data.overtime],
    ["Horas validadas",data.validatedHours||"Pendientes de revisión"],
    ["Estado del reporte",data.status],["Observaciones",data.notes||"Sin observaciones"]
  ];
  return rows.map(([label,value])=>[sanitize(label),sanitize(value)]);
}
export function monthlyPdfRows(report){
  if(!report?.month||!Array.isArray(report.rows))throw Error("No hay resumen mensual válido.");
  return report.rows.map(row=>[
    sanitize(row.day),sanitize(row.activity),sanitize(row.site),
    sanitize((Number(row.netMinutes||0)/60).toFixed(2)+" h"),
    sanitize(row.status)
  ]);
}
async function constructorFromCdn(){
  if(typeof window==="undefined"||typeof document==="undefined")throw Error("Esta descarga requiere un navegador.");
  if(window.jspdf?.jsPDF)return window.jspdf.jsPDF;
  if(jsPdfPromise)return jsPdfPromise;
  jsPdfPromise=new Promise((resolve,reject)=>{
    const script=document.createElement("script");
    script.src=JSPDF_URL;script.async=true;script.crossOrigin="anonymous";script.referrerPolicy="no-referrer";
    script.onload=()=>window.jspdf?.jsPDF?resolve(window.jspdf.jsPDF):reject(Error("El generador PDF no está disponible."));
    script.onerror=()=>reject(Error("No se pudo cargar el generador PDF gratuito. Usa la opción «Guardar como PDF» del navegador."));
    document.head.appendChild(script);
  }).catch(err=>{jsPdfPromise=null;throw err});
  return jsPdfPromise;
}
function createDocument(PdfCtor,heading,subheading,folio){
  const pdf=new PdfCtor({orientation:"portrait",unit:"mm",format:"a4",compress:true});
  pdf.setProperties({title:heading+" - "+folio,author:"Dejavú Marketing",subject:"Registro operativo ÁGORA"});
  pdf.setFillColor(32,34,37);pdf.rect(0,0,210,39,"F");
  pdf.setTextColor(255,255,255);pdf.setFont("helvetica","bold");pdf.setFontSize(10);
  pdf.text("DEJAVU MARKETING  /  AGORA OPERACIONES",16,14);
  pdf.setFontSize(18);pdf.text(heading,16,26);
  pdf.setFontSize(9);pdf.setFont("helvetica","normal");pdf.text(subheading,16,34);
  pdf.setTextColor(32,34,37);
  return pdf;
}
function paintFooter(pdf){
  const count=pdf.internal.getNumberOfPages();
  for(let page=1;page<=count;page++){
    pdf.setPage(page);pdf.setDrawColor(217,217,217);pdf.line(16,277,194,277);
    pdf.setFont("helvetica","normal");pdf.setFontSize(7.7);pdf.setTextColor(88,92,98);
    const notice=pdf.splitTextToSize(PDF_DISCLAIMER,157);
    pdf.text(notice,16,283);
    pdf.text(page+" / "+count,194,283,{align:"right"});
  }
}
export async function downloadReceiptPdf(data,{PdfClass}={}){
  const rows=receiptPdfRows(data);
  const PdfCtor=PdfClass||await constructorFromCdn();
  const pdf=createDocument(PdfCtor,"Comprobante de jornada","Documento para adjuntar a una solicitud de pago",sanitize(data.folio));
  let y=48;
  for(const [label,value] of rows){
    pdf.setFont("helvetica","normal");pdf.setFontSize(10);
    const lines=pdf.splitTextToSize(value||"-",117);
    const h=Math.max(10,lines.length*5+4);
    if(y+h>270){pdf.addPage();y=19}
    pdf.setTextColor(102,107,112);pdf.setFont("helvetica","normal");pdf.text(label,16,y+4);
    pdf.setTextColor(31,33,35);pdf.setFont("helvetica","bold");
    pdf.text(lines.length?lines:["-"],75,y+4);
    pdf.setDrawColor(231,231,229);pdf.line(16,y+h-1,194,y+h-1);
    y+=h;
  }
  paintFooter(pdf);
  const filename=pdfFileName(data.folio);
  pdf.save(filename);
  return filename;
}
export async function downloadMonthlyPdf(report,{PdfClass}={}){
  const rows=monthlyPdfRows(report);
  const PdfCtor=PdfClass||await constructorFromCdn();
  const pdf=createDocument(PdfCtor,"Resumen de jornadas","Periodo "+sanitize(report.month),sanitize(report.month));
  let y=47;
  const line=(title,value)=>{
    if(y+8>267){pdf.addPage();y=18}
    pdf.setTextColor(85,90,95);pdf.setFontSize(10);pdf.setFont("helvetica","normal");
    pdf.text(title,16,y);
    pdf.setTextColor(31,33,35);pdf.setFont("helvetica","bold");
    pdf.text(sanitize(value),194,y,{align:"right"});
    y+=9;
  };
  line("Integrante",sanitize(report.staffName));
  line("Jornadas registradas",String(report.activityCount||0));
  line("Días distintos",String(report.dayCount||0));
  line("Horas netas",((Number(report.total?.netMinutes||0))/60).toFixed(2)+" h");
  line("Descanso total",String(report.total?.breakMinutes||0)+" min");
  line("Excedente por revisar",((Number(report.total?.overtimeCandidateMinutes||0))/60).toFixed(2)+" h");
  y+=6;pdf.setFont("helvetica","bold");pdf.setFontSize(12);pdf.text("Detalle de actividades",16,y);y+=8;
  for(const [day,activity,site,net,status] of rows){
    pdf.setFontSize(9);pdf.setFont("helvetica","normal");
    const activityLines=pdf.splitTextToSize(activity+" / "+site,110);
    const h=Math.max(13,activityLines.length*4.7+5);
    if(y+h>267){pdf.addPage();y=19}
    pdf.text(day,16,y+3);
    pdf.text(activityLines,47,y+3);
    pdf.text(net,161,y+3);
    pdf.text(pdf.splitTextToSize(status,17).slice(0,2),177,y+3);
    pdf.setDrawColor(235,235,235);pdf.line(16,y+h-1,194,y+h-1);
    y+=h;
  }
  paintFooter(pdf);
  const filename=pdfFileName(report.month,"mes");
  pdf.save(filename);
  return filename;
}
