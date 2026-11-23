/* Datos editables de una solicitud técnica. Nunca modifica evidencias,
 * cotizaciones, estado, responsable ni la identidad del creador.
 */
import {clean,safeUrl,SCOPES,PRIORITIES} from "./reparaciones-model.mjs";
export function repairEditPatch(raw){
 const area=clean(raw.area,120),problem=clean(raw.problem,2000);
 if(!area||!problem)throw Error("Indica la pieza o área y el problema que debe repararse.");
 if(raw.materialLink&&!safeUrl(raw.materialLink))throw Error("El enlace de materiales debe empezar con HTTPS.");
 return {
  area,problem,
  scope:SCOPES.includes(raw.scope)?raw.scope:SCOPES[1],
  cause:clean(raw.cause,250),
  solutionMode:raw.solutionMode==="propuesta"?"propuesta":"instrucciones",
  instructions:clean(raw.instructions,2000),
  materialLink:safeUrl(raw.materialLink),
  dueDate:clean(raw.dueDate,10),
  priority:PRIORITIES.includes(raw.priority)?raw.priority:"Normal"
 };
}
export function repairGroupPatch(raw){
 const project=clean(raw.project,120),asset=clean(raw.asset,120);
 if(!project||!asset)throw Error("Proyecto y stand o equipo son obligatorios.");
 return {project,asset};
}
export function checkEditRevision(old,expected){
 if(!old||!Number.isInteger(expected)||old.revision!==expected)
  throw Error("La solicitud cambió mientras editabas. Cierra la edición y vuelve a abrirla para no sobrescribir el trabajo de otra persona.");
 return true;
}
