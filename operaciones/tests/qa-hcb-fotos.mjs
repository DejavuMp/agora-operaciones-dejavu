import assert from "node:assert/strict";
import {test} from "node:test";
import {deflateRawSync} from "node:zlib";
import {HCB_PHOTO_ASSETS,HCB_PHOTO_ISSUES,HCB_PHOTOS,HCB_PHOTO_ASSET_ONLY,hcbPhotoId,validateHcbManifest} from "../hot-cruji-bravo-fotos.mjs";
import {openPrivateZip} from "../hot-cruji-bravo-zip.mjs";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
function crc32(bytes){
 let v=0xffffffff;
 for(const b of bytes){v^=b;for(let i=0;i<8;i++)v=(v&1)?(v>>>1)^0xedb88320:(v>>>1);}
 return (v^0xffffffff)>>>0;
}
function writeZip(entries){
 const local=[],central=[];let offset=0;
 for(const {name,data} of entries){
  const nameBytes=Buffer.from(name),raw=Buffer.from(data),compressed=deflateRawSync(raw);
  const crc=crc32(raw),localHeader=Buffer.alloc(30),centralHeader=Buffer.alloc(46);
  localHeader.writeUInt32LE(0x04034b50,0);localHeader.writeUInt16LE(20,4);
  localHeader.writeUInt16LE(8,8);localHeader.writeUInt32LE(crc,14);
  localHeader.writeUInt32LE(compressed.length,18);localHeader.writeUInt32LE(raw.length,22);
  localHeader.writeUInt16LE(nameBytes.length,26);
  const block=Buffer.concat([localHeader,nameBytes,compressed]);local.push(block);
  centralHeader.writeUInt32LE(0x02014b50,0);centralHeader.writeUInt16LE(20,4);centralHeader.writeUInt16LE(20,6);
  centralHeader.writeUInt16LE(8,10);centralHeader.writeUInt32LE(crc,16);
  centralHeader.writeUInt32LE(compressed.length,20);centralHeader.writeUInt32LE(raw.length,24);
  centralHeader.writeUInt16LE(nameBytes.length,28);centralHeader.writeUInt32LE(offset,42);
  central.push(Buffer.concat([centralHeader,nameBytes]));offset+=block.length;
 }
 const directory=Buffer.concat(central),end=Buffer.alloc(22);
 end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);
 end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...local,directory,end]);
}
test("42 fotografías exactas, IDs estables y ninguna foto excede límite por reporte",()=>{
 assert.ok(validateHcbManifest());
 assert.equal(HCB_PHOTOS.length,42);
 assert.equal(HCB_PHOTO_ISSUES.length,7);
 assert.equal(HCB_PHOTO_ASSETS.length,2);
 assert.equal(HCB_PHOTO_ASSET_ONLY.length,2);
 const names=HCB_PHOTOS.map(x=>x.name);
 assert.equal(new Set(names).size,42);
 const ids=HCB_PHOTOS.map(x=>hcbPhotoId(x.index));
 assert.equal(new Set(ids).size,42);
 for(const id of ids)assert.match(id,/^[a-f0-9-]{36}$/);
 assert.equal(HCB_PHOTO_ISSUES.reduce((n,r)=>n+r.numbers.length,0),40);
 assert.equal(HCB_PHOTO_ISSUES.every(r=>r.numbers.length<=12),true);
 assert.deepEqual(HCB_PHOTO_ASSET_ONLY.map(x=>x.index),[31,34]);
});
test("El ZIP de 42 fotos con subcarpeta se lee en local sin bibliotecas de terceros",async()=>{
 const zip=writeZip(HCB_PHOTOS.map(x=>({name:"WhatsApp Unknown 2026-11-22 at 10.50.16 AM/"+x.name,
  data:"JPEG sintético de prueba "+x.index})));
 const file=new File([zip],"ejemplo-42.zip",{type:"application/zip"});
 const files=await openPrivateZip(file);
 assert.equal(files.size,42);
 for(const item of HCB_PHOTOS){
  const photo=files.get(item.name);
  assert.ok(photo,"Foto faltante "+item.index);
  const result=await photo.toFile();
  assert.equal(result.name,item.name);
  assert.equal(await result.text(),"JPEG sintético de prueba "+item.index);
 }
});
test("Se detecta corrupción de datos y no se aceptan duplicados de nombres",async()=>{
 const zip=writeZip([{name:"test.jpeg",data:"hola"}]);
 const corrupted=new Uint8Array(zip);corrupted[40]^=3;
 const files=await openPrivateZip(new File([corrupted],"dañado.zip"));
 await assert.rejects(files.get("test.jpeg").toFile(),/CRC|incompleto/);
 const duplicates=writeZip([{name:"x/a.jpeg",data:"A"},{name:"y/a.jpeg",data:"B"}]);
 await assert.rejects(openPrivateZip(new File([duplicates],"duplicado.zip")),/duplicados/);
});
test("El sitio no publica los originales y usa cuenta autenticada para escribir",()=>{
 const base=fileURLToPath(new URL("../",import.meta.url));
 const js=readFileSync(base+"reparaciones.js","utf8");
 const importer=readFileSync(base+"hot-cruji-bravo-importar.mjs","utf8");
 const html=readFileSync(base+"reparaciones.html","utf8");
 assert.match(html,/id="hcbZipInput"/);
 assert.match(html,/id="hcbPhotoImport"/);
 assert.match(js,/importHotCrujiPhotoCase/);
 assert.match(importer,/getDocsFromServer/);
 assert.match(importer,/runTransaction/);
 assert.match(importer,/compressSparkPhoto/);
 assert.match(importer,/currentUser|uploadedBy:user.uid|uploadedBy:user/);
 assert.doesNotMatch(importer,/localStorage|uploadBytes|getStorage|fetch\(/);
});
