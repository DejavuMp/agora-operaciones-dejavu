/**
 * Expediente inicial Hot Cruji Bravo (KFC México / Dejavú).
 * FUENTES: Ficha Técnica Stand Hot Cruji Bravo Cliente 20-10-2026, basada
 * en Fabricación Rev.03 15-10-2026; HCB Láminas Técnicas Planos V1.1.
 * Son componentes de DOCUMENTACIÓN, no un diagnóstico fotográfico de daños.
 * ZIP original con 42 fotografías: NO cargado ni validado en este expediente.
 * UUID fijos evitan crear la misma pieza/revisión al repetir el alta.
 */
export const HCB_PROJECT="Hot Cruji Bravo";
export const HCB_STAND="Stand Modo Bravo · Centro Santa Fe";
export const HCB_REFERENCES=[
 "Ficha Técnica Stand Hot Cruji Bravo · 20 oct 2026 · Fabricación Rev. 03 (15 oct 2026)",
 "HCB Láminas Técnicas / Planos V1.1 · 14 oct 2026 · esquemas no ejecutivos"
];
export const HCB_CASE={
 name:HCB_PROJECT,client:"KFC México",agency:"Dejavú Marketing",
 venue:"Centro Santa Fe",eventReference:"23–24 oct 2026",
 overall:"3.00 m frente × 1.60 m fondo indicado × 2.00 m altura máxima",
 overallCaveat:"Huella, despiece final y montaje físico pendientes de cotejo",
 photosExpected:42,photosAttached:0,status:"Inventario inicial documentado; inspección física pendiente"
};
export const HCB_ASSETS=[
 ["HCB-00","778d239a-4d63-5ffc-8d34-e1ebd4004015","Stand integral / implantación",
 "Referencia 3.00 m de frente, 1.60 m de desarrollo por verificar y 2.00 m de altura. Revisar huella real, estabilidad y sistemas de unión. No es plano de fabricación."],
 ["HCB-01","ce7c61da-aa8a-5d2c-b6e6-6b985237b9a7","Barra de atención",
 "Módulo desmontable de 1.50 × 0.40 × 1.00 m con recubrimiento gráfico autorizado; comprobar fijación, cantos y superficie de limpieza."],
 ["HCB-02","d12e0b0f-afef-5007-93ac-c17643b19e56","Muro bajo lateral",
 "Panel lateral de referencia 1.00 × 1.00 m con recubrimiento gráfico en ambas caras; comprobar base, alineación, encuentros y adhesión gráfica."],
 ["HCB-03","4f39e40c-f1be-5ba3-822a-72c4150af1c8","Cabina sensorial · estructura",
 "Estructura modular transportable de 1.00 × 1.00 × 2.00 m. Verificar paneles, uniones, ventilación, estabilidad y acceso seguro, sin suponer materiales finales."],
 ["HCB-04","8d4d6fbd-b159-5a10-8a8a-158618b3062b","Puerta y vano de flama",
 "Hoja abatible con vano en silueta de flama, bisagras y topes. La salida debe funcionar sin llave. Revisar recorrido y 100 ciclos antes de su uso."],
 ["HCB-05","b4b98e3d-c639-5c56-a06a-37e47dcf32c1","Juego de fichas · tablero",
 "Tablero de 1.00 × 1.00 m con tres carriles físicos; fichas móviles de referencia 20 × 20 cm. Comprobar recorrido y 100 movimientos sin atascos."],
 ["HCB-06","5ecdf342-000b-5374-99b8-b7a584862ee1","Base del juego",
 "Base indicada de 1.00 × 0.25 × 0.30 m. Confirmar posición final, sujeción, esquinas y estabilidad. Las cotas son referencias de fabricación."],
 ["HCB-07","043b7ab3-321d-586b-94b3-051a3885534a","Gráficas, paneles y remates",
 "Gráficos originales de campaña y acabados sobre panelería modular. Inspeccionar esquinas, bordes, adherencia y uniones; cantidades y daños físicos por verificar."],
 ["HCB-08","43517f8e-aa96-5f6a-a0e5-b3db50b5c852","LED rojo · marco de acceso",
 "Iluminación LED roja del marco rectangular del acceso, no del contorno de flama. Comprobar continuidad, fijaciones, fuente y cableado con técnico."],
 ["HCB-09","a208c52f-e376-5c7a-ba44-ca8bb735fdd5","LED rojo · interior de cabina",
 "Iluminación LED roja interior. Verificar protección de cables, ventilación, fuente y operación segura; no se tiene diagnóstico de falla eléctrica."],
 ["HCB-10","13b92022-3982-5f0a-85c1-be33624206bd","LED · perímetro del juego",
 "Iluminación LED perimetral del tablero físico. Revisar canalización, conectores, continuidad y protección de bordes; funcionamiento sin confirmar."],
 ["HCB-11","0ddf21e4-8ead-5906-b046-578194847b8a","Letreros retroiluminados",
 "La ficha técnica refiere tres letreros luminosos y gráficos autorizados. Verificar cantidad realmente recibida, posiciones, soportes y halo posterior."],
 ["HCB-12","a3d97956-cad2-520c-afae-d9104236562e","Distribución eléctrica y control",
 "Reserva eléctrica teórica de referencia 280 W, no medición nominal. Verificar drivers, display, controlador, tierra, protecciones y ficha eléctrica pendiente; no energizar sin revisión."]
].map(([code,id,piece,description])=>({code,id,piece,description,condition:"Por revisar"}));
export const HCB_INSPECTIONS=[
 ["HCB-R01","324d63a2-31f3-5df1-b023-d1c494154ebf","778d239a-4d63-5ffc-8d34-e1ebd4004015",
  "Inspección de estructura, paneles, anclajes y estabilidad",
  "Revisión pendiente: cotejar armado modular, uniones, escuadras, bases, cantos, desprendimientos y estabilidad en el stand real. No hay daños confirmados por este documento.",
  "Fotografiar cada elemento y definir por separado: reparar, reforzar, reemplazar o cotizar. Priorizar la seguridad de la instalación.","Alta"],
 ["HCB-R02","0bc8b614-99ea-5822-b91e-6e0ea766822e","8d4d6fbd-b159-5a10-8a8a-158618b3062b",
  "Inspección de puerta, topes y salida de cabina",
  "Revisión pendiente: comprobar salida libre sin llave, apertura, bisagras, topes, interferencias, ventilación y prueba de 100 ciclos. No se afirma que exista un daño.",
  "Suspender uso de cabina si la salida no es libre. Registrar fotos, pieza dañada si existe y propuesta de reparación.","Alta"],
 ["HCB-R03","838a6d25-c1ad-505c-90e7-90441c641bdc","b4b98e3d-c639-5c56-a06a-37e47dcf32c1",
  "Inspección de juego de fichas y base",
  "Revisión pendiente: comprobar los tres carriles, fichas móviles, topes, base y 100 movimientos sin trabarse. Cantidades y desgaste reales por levantar.",
  "Documentar atascos y fijaciones si aparecen; clasificar si basta mantenimiento de staff o requiere taller/proveedor.","Normal"],
 ["HCB-R04","87d15a9d-3e5b-5f3f-81f1-dfbe6b9574d0","043b7ab3-321d-586b-94b3-051a3885534a",
  "Inspección de superficies, gráficas, bordes y acabados",
  "Revisión pendiente: levantar cada panel y gráfico, revisar rayones, golpes, esquinas, adhesión y remates. No adjudicar daño a una foto sin abrir el ZIP original.",
  "Registrar foto y código por pieza; decidir limpieza, retoque, laminado, refabricación o cotización según condición física.","Normal"],
 ["HCB-R05","9861af75-90ef-50fd-a49f-2fe18355b03a","a3d97956-cad2-520c-afae-d9104236562e",
  "Comprobación de LED, letreros y seguridad eléctrica",
  "Revisión pendiente: comprobar marco de acceso, cabina, juego, letreros, drivers, protecciones y cableado. Los 280 W son estimación técnica, no diagnóstico.",
  "Solicitar prueba y ficha por técnico competente antes de energizar; registrar fallas únicamente si son verificadas.","Alta"]
].map(([code,id,assetId,area,problem,instructions,priority])=>({code,id,assetId,area,problem,instructions,priority}));
export function hcbAssetById(id){return HCB_ASSETS.find(x=>x.id===id);}
export function hcbImportPlan(existingAssetIds=[],existingRequestIds=[]){
 const a=new Set(existingAssetIds),r=new Set(existingRequestIds);
 return {
  assets:HCB_ASSETS.filter(x=>!a.has(x.id)),
  inspections:HCB_INSPECTIONS.filter(x=>!r.has(x.id)),
  existingAssets:HCB_ASSETS.length-HCB_ASSETS.filter(x=>!a.has(x.id)).length,
  existingInspections:HCB_INSPECTIONS.length-HCB_INSPECTIONS.filter(x=>!r.has(x.id)).length
 };
}
