/** Catálogo PAGA y acuerdos individuales, nunca incluir tarifas VENDE.
 * El catálogo se importa por un coordinador y se guarda en Firestore protegido.
 * No contiene tarifas precargadas: el repositorio y GitHub Pages son públicos.
 */
export const SOURCE_LABEL="TABULADOR OFICIAL DVM.xlsx · PAGA";
const allowedHours=[6,9,12];
const money=n=>typeof n==="number"&&Number.isFinite(n)?Math.round(n*100)/100:null;
export const projectKey=name=>String(name||"").trim().normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("es-MX");
export function parsePagaRows(matrix){
  if(!Array.isArray(matrix))throw Error("La hoja PAGA no contiene filas válidas.");
  const ix=matrix.findIndex(row=>Array.isArray(row)&&row.some(c=>/^puesto$/i.test(String(c||"").trim())));
  if(ix<0)throw Error("La hoja PAGA no contiene el encabezado Puesto.");
  const header=matrix[ix].map(x=>String(x||"").trim().toLowerCase());
  const roleColumn=header.indexOf("puesto");
  const columns=allowedHours.map(hours=>header.findIndex(c=>c.replace(/\s/g,"").includes(hours+"hr")));
  if(columns.some(c=>c<0))throw Error("La hoja PAGA debe incluir columnas 6hrs, 9hrs y 12hrs.");
  const out=[];
  const seen=new Set();
  for(const row of matrix.slice(ix+1)){
    if(!Array.isArray(row))continue;
    const role=String(row[roleColumn]||"").trim().slice(0,110);
    if(!role||/^total\b/i.test(role)||seen.has(projectKey(role)))continue;
    const amounts=columns.map(j=>{
      const raw=row[j];
      if(raw===""||raw===null||raw===undefined)return null;
      const n=typeof raw==="number"?raw:Number(String(raw).replace(/[$,\s]/g,""));
      return Number.isFinite(n)&&n>0?money(n):null;
    });
    if(amounts.every(a=>a===null))continue;
    seen.add(projectKey(role));
    out.push({role,values:amounts});
  }
  if(!out.length||out.length>150)throw Error("No se identificaron precios PAGA suficientes.");
  return out;
}
export function pagaOptions(rows){
  return (Array.isArray(rows)?rows:[]).flatMap(r=>allowedHours.flatMap((hours,i)=>{
    const value=money(r.values?.[i]);
    return value!==null&&value>0?[{
      key:encodeURIComponent(r.role)+":"+hours,
      role:String(r.role),hours,amount:value
    }]:[];
  }));
}
export function getPagaOption(rows,key){
  return pagaOptions(rows).find(x=>x.key===key)||null;
}
export function normalizeTerms(input){
  const src=String(input?.rateSource||"").trim();
  const unit=input?.rateUnit==="hora"?"hora":"jornada";
  if(input?.rateAmount!==null&&input?.rateAmount!==undefined&&input.rateAmount!==""&&
      !Number.isFinite(Number(input.rateAmount)))throw Error("Importe de tarifa fuera de rango.");
  const amount=money(Number(input?.rateAmount));
  if(!["paga","manual",""].includes(src))throw Error("Origen de tarifa no válido.");
  if(amount!==null&&(amount<0||amount>1000000))throw Error("Importe de tarifa fuera de rango.");
  const pay=input?.paymentMethod;
  if(!["por_definir","transferencia","efectivo","otro",undefined].includes(pay))
    throw Error("Forma de pago no válida.");
  return {
    rateSource:src,rateReference:String(input?.rateReference||"").slice(0,150),
    rateUnit:unit,rateAmount:amount&&amount>0?amount:null,
    paymentMethod:pay||"por_definir"
  };
}
export const methodName=method=>({por_definir:"Por definir",transferencia:"Transferencia",
  efectivo:"Efectivo",otro:"Otra modalidad"})[method]||"Por definir";
export function agreedAmount(terms){
  const n=Number(terms?.rateAmount),start=new Date(terms?.start).getTime(),
    end=new Date(terms?.end).getTime();
  if(!Number.isFinite(n)||n<=0)return null;
  if(terms.rateUnit==="hora"){
    if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return null;
    return money(n*(end-start)/3600000);
  }
  return money(n);
}
export function overtimePolicy(settings,project){
  const key=projectKey(project);
  const row=key?settings?.projectOvertime?.[key]:null;
  return row?.mode==="tarifa_hora"&&Number.isFinite(Number(row.hourlyRate))&&Number(row.hourlyRate)>0?
    {mode:"tarifa_hora",hourlyRate:money(Number(row.hourlyRate))}:{mode:"por_revisar",hourlyRate:null};
}
export function createOvertimePolicy(mode,hourlyRate){
  if(mode==="por_revisar")return {mode,hourlyRate:null};
  const n=money(Number(hourlyRate));
  if(mode!=="tarifa_hora"||n===null||n<=0||n>100000)
    throw Error("Define una tarifa de horas extras válida para este proyecto.");
  return {mode,hourlyRate:n};
}
