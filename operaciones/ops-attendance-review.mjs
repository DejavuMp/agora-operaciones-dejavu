/**
 * ÁGORA Operaciones · revisión de horas, independiente de tarifas y pagos.
 *
 * Compatibilidad: los registros históricos utilizan el campo paymentStatus.
 * Este módulo NO autoriza sueldos, no genera importes y no lee cuentas bancarias.
 */
import {instant,elapsedMinutes} from "./jornadas-logic.mjs";
export const attendanceLabels={
  capturado:"Pendiente de confirmación de Staff",
  solicitado:"Esperando validación de coordinación",
  revision:"Corrección solicitada",
  validado:"Horas validadas",
  programado:"Histórico (sin validar aquí)",
  pagado:"Histórico (sin validar aquí)"
};
export const attendanceLabel=state=>attendanceLabels[state]||"Pendiente de revisión";
export function verifiedAttendance({log,clock}={}){
  if(!log||!clock||clock.status!=="finalizada")
    throw Error("La jornada debe tener entrada y salida oficiales registradas.");
  if(log.ownerUid!==clock.ownerUid||log.personId!==clock.personId||log.eventId!==clock.eventId)
    throw Error("El reporte no corresponde al marcaje de esta persona y actividad.");
  const start=instant(clock.startedAt),end=instant(clock.endedAt);
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)
    throw Error("Las horas oficiales del servidor son inválidas.");
  const reportedStart=instant(log.start),reportedEnd=instant(log.end);
  if(!Number.isFinite(reportedStart)||!Number.isFinite(reportedEnd)||
     Math.abs(reportedStart-start)>1000||Math.abs(reportedEnd-end)>1000)
    throw Error("El reporte fue modificado y no coincide con los marcajes oficiales. Solicita revisión.");
  const gross=elapsedMinutes(clock.startedAt,clock.endedAt);
  const rest=Number(log.breakMins||0);
  if(!Number.isInteger(rest)||rest<0||rest>gross)
    throw Error("Los minutos de descanso del reporte no son válidos.");
  if(String(log.activity||"").trim().length<4)
    throw Error("El integrante debe describir la actividad realizada.");
  const minutes=gross-rest;
  if(minutes<=0)throw Error("El reporte no tiene horas netas válidas.");
  return {minutes,approvedHours:Math.round(minutes/60*100)/100,
    officialStart:new Date(start).toISOString(),officialEnd:new Date(end).toISOString()};
}
export function attendanceReference(log){
  if(!log?.id||!log.ownerUid||!log.eventId)throw Error("Falta identidad del expediente.");
  return {source:"agora_operaciones",sourceId:log.id,personUid:log.ownerUid,
    eventId:log.eventId,operationStatus:log.paymentStatus==="validado"?"validado":"pendiente"};
}
