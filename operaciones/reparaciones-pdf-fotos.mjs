/** PDF privado de solicitud general, con fotos, ajustes y estados de cada arreglo.
 * Las fotos se recuperan por permisos Firebase (sin exponer links de Storage).
 * Nunca publica imágenes ni copia documentos a terceros.
 */
const T=v=>String(v??"").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,"").trim();
const money=v=>Number.isFinite(Number(v))?Number(v).toLocaleString("es-MX",{minimumFractionDigits:2,maximumFractionDigits:2}):"0.00";
export async function buildRepairsPhotoPdf({jsPDF,group,url,readPhoto,qrCanvas}){
 if(!jsPDF||!group?.items?.length||typeof readPhoto!=="function")throw Error("Solicitud general o generador PDF no disponible");
 const pdf=new jsPDF({unit:"mm",format:"a4"}),PW=210,PH=297,M=17,CW=176;
 let y=22,readErrors=0,embedded=0;
 const red=[194,20,36],dark=[26,28,32],muted=[91,98,104];
 pdf.setProperties?.({title:"ÁGORA - Solicitud general de reparaciones - "+T(group.project),
  subject:"Folio general "+T(group.id)+" - Evidencia, ajustes, cotizaciones y seguimiento",
  author:"Dejavú Marketing"});
 function ink(rgb=dark){pdf.setTextColor(...rgb);}
 function drawHeader(first=false){
  pdf.setFillColor(...red);pdf.rect(0,0,PW,3,"F");
  ink(dark);pdf.setFont("helvetica","bold");pdf.setFontSize(12);
  pdf.text("DEJAVÚ  /  ÁGORA OPERACIONES",M,12);
  pdf.setFont("helvetica","normal");pdf.setFontSize(8);ink(muted);
  pdf.text(first?"SOLICITUD GENERAL DE REPARACIONES":"EVIDENCIAS Y AJUSTES · CONTINUACIÓN",PW-M,12,{align:"right"});
  pdf.setDrawColor(221,225,228);pdf.line(M,16,PW-M,16);
 }
 drawHeader(true);
 function ensure(height){
  if(y+height>PH-21){
   pdf.addPage();drawHeader();y=24;
  }
 }
 function paragraph(label,value,{color=dark,maxHeight=Infinity}={}){
  const body=T(value)||"Pendiente de completar";
  const lines=pdf.splitTextToSize(body,CW-4);
  ensure(8);
  pdf.setFont("helvetica","bold");pdf.setFontSize(8.7);ink(red);
  pdf.text(label,M,y);y+=5.5;
  pdf.setFont("helvetica","normal");pdf.setFontSize(9);ink(color);
  for(const line of lines){
   ensure(4.8);pdf.text(line,M,y);y+=4.8;
  }
  y+=3;
 }
 function rule(){
  ensure(4);
  pdf.setDrawColor(223,225,228);pdf.line(M,y,PW-M,y);y+=6;
 }
 function row(textValue,{strong=false}={}){
  const lines=pdf.splitTextToSize(T(textValue)||"Pendiente",CW);
  for(const line of lines){
   ensure(5);pdf.setFont("helvetica",strong?"bold":"normal");
   pdf.setFontSize(9);ink(dark);pdf.text(line,M,y);y+=5;
  }
 }
 function photoCard(item,column,rowY,photo){
  const cardW=85,cardX=M+column*91,cardY=rowY;
  pdf.setDrawColor(225,226,228);pdf.setFillColor(247,248,249);
  pdf.roundedRect(cardX,cardY,cardW,76,2,2,"FD");
  pdf.setFillColor(255,255,255);pdf.rect(cardX+2,cardY+2,cardW-4,60,"F");
  let ok=false;
  if(photo&&photo.startsWith("data:image/jpeg;base64,")){
   try{
    const prop=pdf.getImageProperties(photo);
    const maxW=cardW-6,maxH=58;
    const scale=Math.min(maxW/prop.width,maxH/prop.height);
    const w=prop.width*scale,h=prop.height*scale;
    pdf.addImage(photo,"JPEG",cardX+(cardW-w)/2,cardY+3+(58-h)/2,w,h);
    ok=true;embedded++;
   }catch{readErrors++;}
  }
  if(!ok){
   ink(muted);pdf.setFont("helvetica","normal");pdf.setFontSize(8);
   pdf.text("Fotografía no disponible",cardX+cardW/2,cardY+33,{align:"center"});
  }
  pdf.setFont("helvetica","bold");pdf.setFontSize(7.8);ink(dark);
  const stage=T(item.stage||"Evidencia").toUpperCase();
  pdf.text(stage,cardX+3,cardY+66);
  const caption=T(item.label||"Imagen asociada a la reparación");
  pdf.setFont("helvetica","normal");pdf.setFontSize(7);ink(muted);
  const line=pdf.splitTextToSize(caption,cardW-6)[0]||"";
  pdf.text(line.slice(0,92),cardX+3,cardY+73);
 }
 const nums=group.items.length;
 ink(dark);pdf.setFontSize(17);pdf.setFont("helvetica","bold");
 const projectLines=pdf.splitTextToSize(T(group.project),CW);
 for(const line of projectLines){ensure(8);pdf.text(line,M,y);y+=8;}
 pdf.setFont("helvetica","normal");pdf.setFontSize(10);ink(muted);
 row("Stand / equipo: "+T(group.asset));
 row("Folio general: "+T(group.id));
 row("Total de arreglos: "+nums+" | Fotos registradas: "+
  group.items.reduce((acc,r)=>acc+(r.photos?.length||0),0));
 rule();
 for(const [idx,r] of group.items.entries()){
  ensure(22);
  pdf.setFillColor(243,244,245);pdf.roundedRect(M,y-4,CW,13,2,2,"F");
  pdf.setFont("helvetica","bold");pdf.setFontSize(11);ink(dark);
  const heading=(idx+1)+". "+T(r.area||"Arreglo sin área");
  pdf.text(pdf.splitTextToSize(heading,CW-8)[0].slice(0,130),M+4,y+4.5);
  y+=15;
  row("Estado: "+T(r.status||"Pendiente")+"  |  Prioridad: "+T(r.priority||"Normal"));
  row("Responsable: "+T(r.assignedTo||"Por asignar")+"  |  Ruta: "+T(r.repairRoute||"Por definir"));
  row("Fecha requerida: "+T(r.dueDate||"Por definir")+"  |  Costo estimado: $"+money(r.estimatedCost)+" MXN");
  y+=2;
  paragraph("PROBLEMA OBSERVADO",r.problem);
  const instr=r.solutionMode==="propuesta"
   ?"Se requiere propuesta de solución. "+T(r.instructions||"")
   :T(r.instructions);
  paragraph("AJUSTE / REPARACIÓN PROPUESTA",instr||"Pendiente de definir tras inspección física");
  if(r.cause)paragraph("CAUSA DOCUMENTADA",r.cause);
  if(r.decisionNote)paragraph("OBSERVACIONES DE COORDINACIÓN",r.decisionNote);
  if(r.quotes?.length){
   paragraph("COTIZACIONES",r.quotes.map(q=>
    T(q.provider)+": $"+money(q.amount)+" MXN"+
    (q.id===r.selectedQuoteId?" (seleccionada)":"")+
    (q.scope?" - "+T(q.scope):"")).join("\n"));
  }
  if(r.materialLink)paragraph("VÍNCULO DE MATERIALES",r.materialLink);
  const photos=Array.isArray(r.photos)?r.photos:[];
  if(photos.length){
   ensure(10);pdf.setFont("helvetica","bold");pdf.setFontSize(9);ink(red);
   pdf.text("EVIDENCIA FOTOGRÁFICA  ("+photos.length+")",M,y);y+=7;
   for(let i=0;i<photos.length;i+=2){
    ensure(81);
    const src=photos.slice(i,i+2);
    // Leer las evidencias una a una para no conservar todas las imágenes en memoria.
    for(let j=0;j<src.length;j++){
     let data=null;
     try{data=await readPhoto(src[j].path);}catch{readErrors++;}
     photoCard(src[j],j,y,data);
    }
    y+=81;
   }
  }else{
   paragraph("EVIDENCIAS","Este concepto todavía no tiene fotografías cargadas en ÁGORA.",{color:muted});
  }
  rule();
 }
 ensure(38);
 pdf.setFont("helvetica","bold");pdf.setFontSize(9);ink(red);
 pdf.text("CONSULTA PRIVADA DE LA SOLICITUD",M,y);y+=6;
 pdf.setFont("helvetica","normal");pdf.setFontSize(8);ink(muted);
 for(const line of pdf.splitTextToSize(url,CW)){
  ensure(5);
  pdf.text(line,M,y);pdf.link(M,y-4,CW,5,{url});y+=5;
 }
 if(qrCanvas){
  ensure(31);
  try{pdf.addImage(qrCanvas.toDataURL("image/png"),"PNG",M,y,29,29);y+=32;}catch{ /* QR opcional */ }
 }
 const totalPages=pdf.getNumberOfPages();
 for(let i=1;i<=totalPages;i++){
  pdf.setPage(i);pdf.setDrawColor(226,228,229);pdf.line(M,281,PW-M,281);
  pdf.setFont("helvetica","normal");pdf.setFontSize(7.5);ink(muted);
  pdf.text("Dejavú Marketing · Uso interno · Folio "+String(group.id).slice(0,8),M,286);
  pdf.text(i+" / "+totalPages,PW-M,286,{align:"right"});
 }
 return {pdf,embedded,readErrors,totalPages};
}
