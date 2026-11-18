import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const html=readFileSync("operaciones/index.html","utf8");
const cloud=readFileSync("operaciones/cloud-v4.js","utf8");
const projection=readFileSync("operaciones/ops-safe-view.mjs","utf8");
const inline=[...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)]
  .find(([,attributes,content])=>!attributes.includes("src=")&&content.includes("function renderOpsBoard"))?.[2];
assert.ok(inline,"Se encontró el editor de Operaciones");
assert.doesNotThrow(()=>new Function(inline),"Sintaxis JavaScript del editor");
assert.match(inline,/formField\('ev-duration'/,"Duración editable");
assert.match(inline,/type="hidden" id="ev-end"/,"Fin ya no pide doble captura");
assert.match(inline,/formField\('ev-region'/,"Región de texto libre");
assert.match(inline,/formField\('ev-site-name','Sucursal \/ sede \/ lugar \*'/,"La sede es obligatoria");
assert.match(inline,/required maxlength="160" placeholder="Escribe sucursal o lugar"/,"El navegador bloquea sede vacía");
assert.match(inline,/if\(!venueName\)/,"La validación de guardado también bloquea sede vacía");
assert.match(inline,/id="board-region"/,"Filtro regional");
assert.match(inline,/ops-region-header/,"Agrupación regional del cronograma");
assert.match(inline,/renderLiveDashboard/,"Panel de equipo en vivo");
assert.match(inline,/data-action="live-map"/,"Mapa visible solo tras acción de coordinación");
assert.match(inline,/function openLiveMap\(\)/,"Carga explícita del mapa");
assert.match(inline,/function mapPoints\(\)/,"Mapa usa solo GPS reciente");
assert.match(inline,/tile.openstreetmap.org/,"Mapas gratuitos de OSM");

assert.match(cloud,/onSnapshot\(query\(CLOCKLIST,where\("status","==","en_curso"\)\)/,
  "Solo se escucha el marcaje activo");
assert.match(projection,/"campaign","region"/,"Región disponible en la vista personal");
assert.match(projection,/region:str\(/,"Región disponible en el visor");
const extract=(start,end)=> {
  const a=inline.indexOf(start),b=inline.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,start+" disponible");
  return inline.slice(a,b);
};
const timing=extract("function updatePlannedHours(){","function applyAutoStaff(){");
const elements={
  "ev-start":{value:"2026-11-18T08:00"},
  "ev-duration":{value:"6"},
  "ev-end":{value:""},
  "ops-planned-hours":{textContent:""}
};
const calc=new Function("document","read","finiteDate","shifted","fmtDate","fmtTime","fmtHours",
  timing+";updatePlannedHours();");
const deps=[
  {getElementById:id=>elements[id]},
  id=>String(elements[id]?.value??""),
  s=>Number.isFinite(new Date(s).getTime()),
  (s,mins)=>new Date(new Date(s).getTime()+mins*60000).toISOString().slice(0,16),
  s=>s.slice(0,10),
  s=>s.slice(11,16),
  n=>String(n)
];
calc(...deps);
assert.equal(elements["ev-end"].value,"2026-11-18T14:00");
assert.match(elements["ops-planned-hours"].textContent,/08:00 a 14:00/);
elements["ev-start"].value="2026-11-18T23:00";
elements["ev-duration"].value="3";
calc(...deps);
assert.equal(elements["ev-end"].value,"2026-11-19T02:00","Cruza medianoche");
elements["ev-duration"].value="25";
calc(...deps);
assert.equal(elements["ev-end"].value,"","Duración inválida bloqueada");

const locLogic=extract("function liveCoordinates(clock,now=Date.now()){","function renderLiveDashboard(){");
const readLocation=new Function("clock","now",locLogic+";return liveCoordinates(clock,now);");
const now=Date.parse("2026-11-18T12:00:00Z");
const clock={status:"en_curso",lastGeo:{lat:19.4326,lng:-99.1332},
  lastGeoAt:{seconds:(now-120000)/1000}};
assert.deepEqual(readLocation(clock,now),{lat:19.4326,lng:-99.1332,minutes:2});
assert.equal(readLocation({...clock,lastGeoAt:{seconds:(now-360000)/1000}},now),null,
  "GPS viejo NO se considera posición actual");
assert.equal(readLocation({...clock,status:"finalizada"},now),null,"No se revela GPS de jornadas terminadas");
assert.equal(readLocation({...clock,lastGeo:{lat:120,lng:-99}},now),null,"Coordenadas fuera de rango");

const regionLogic=extract("function eventRegion(e){","function liveCoordinates(clock,now=Date.now()){");
const region=new Function("event","getSite",regionLogic+";return eventRegion(event);");
assert.equal(region({region:"CDMX Norte"},()=>({city:"Puebla"})),"CDMX Norte");
assert.equal(region({siteId:"a"},id=>id==="a"?{city:"Bajío"}:null),"Bajío");
assert.equal(region({},()=>null),"Sin región");
console.log("OK: duración automática, día siguiente, región y GPS consentido reciente.");
