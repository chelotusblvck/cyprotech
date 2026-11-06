# Plan: emisor propio de boletas contra el SII

Decisión (2026-11-05): no se usa OpenFactura. Garage360 SpA (RUT 78.531.895-1) emite boletas con software propio
y la emisión se automatiza desde la tienda. Este plan es el borrador de trabajo.

> Los detalles técnicos del SII (URLs, esquemas, pasos de certificación) están escritos de memoria y deben
> contrastarse con la documentación oficial del SII antes de codificar. Es el primer paso de la fase 1.

## Punto de partida (ya existe en el código)

- `apps/backend/src/modules/billing`: arma el documento (`dte.ts`), maneja estados, reintentos e idempotencia
  (`operations.ts`), y guarda cada documento en `billing_document`.
- Interfaz `OpenFacturaApi` (`client/types.ts`): `emit`, `getStatus`, `getPdf`. Hoy la implementa OpenFactura y un simulado.
  Es el punto de enganche: el emisor propio entra como otra implementación, sin cambiar el flujo de pedidos.
- Flujo: al confirmarse el pago, `order-placed-billing` emite; el job `billing-maintenance` (cada 10 min) consulta el
  estado y reintenta; el dashboard muestra folio, PDF y estado, y permite reintentar o anular.
- Datos del emisor ya cargados en Coolify (RUT, razón social, giro, acteco 620200, dirección, comuna).

## Hallazgos de la lectura de las páginas oficiales (2026-11-05)

Fuentes: instructivo de certificación de boletas del SII (dos versiones de la guía), proceso de certificación y
postulación de factura electrónica. Varias páginas son antiguas y se contradicen; confirmar con el SII antes de apoyarse en ellas.

- **La postulación y la declaración de cumplimiento las hace el representante legal**, con certificado digital. El
  contribuyente debe tener inicio de actividades vigente y ser de Primera Categoría. En el formulario el software se declara como "Propio".
- **Puede que no se pueda certificar solo la boleta.** Una versión de la guía dice que hay que estar autorizado como emisor de
  documentos electrónicos "o estar certificándose en forma paralela". La otra dice que hay que estar habilitado en el ambiente de
  certificación. Además, para factura electrónica el SII fija como mínimo factura, nota de crédito y nota de débito. Hay que
  confirmar si certificar boleta exige antes o a la vez esos documentos. Esto puede ampliar el alcance de la primera fase.
- **Pasos de la certificación de boleta:** (1) el representante legal solicita el set de prueba; (2) en el ambiente de certificación
  se descarga un CAF de boletas, se suben los XML de boletas y el reporte de consumo de folios; (3) se solicita la revisión
  con el track id; (4) tras el visto bueno, el representante legal hace la declaración de cumplimiento.
- **Plazos:** la revisión tarda 10 a 15 días hábiles (una de las versiones). Los envíos del set deben hacerse dentro de 2
  meses desde que se obtiene, o se genera otro. Quien no registre actividad por 6 meses sale del ambiente de certificación.
- **La declaración de cumplimiento exige procedimientos formales** para gestión de folios (CAF), foliación controlada,
  respaldo de documentos y envío al SII, y el SII puede auditarlos. Hay que escribirlos, no solo implementarlos.
- **Las páginas no dicen:** los hosts de la API (certificación y producción), los XSD, ni si el consumo de folios sigue siendo
  obligatorio en producción. Hay que sacarlos del instructivo técnico y de la documentación de la API de boletas.
- Documentos oficiales ubicados: formato de boletas electrónicas (`sii.cl/factura_electronica/boletas_elec.pdf`), formato de
  consumo de folios (`consumo_folios.pdf`), formato XML (`formato_xml.htm`) e instructivo técnico de boleta electrónica.

## Fase 0. Trámites con el SII (en paralelo, sin código)

1. Inicio de actividades: hecho (10-10-2026).
2. Certificado digital del firmante (representante legal u otra persona autorizada). Debe servir para firmar DTE y el
   titular debe quedar autorizado como firmante en el SII.
3. Actividades económicas: hoy son 4 de software y datos. La tienda vende equipos; consultar con el contador si
   hay que agregar la actividad de comercio de equipos antes de boletear esas ventas.
4. Postular como emisor de documentos con software propio en el ambiente de certificación del SII.
5. Solicitar folios (CAF) de certificación: boleta (39) primero; nota de crédito (61) y factura (33) después.
6. Decidir cómo se emiten boletas legales mientras dure la certificación (ver Riesgos).

## Fase 1. Diseño (1 semana)

1. Bajar y leer las especificaciones oficiales: esquemas XSD de DTE y de envío de boletas, formato del timbre (TED),
   formato del CAF, API de boletas del SII (autenticación, envío, consulta), y reglas de impresión.
2. Decidir arquitectura (ver decisiones abajo): servicio `dte` aparte o módulo dentro del backend.
3. Diseñar datos: folios (rango del CAF, siguiente folio, alertas), documentos (XML firmado, track id, estado SII).
4. Definir la interfaz común `DteProvider` (alias de `OpenFacturaApi`) y la variable `DTE_PROVIDER`.

