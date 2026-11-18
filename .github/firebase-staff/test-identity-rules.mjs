/** AGORA Identidad - prueba de integracion de la copia de reglas en Operaciones. */
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {collection,doc,getDoc,getDocs,setDoc,serverTimestamp,Timestamp,writeBatch} from 'firebase/firestore';

const env=await initializeTestEnvironment({projectId:'demo-agora-identity',firestore:{
  host:'127.0.0.1',port:Number(process.env.FIRESTORE_EMULATOR_PORT||8080),
  rules:readFileSync('firestore.rules','utf8')
}});
const adminId='identity-admin',coordId='identity-coord',staffId='identity-staff';
const agoraId='DJV-2026-001',credentialId='a1b2c3d4e5f60718293a4b5c6d7e8f90';
const auditId='11112222333344445555666677778888',mail=id=>id+'@example.invalid';
try{
  await env.withSecurityRulesDisabled(async ctx=>{
    for(const [id,role] of [[adminId,'admin'],[coordId,'coordinador']])await setDoc(doc(ctx.firestore(),'agora_users',id),{
      name:id,email:mail(id),role,active:true,createdAt:Timestamp.now(),updatedAt:Timestamp.now()
    });
  });
  const anon=env.unauthenticatedContext().firestore();
  const admin=env.authenticatedContext(adminId,{email:mail(adminId),email_verified:true}).firestore();
  const coord=env.authenticatedContext(coordId,{email:mail(coordId),email_verified:true}).firestore();
  const staff=env.authenticatedContext(staffId,{email:mail(staffId),email_verified:true}).firestore();
  await assertSucceeds(setDoc(doc(staff,'agora_identity_registrations',staffId),{
    uid:staffId,email:mail(staffId),displayName:'Persona de Prueba',telephone:'5500000000',
    requestedJobTitle:'Staff',status:'pending',privacyAccepted:true,privacyVersion:'provisional-2026-11-18',
    createdAt:serverTimestamp(),updatedAt:serverTimestamp()
  }));
  const batch=writeBatch(admin);
  batch.set(doc(admin,'agora_identity_counters','2026'),{year:2026,nextSequence:2,updatedAt:serverTimestamp(),updatedBy:adminId});
  batch.set(doc(admin,'agora_identity_registry',agoraId),{
    uid:staffId,agoraId,displayName:'Persona de Prueba',email:mail(staffId),jobTitle:'Staff',rhStatus:'verified',
    credentialId,credentialActive:true,credentialStatus:'vigente',blockReason:'',coordinatorUids:[coordId],
    createdAt:serverTimestamp(),updatedAt:serverTimestamp(),createdBy:adminId,updatedBy:adminId,lastAuditId:auditId
  });
  batch.set(doc(admin,'agora_identity_links',staffId),{uid:staffId,agoraId,credentialId,active:true,createdAt:serverTimestamp(),createdBy:adminId});
  batch.update(doc(admin,'agora_identity_registrations',staffId),{status:'approved',agoraId,approvedAt:serverTimestamp(),approvedBy:adminId,updatedAt:serverTimestamp()});
  batch.set(doc(admin,'agora_identity_credentials',credentialId),{
    credentialId,agoraId,displayName:'Persona de Prueba',jobTitle:'Staff',active:true,status:'vigente',blockReason:'',
    updatedAt:serverTimestamp(),updatedBy:adminId,lastAuditId:auditId
  });
  batch.set(doc(admin,'agora_identity_audit',auditId),{actorUid:adminId,targetUid:staffId,agoraId,action:'identity_approved',createdAt:serverTimestamp()});
  await assertSucceeds(batch.commit());
  await assertSucceeds(getDoc(doc(anon,'agora_identity_credentials',credentialId)));
  await assertFails(getDocs(collection(anon,'agora_identity_credentials')));
  await assertFails(getDoc(doc(coord,'agora_identity_financial',staffId)));
  console.log('OK reglas de Identidad integradas en Operaciones.');
}finally{await env.cleanup()}
