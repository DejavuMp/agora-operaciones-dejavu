/** ZIP privado leído LOCALMENTE en el navegador; cero dependencias/CDN.
 * Soporta archivo estándar ZIP (store o deflate). No publica bytes en GitHub.
 */
const U16=(d,p)=>d.getUint16(p,true),U32=(d,p)=>d.getUint32(p,true);
const MAX_ZIP_SIZE=65*1024*1024;
const MAX_IMAGE_SIZE=25*1024*1024;
const MAX_TOTAL_SIZE=250*1024*1024;
function sane(v,start,len){if(!Number.isSafeInteger(start)||!Number.isSafeInteger(len)||start<0||len<0||start+len>v.byteLength)throw Error("Archivo ZIP incompleto o modificado");}
function crc32(bytes){
 let result=0xffffffff;
 for(const b of bytes){
  result^=b;
  for(let i=0;i<8;i++)result=result&1?(result>>>1)^0xedb88320:result>>>1;
 }
 return (result^0xffffffff)>>>0;
}
export async function openPrivateZip(file){
 if(!file||file.size<=0||file.size>MAX_ZIP_SIZE)throw Error("Selecciona el ZIP original (máximo 65 MB)");
 if(typeof DecompressionStream!=="function")throw Error("Este navegador no permite leer ZIP. Utiliza Chrome actualizado.");
 const buffer=await file.arrayBuffer(),view=new DataView(buffer);
 let eocd=-1;
 for(let i=view.byteLength-22;i>=Math.max(0,view.byteLength-65557);i--){
  if(U32(view,i)===0x06054b50){eocd=i;break;}
 }
 if(eocd<0)throw Error("El archivo no es un ZIP válido");
 const disks=U16(view,eocd+4),entries=U16(view,eocd+10),
  directoryBytes=U32(view,eocd+12),directoryOffset=U32(view,eocd+16);
 if(disks!==0||entries<1||entries>180||entries===65535)throw Error("Estructura ZIP no admitida");
 sane(view,directoryOffset,directoryBytes);
 const bytes=new Uint8Array(buffer),result=new Map(),decoder=new TextDecoder("utf-8");
 let cursor=directoryOffset,totalUncompressed=0;
 for(let n=0;n<entries;n++){
  sane(view,cursor,46);
  if(U32(view,cursor)!==0x02014b50)throw Error("Directorio ZIP incorrecto");
  const flags=U16(view,cursor+8),method=U16(view,cursor+10),
   expectedCrc=U32(view,cursor+16),compressed=U32(view,cursor+20),uncompressed=U32(view,cursor+24),
   nameLength=U16(view,cursor+28),extraLength=U16(view,cursor+30),commentLength=U16(view,cursor+32),
   location=U32(view,cursor+42);
  sane(view,cursor+46,nameLength+extraLength+commentLength);
  const raw=decoder.decode(bytes.slice(cursor+46,cursor+46+nameLength));
  cursor+=46+nameLength+extraLength+commentLength;
  if(raw.endsWith("/"))continue;
  if(flags&1)throw Error("No se admiten ZIP protegidos con contraseña");
  if(method!==0&&method!==8)throw Error("El ZIP utiliza un método de compresión no compatible");
  if(uncompressed>MAX_IMAGE_SIZE)throw Error("Imagen demasiado grande en ZIP");
  totalUncompressed+=uncompressed;
  if(totalUncompressed>MAX_TOTAL_SIZE)throw Error("Archivo ZIP demasiado grande al extraer");
  sane(view,location,30);
  if(U32(view,location)!==0x04034b50)throw Error("Encabezado ZIP dañado");
  const nameLocal=U16(view,location+26),extraLocal=U16(view,location+28);
  const dataStart=location+30+nameLocal+extraLocal;
  sane(view,dataStart,compressed);
  const name=raw.replaceAll("\\","/").split("/").at(-1);
  if(!name||name.startsWith("."))continue;
  if(result.has(name))throw Error("Hay nombres de fotografía duplicados en el ZIP");
  result.set(name,{
   size:uncompressed,
   async toFile(){
    const data=bytes.slice(dataStart,dataStart+compressed);
    const blob=method===0?new Blob([data]):
     await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).blob();
    if(blob.size!==uncompressed)throw Error("Contenido incompleto: "+name);
    const plain=new Uint8Array(await blob.arrayBuffer());
    if(crc32(plain)!==expectedCrc)throw Error("Foto dañada (CRC): "+name);
    return new File([plain],name,{type:"image/jpeg"});
   }
  });
 }
 return result;
}