## Fase 2. Núcleo de emisión, en certificación (2 a 3 semanas)

1. Armado del XML de boleta (39): cálculo de neto, IVA y total desde precios con IVA incluido (la tienda ya trabaja
   con CLP enteros y absorbe diferencias de redondeo).
2. Timbre electrónico (TED) firmado con la clave privada del CAF.
3. Firma electrónica del documento y del sobre de envío con el certificado.
4. Cliente del SII: obtener semilla y token, enviar el sobre, guardar el track id, consultar estado.
5. Folios con asignación atómica en Postgres: un folio nunca se reutiliza, aunque el envío falle. Un documento ya
   firmado se reenvía con el mismo folio, no se firma otro.
6. PDF de la boleta con el timbre en código de barras PDF417, para adjuntarlo al correo.
7. Pruebas: validación contra los XSD oficiales, documentos de referencia y simulación del SII.

## Fase 3. Certificación con el SII (espera, 1 a 3 semanas)

1. Ejecutar el set de pruebas de boleta en el ambiente de certificación.
2. Declarar cumplimiento y entregar las muestras impresas que pida el SII.
3. Esperar la autorización a producción y pedir los folios reales.

## Fase 4. Integración y piloto (1 semana)

1. `DTE_PROVIDER=sii` en Coolify. El dashboard muestra "Certificación" o "Producción" y alerta con pocos folios.
2. Piloto en producción con pedidos reales, revisados a mano contra el portal del SII.
3. Actualizar `docs/BOLETA-Y-CORREOS.md` y el panel (hoy menciona OpenFactura).

## Fase 5. Nota de crédito y factura (2 semanas)

1. Nota de crédito (61) para anulaciones y devoluciones. Hoy anula el documento completo.
2. Factura (33) para quienes la piden en el checkout.
3. Revisar con el contador si hace falta el resumen diario de ventas y los libros.

## Fase 6. Operación

- Rotar el certificado antes de su vencimiento y renovar folios (CAF) antes de que se acaben.
- Respaldo cifrado de: certificado, claves y archivos CAF, XML firmados. La clave del CAF no se recupera si se pierde.
- Retención de los documentos por 6 años (Código Tributario).
- Manual de contingencia: qué hacer si el SII está caído o rechaza.
- Vigilar cambios de esquemas o normas del SII.

## Decisiones (2026-11-05)

1. **Arquitectura:** servicio `dte` aparte, portable. Todo lo que dependa del servidor va por variables de entorno y
   volúmenes; sin rutas ni hosts fijos; imagen Docker autocontenida; la tienda lo llama por HTTP interno detrás de la
   interfaz `DteProvider`. Así se puede mover a otro servidor sin tocar el backend.
2. **Alcance de esta fase:** solo boleta (39). Nota de crédito y factura quedan para la fase 5.
3. **Firmante:** Marcelo Cepeda, ya autorizado en el SII y con certificado digital.
   - Verificar que el certificado sea un archivo exportable (.pfx o .p12) con su clave privada. Uno guardado en un token o
     dispositivo USB que no permite exportar no sirve para un servicio automático.
   - Verificar que el RUT del titular coincida con el autorizado en el SII como firmante de documentos electrónicos.
4. **Código propio o librería:** lo más seguro para el código es no inventar la criptografía. Código propio para armar el
   DTE y el timbre; librerías ampliamente usadas para la firma XML (XMLDSig) y la criptografía; validación de cada XML
   contra los XSD oficiales; y una implementación abierta (como LibreDTE) solo como referencia para comparar resultados en
   pruebas, no como dependencia en producción. Revisar su licencia antes de usarla de cualquier forma.
5. **Mientras dure la certificación:** boletas manuales desde el portal del SII. El flujo hoy es bajo o nulo.
   - Con la emisión automática activa y sin emisor configurado, cada pedido intenta emitir, falla y dispara alertas. Se
     recomienda `BILLING_AUTO_ISSUE=false` hasta que el emisor propio esté en producción.

**Correo del emisor:** `ventas@cyprotech.cl` (`BILLING_EMISOR_CORREO`, cargado en Coolify).

## Riesgos

- Hasta que el SII autorice el software, la tienda no puede emitir boletas legales con este sistema. Hay que tener
  resuelto qué se hace en ese lapso. Verificar con el contador, y si el SII ofrece una vía gratuita de emisión, evaluarla
  como puente.
- La certificación puede demorar o requerir repetir pruebas. Es el mayor riesgo de calendario.
- Un folio perdido o duplicado es un problema tributario: la numeración y el respaldo del CAF son críticos.
- Los secretos (certificado, claves del CAF) nunca van al repositorio. Se montan como secretos en Coolify.
- Hay costo permanente de mantención por cambios normativos del SII.

## Estimación orientativa

Entre 4 y 8 semanas de calendario, con buena parte de espera del SII. Es una estimación inicial, sin validar.
