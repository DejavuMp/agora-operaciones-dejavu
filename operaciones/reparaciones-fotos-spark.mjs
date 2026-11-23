/** Firestore Spark: vistas previas JPEG pequeñas, privadas y sin Cloud Storage.
 * Cada foto vive en su propio documento (no supera el límite de 1 MiB por ficha).
 * Los archivos originales NO se sustituyen: consérvalos externamente en Drive.
 */
export const MAX_PHOTO_CHARS=90000;
export const PHOTO_PREFIX="firestore:";
export const PHOTO_ID=/^[a-f0-9-]{36}$/;
export function photoRefId(path){
 const id=typeof path==="string"&&path.startsWith(PHOTO_PREFIX)?path.slice(PHOTO_PREFIX.length):"";
 return PHOTO_ID.test(id)?id:null;
}
export function photoMarker(id){
 if(!PHOTO_ID.test(id))throw Error("Identificador de fotografía inválido");
 return PHOTO_PREFIX+id;
}
export function validatePhotoData(value){
 if(typeof value!=="string"||value.length>MAX_PHOTO_CHARS||
  !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(value))throw Error("La foto supera el límite de Spark o no es JPEG");
 return value;
}
export async function compressSparkPhoto(file){
 if(!file||!/^image\//.test(file.type||""))throw Error("Selecciona una imagen JPG, PNG u otro formato compatible");
 if(file.size>25*1024*1024)throw Error("El archivo original supera los 25 MB; usa una imagen más pequeña");
 const url=URL.createObjectURL(file);
 try{
  const image=await new Promise((resolve,reject)=>{
   const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error("No se pudo leer la imagen"));
   i.src=url;
  });
  for(const longSide of [960,800,650,520,400,320]){
   const ratio=Math.min(1,longSide/Math.max(image.naturalWidth,image.naturalHeight));
   const canvas=document.createElement("canvas");
   canvas.width=Math.max(1,Math.round(image.naturalWidth*ratio));
   canvas.height=Math.max(1,Math.round(image.naturalHeight*ratio));
   const ctx=canvas.getContext("2d",{alpha:false});
   ctx.fillStyle="#ffffff";ctx.fillRect(0,0,canvas.width,canvas.height);
   ctx.drawImage(image,0,0,canvas.width,canvas.height);
   for(const quality of [.62,.48,.34]){
    const data=canvas.toDataURL("image/jpeg",quality);
    if(data.length<=MAX_PHOTO_CHARS)return validatePhotoData(data);
   }
  }
  throw Error("La fotografía no se puede comprimir a menos de 90 KB. Usa una imagen más sencilla");
 }finally{URL.revokeObjectURL(url);}
}
export function sparkPhotoPayload({id,kind,ownerId,uploadedBy,dataUrl,label,stage,createdAt}){
 photoMarker(id);
 if(!PHOTO_ID.test(ownerId)||!["request","asset"].includes(kind)||!uploadedBy)
  throw Error("Expediente de foto inválido");
 if(!["antes","avance","despues","inventario"].includes(stage))throw Error("Etapa de evidencia inválida");
 return {id,kind,ownerId,uploadedBy,dataUrl:validatePhotoData(dataUrl),
  label:String(label||"Fotografía").trim().slice(0,120),stage,createdAt};
}
