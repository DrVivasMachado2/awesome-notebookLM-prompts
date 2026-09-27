const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell,
  WidthType, ShadingType, LevelFormat, TableOfContents, PageBreak, Footer, Header, PageNumber, BorderStyle,
} = require('docx');

const OUT = process.argv[2] || 'Arbol_Genealogico_Machado_Vivas.docx';
const C = { primary: '1F4E5F', accent: '8C2F39', light: 'E8F1F2', warn: 'FDECEA', gold: 'FFF4D6', grey: '666666' };
const W = 9360; // ancho útil US Letter con márgenes de 1"

const t = (text, o = {}) => new TextRun({ text, ...o });
const p = (text, o = {}) => new Paragraph({ spacing: { after: 120 }, ...o, children: Array.isArray(text) ? text : [t(text)] });
const h1 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [t(text)] });
const h2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [t(text)] });
const h3 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [t(text)] });
const b = (text, level = 0) => new Paragraph({ numbering: { reference: 'bul', level }, spacing: { after: 60 }, children: rich(text) });
const n = (text) => new Paragraph({ numbering: { reference: 'num', level: 0 }, spacing: { after: 60 }, children: rich(text) });
const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

// "**negrita** normal" -> runs
function rich(s) {
  return s.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map((seg) =>
    seg.startsWith('**') ? t(seg.slice(2, -2), { bold: true }) : t(seg));
}

function table(headers, rows, widths, headFill = C.primary) {
  const border = { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' };
  const borders = { top: border, bottom: border, left: border, right: border };
  const cell = (text, i, head, fill) => new TableCell({
    width: { size: widths[i], type: WidthType.DXA }, borders,
    shading: fill ? { type: ShadingType.CLEAR, color: 'auto', fill } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({ children: head ? [t(text, { bold: true, color: 'FFFFFF' })] : rich(text) })],
  });
  return new Table({
    width: { size: W, type: WidthType.DXA }, columnWidths: widths,
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h, i) => cell(h, i, true, headFill)) }),
      ...rows.map((r, ri) => new TableRow({ children: r.map((c, i) => cell(c, i, false, ri % 2 ? C.light : undefined)) })),
    ],
  });
}

// Recuadro destacado (tabla de una celda)
function box(title, lines, fill = C.gold) {
  const border = { style: BorderStyle.SINGLE, size: 8, color: C.accent };
  return new Table({
    width: { size: W, type: WidthType.DXA }, columnWidths: [W],
    rows: [new TableRow({ children: [new TableCell({
      width: { size: W, type: WidthType.DXA },
      borders: { top: border, bottom: border, left: border, right: border },
      shading: { type: ShadingType.CLEAR, color: 'auto', fill },
      margins: { top: 120, bottom: 120, left: 160, right: 160 },
      children: [p([t(title, { bold: true, color: C.accent })]), ...lines.map((l) => p(rich(l), { spacing: { after: 60 } }))],
    })] })],
  });
}
const gap = () => p('');

const children = [
  // ---------- PORTADA ----------
  new Paragraph({ spacing: { before: 2400, after: 240 }, alignment: AlignmentType.CENTER,
    children: [t('DOCUMENTO MAESTRO', { bold: true, size: 28, color: C.accent })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 },
    children: [t('Árbol Genealógico de la Familia Machado Vivas', { bold: true, size: 48, color: C.primary })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 },
    children: [t('Chocó, Colombia · Enfoque integrado de genética médica, sociología, antropología y genealogía', { italics: true, size: 26 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [t('Versión 1.0 — Fase 0: Marco metodológico y plantilla de trabajo', { size: 22 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [t('Fecha: 27 de septiembre de 2026', { size: 22 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 }, children: [t('Uso: estudio, repaso pedagógico y documento vivo de trabajo', { size: 22 })] }),
  box('Nota de transparencia', [
    'Esta versión se elaboró **sin datos familiares aportados todavía**. Todo lo relativo a personas concretas de la familia Machado Vivas aparece como **plantilla por completar**; no se ha inventado ningún nombre, fecha ni diagnóstico.',
    'El contexto histórico, poblacional y genético proviene de fuentes indexadas verificadas en PubMed (sección 11) y de hechos históricos de amplio consenso. Donde la evidencia es general (no específica de esta familia) se indica explícitamente.',
  ]),
  pageBreak(),

  // ---------- ÍNDICE ----------
  h1('Índice'),
  new TableOfContents('Índice', { hyperlink: true, headingStyleRange: '1-2' }),
  p([t('(En Word: clic derecho sobre el índice → "Actualizar campo" para numerar las páginas.)', { italics: true, color: C.grey, size: 18 })]),
  pageBreak(),

  // ---------- 1 ----------
  h1('1. Resumen ejecutivo'),
  table(['Elemento', 'Estado actual'], [
    ['Objetivo', 'Reconstruir y documentar el árbol genealógico de la familia Machado Vivas (Chocó), integrando herencia genética y contexto sociocultural.'],
    ['Fase', '**Fase 0** — marco metodológico, plantilla y lista de vacíos. Pendiente la carga de datos familiares.'],
    ['Datos familiares recibidos', 'Ninguno aún (0 individuos registrados).'],
    ['Contexto poblacional clave', 'Chocó: ancestría genética promedio ~76 % africana, ~13 % europea, ~11 % nativo-americana (Conley et al., 2017).'],
    ['Prioridades genéticas a explorar', 'Hemoglobinopatías (HbS), déficit de G6PD, farmacogenómica y antecedentes cardiometabólicos/oncológicos familiares.'],
    ['Próximo paso', 'Entrevista estructurada a informantes mayores + recolección de registros civiles y parroquiales (sección 7).'],
  ], [2600, 6760]),
  gap(),

  // ---------- 2 ----------
  h1('2. Marco metodológico'),
  h2('2.1 Qué es → Por qué importa → Cómo se aplica'),
  table(['Componente', 'Contenido'], [
    ['**Qué es**', 'Un pedigrí (árbol genealógico clínico) de ≥3 generaciones, dibujado con la nomenclatura estándar de la National Society of Genetic Counselors (NSGC), enriquecido con datos documentales e historia social.'],
    ['**Por qué importa**', 'Permite identificar patrones de herencia, estimar riesgos, orientar tamizajes y preservar la memoria histórica de una familia afrodescendiente del Pacífico colombiano, población subrepresentada en la investigación genómica.'],
    ['**Cómo se aplica**', 'Entrevista → registro individual estandarizado → verificación documental → dibujo del pedigrí → análisis de patrones → recomendaciones clínicas y documentales.'],
  ], [2200, 7160]),
  gap(),
  h2('2.2 Flujo de trabajo paso a paso'),
  n('**Definir al probando (caso índice)** — la persona desde la cual se construye el árbol (p. ej., usted, colega).'),
  n('**Entrevistar a informantes clave** — priorizar a los familiares de mayor edad (memoria oral) en bloques de 30–60 min.'),
  n('**Registrar cada individuo** con la ficha estándar (sección 6), asignando un código de generación (I, II, III…) y posición (1, 2, 3…).'),
  n('**Verificar con documentos** — registro civil, partidas de bautismo/matrimonio/defunción, notarías (sección 7).'),
  n('**Dibujar el pedigrí** con símbolos NSGC (sección 2.3) en software o a mano.'),
  n('**Analizar patrones de herencia** (sección 5) y contexto histórico (sección 3).'),
  n('**Emitir recomendaciones** clínicas (tamizaje, derivación a genética) y documentales (vacíos por llenar).'),
  n('**Versionar el documento** — cada nueva carga de datos genera una versión (1.1, 1.2…).'),
  h2('2.3 Nomenclatura estándar del pedigrí (NSGC)'),
  p('La nomenclatura de la NSGC es el estándar reconocido para dibujar historias familiares; su actualización de 2022 enfatiza la inclusión de sexo y género y ajusta la representación del estado de portador (Bennett et al., 2008; 2022).'),
  table(['Símbolo', 'Significado'], [
    ['□ Cuadrado', 'Hombre (sexo asignado al nacer masculino)'],
    ['○ Círculo', 'Mujer (sexo asignado al nacer femenino)'],
    ['◇ Rombo', 'Sexo no especificado / diverso'],
    ['Símbolo relleno', 'Individuo afectado por la condición en estudio'],
    ['Punto central / anotación', 'Portador (según la revisión 2022, se prefiere anotar el genotipo)'],
    ['Línea diagonal (/)', 'Fallecido — anotar edad y causa de muerte'],
    ['Flecha (↗)', 'Probando / caso índice'],
    ['Doble línea horizontal (=)', 'Unión consanguínea'],
    ['Números romanos (I, II, III)', 'Generaciones; números arábigos para individuos dentro de cada generación'],
  ], [3000, 6360]),
  gap(),
  pageBreak(),

  // ---------- 3 ----------
  h1('3. Contexto histórico y sociocultural del Chocó'),
  h2('3.1 Hitos históricos relevantes para la genealogía'),
  table(['Período', 'Hito', 'Implicación genealógica'], [
    ['Siglos XVI–XVII', 'Presencia indígena (Emberá, Wounaan, Tule/Gunadule) y primeras incursiones españolas.', 'Componente nativo-americano de la ancestría; linajes maternos indígenas posibles.'],
    ['Siglos XVII–XVIII', 'Economía colonial de minería de oro basada en la esclavización de africanos traídos por Cartagena de Indias.', 'Origen de la mayor parte de la ancestría africana; apellidos frecuentemente asignados por propietarios o en el bautismo.'],
    ['Colonia tardía', 'Automanumisión (compra de la libertad), cimarronaje y asentamientos libres en ríos (Atrato, San Juan, Baudó).', 'Los registros parroquiales pueden distinguir "libres" y "esclavizados"; rutas fluviales = rutas familiares.'],
    ['1851', 'Abolición legal de la esclavitud en la Nueva Granada.', 'Primeras generaciones nacidas libres; cambios o fijación de apellidos.'],
    ['1947', 'Creación del departamento del Chocó (capital: Quibdó).', 'Cambia la jurisdicción de archivos civiles y notariales.'],
    ['1991 y 1993', 'Constitución de 1991 (nación pluriétnica) y Ley 70 de 1993 (comunidades negras, titulación colectiva).', 'Consejos comunitarios pueden conservar memoria oral y censos propios.'],
    ['Siglos XX–XXI', 'Migración hacia Medellín, Cali, Bogotá y el Urabá; desplazamiento por conflicto armado.', 'Ramas familiares dispersas; registros en varias ciudades.'],
  ], [1700, 3900, 3760]),
  gap(),
  h2('3.2 Estructura familiar y cultura'),
  b('**Familia extensa y matrifocalidad**: en comunidades afro-pacíficas es frecuente que abuelas y tías cumplan un rol central; son informantes prioritarias.'),
  b('**Tradición oral**: alabaos, gualíes y relatos de parentela conservan nombres y lugares; conviene grabar (con consentimiento) las entrevistas.'),
  b('**Compadrazgo**: los padrinos figuran en partidas de bautismo y pueden revelar redes familiares y vecinales.'),
  b('**Movilidad fluvial**: las familias se asocian a cuencas (Atrato, San Juan, Baudó); el río de origen es un dato genealógico clave.'),
  h2('3.3 Los apellidos Machado y Vivas'),
  p('Ambos son apellidos de origen ibérico: "Machado" (del portugués/castellano, "hacha") y "Vivas" (castellano). En poblaciones afrodescendientes de la Colonia, los apellidos a menudo se heredaron de propietarios, padrinos o de la parroquia de bautismo, por lo que **un apellido europeo no implica necesariamente ancestría europea directa por esa línea**.'),
  box('Advertencia metodológica', [
    'La procedencia concreta de los apellidos Machado y Vivas en esta familia **no puede afirmarse sin documentos**. Es una hipótesis a verificar con partidas parroquiales y, opcionalmente, con pruebas de ADN de linaje (cromosoma Y para la línea paterna Machado).',
  ], C.warn),
  gap(),
  pageBreak(),

  // ---------- 4 ----------
  h1('4. Genética poblacional del Chocó'),
  h2('4.1 Ancestría genética'),
  table(['Población', 'Africana', 'Europea', 'Nativo-americana', 'Fuente'], [
    ['Chocó (n = 100)', '~76 %', '~13 %', '~11 %', 'Conley et al., 2017'],
    ['Medellín (n = 94)', '~7 %', '~75 %', '~18 %', 'Conley et al., 2017'],
  ], [2160, 1500, 1500, 1900, 2300]),
  gap(),
  b('El componente africano del Chocó comparte más ancestría con poblaciones yoruba (Nigeria); el nativo-americano, con Emberá y Wounaan; el europeo es principalmente español (Conley et al., 2017).'),
  b('Los donantes del Chocó tendieron a **autoidentificarse con más ancestría africana** de la que se infiere genéticamente; la autopercepción y la ancestría genética no siempre coinciden (Conley et al., 2017; Ruiz-Linares et al., 2014).'),
  b('Relevancia familiar: una familia chocoana con ramas en Antioquia puede mostrar mezcla distinta entre ramas; conviene registrar el lugar de nacimiento de cada abuelo.'),
  h2('4.2 Farmacogenómica y riesgo'),
  p('Antioquia y Chocó difieren en la frecuencia de variantes farmacogenómicas asociadas a su perfil de ancestría (p. ej., SLCO1B1 rs4149056, relacionado con toxicidad por estatinas, más frecuente en Antioquia) (Nagar et al., 2019). La ancestría africana se correlacionó con el riesgo poligénico predicho en una cohorte de Medellín, aunque etnicidad y ancestría no se corresponden de forma sencilla con la prevalencia observada (Chande et al., 2021).'),
  gap(),

  // ---------- 5 ----------
  h1('5. Genética médica aplicada a la familia'),
  h2('5.1 Condiciones prioritarias para indagar'),
  p([t('Selección basada en la ancestría poblacional; ', {}), t('no implica que la familia las tenga', { bold: true }), t('. Sirven para orientar la entrevista y el tamizaje.')]),
  table(['Condición', 'Herencia', 'Por qué indagar', 'Prueba orientadora'], [
    ['Rasgo / anemia de células falciformes (HbS)', 'Autosómica recesiva', 'Más frecuente en afrodescendientes; en tamizaje neonatal colombiano, 1 de cada 194 recién nacidos portaba alguna variante HbS (Bernal et al., 2024).', 'Electroforesis de hemoglobina / HPLC'],
    ['Déficit de G6PD', 'Ligada al X', 'Enzimopatía común en ancestría africana; riesgo de hemólisis con ciertos fármacos (primaquina, sulfas) y habas.', 'Actividad enzimática G6PD'],
    ['Talasemias (α y β)', 'Autosómica recesiva', 'Diagnóstico diferencial de microcitosis sin ferropenia.', 'Hemograma con índices + ferritina + estudio de Hb'],
    ['Hipertensión, diabetes tipo 2, ERC', 'Multifactorial/poligénica', 'Alta carga familiar orienta tamizaje precoz; interacción con determinantes sociales.', 'PA, glucemia/HbA1c, creatinina, uroanálisis'],
    ['Cánceres familiares (mama, próstata, colon)', 'Variable (AD en síndromes hereditarios)', 'Edad temprana de diagnóstico o varios casos en una línea sugieren síndrome hereditario.', 'Valoración por genética; paneles según criterios'],
    ['Respuesta a fármacos', 'Farmacogenómica', 'Diferencias poblacionales documentadas en Colombia (Nagar et al., 2019).', 'Pruebas dirigidas si hay eventos adversos previos'],
  ], [2100, 1500, 3660, 2100]),
  gap(),
  h2('5.2 Cómo reconocer el patrón de herencia en el árbol'),
  table(['Patrón', 'Pistas en el pedigrí'], [
    ['Autosómico dominante', 'Afectados en cada generación; transmisión hombre→hombre posible; ~50 % de la descendencia afectada.'],
    ['Autosómico recesivo', 'Salta generaciones; hermanos afectados con padres sanos (portadores); aumenta con consanguinidad.'],
    ['Ligado al X recesivo', 'Predominan hombres afectados; transmisión por madres portadoras; sin transmisión padre→hijo.'],
    ['Multifactorial', 'Agregación familiar sin proporciones mendelianas; influencia ambiental y social.'],
    ['Mitocondrial', 'Transmisión exclusiva por vía materna; expresión variable.'],
  ], [2600, 6760]),
  gap(),
  h2('5.3 Red flags y criterios de derivación a Genética Médica'),
  box('🚩 Red flags — derivar a Genética / especialista', [
    '• ≥2 familiares de primer grado con el mismo cáncer, o cáncer antes de los 50 años.',
    '• Muerte súbita inexplicada en menores de 40 años (sospecha de cardiopatía hereditaria).',
    '• Anemia hemolítica, crisis dolorosas, ictericia recurrente o hemólisis tras fármacos.',
    '• Discapacidad intelectual, malformaciones congénitas o pérdidas gestacionales recurrentes.',
    '• Consanguinidad conocida en la pareja con planes reproductivos.',
    '• **Urgencia**: fiebre, dolor torácico, disnea o dolor abdominal intenso en persona con drepanocitosis → acudir a urgencias de inmediato.',
  ], C.warn),
  gap(),
  pageBreak(),

  // ---------- 6 ----------
  h1('6. Plantilla del árbol genealógico'),
  h2('6.1 Ficha individual (una por persona)'),
  table(['Campo', 'Ejemplo de formato', 'Obligatorio'], [
    ['Código', 'III-2 (generación III, individuo 2)', 'Sí'],
    ['Nombre completo', 'Nombres + primer apellido + segundo apellido', 'Sí'],
    ['Sexo', 'M / F / no especificado', 'Sí'],
    ['Fecha y lugar de nacimiento', 'DD/MM/AAAA — municipio, corregimiento, río', 'Sí'],
    ['Padres (códigos)', 'II-1 × II-2', 'Sí'],
    ['Vivo / fallecido', 'Edad y causa de muerte si aplica', 'Sí'],
    ['Diagnósticos relevantes', 'Con edad de inicio', 'Recomendado'],
    ['Ocupación y migraciones', 'Minería, pesca, docencia… / Quibdó → Medellín', 'Recomendado'],
    ['Fuente de la información', 'Oral (quién) / documento (tipo y número)', 'Sí'],
    ['Nivel de certeza', 'Confirmado / probable / por verificar', 'Sí'],
  ], [2700, 4660, 2000]),
  gap(),
  h2('6.2 Registro por generaciones (por completar)'),
  table(['Gen.', 'Código', 'Nombre', 'Nac. (fecha/lugar)', 'Parentesco con el probando', 'Salud / notas', 'Certeza'], [
    ['I', 'I-1', '[Bisabuelo paterno]', '', 'Bisabuelo', '', ''],
    ['I', 'I-2', '[Bisabuela paterna]', '', 'Bisabuela', '', ''],
    ['II', 'II-1', '[Abuelo paterno — Machado]', '', 'Abuelo', '', ''],
    ['II', 'II-2', '[Abuela paterna]', '', 'Abuela', '', ''],
    ['II', 'II-3', '[Abuelo materno — Vivas]', '', 'Abuelo', '', ''],
    ['II', 'II-4', '[Abuela materna]', '', 'Abuela', '', ''],
    ['III', 'III-1', '[Padre]', '', 'Padre', '', ''],
    ['III', 'III-2', '[Madre]', '', 'Madre', '', ''],
    ['IV', 'IV-1 ↗', '[Probando]', '', '—', '', ''],
    ['IV', 'IV-2…', '[Hermanos/as]', '', 'Hermano/a', '', ''],
  ], [700, 900, 2060, 1500, 1600, 1600, 1000]),
  p([t('Nota: se asume la convención hispana (primer apellido paterno, segundo materno). Si la familia usa otra convención, se ajustará.', { italics: true, color: C.grey, size: 18 })]),
  gap(),

  // ---------- 7 ----------
  h1('7. Vacíos de información y cómo llenarlos'),
  h2('7.1 Datos documentales'),
  table(['Vacío', 'Dónde buscar', 'Prioridad'], [
    ['Registros civiles de nacimiento, matrimonio y defunción', 'Registraduría Nacional del Estado Civil; notarías de Quibdó y municipios de origen', 'Alta'],
    ['Partidas de bautismo, matrimonio y defunción (antes de ~1938)', 'Archivos parroquiales — Diócesis de Quibdó e Istmina-Tadó', 'Alta'],
    ['Registros coloniales y republicanos', 'Archivo General de la Nación (Bogotá): fondos de minas, negros y esclavos, testamentarias', 'Media'],
    ['Índices digitalizados', 'FamilySearch (registros parroquiales colombianos microfilmados)', 'Media'],
    ['Memoria comunitaria', 'Consejos comunitarios (Ley 70), juntas de acción comunal, cementerios locales', 'Media'],
    ['Fotografías y documentos familiares', 'Álbumes, cartas, cédulas antiguas, escrituras de tierras', 'Alta'],
  ], [3300, 4460, 1600]),
  gap(),
  h2('7.2 Datos clínicos'),
  b('Causa y edad de muerte de abuelos y bisabuelos.'),
  b('Antecedentes de anemia, ictericia, "sangre débil", crisis de dolor o transfusiones.'),
  b('Hipertensión, diabetes, enfermedad renal, ACV o infartos y edad de inicio.'),
  b('Cánceres: tipo, edad al diagnóstico y rama familiar.'),
  b('Resultados previos de electroforesis de hemoglobina, G6PD u otras pruebas genéticas.'),
  b('Pérdidas gestacionales, muertes neonatales, malformaciones o discapacidad intelectual.'),
  b('Consanguinidad (uniones entre primos), frecuente de registrar en comunidades rurales aisladas.'),
  h2('7.3 Guion breve de entrevista (bloques de 30–60 min)'),
  table(['Bloque', 'Duración', 'Objetivo', 'Métrica de avance'], [
    ['1. Identificación', '30 min', 'Nombres completos, fechas y lugares de 3 generaciones', 'N.º de fichas completas'],
    ['2. Historia migratoria', '30 min', 'Ríos, municipios, ciudades de destino y motivos', 'N.º de ramas geolocalizadas'],
    ['3. Salud familiar', '45 min', 'Diagnósticos, causas de muerte, edades de inicio', '% de individuos con dato clínico'],
    ['4. Documentos', '60 min', 'Fotografiar/escanear registros existentes', 'N.º de datos con fuente documental'],
  ], [2000, 1200, 3760, 2400]),
  gap(),
  pageBreak(),

  // ---------- 8 ----------
  h1('8. Ética, consentimiento y privacidad'),
  b('**Consentimiento informado** de cada informante para entrevistas, grabaciones y uso de fotografías.'),
  b('**Protección de datos**: los datos de salud son sensibles según la Ley 1581 de 2012 (Colombia); compartir el árbol solo con quien la familia autorice.'),
  b('**Pruebas de ADN recreativas**: pueden revelar paternidades no esperadas o parientes desconocidos; conversar esto antes de realizarlas.'),
  b('**Hallazgos clínicos**: toda sospecha genética debe confirmarse con un profesional; este documento no reemplaza la consulta presencial.'),
  b('**Sensibilidad histórica**: la historia de esclavización y desplazamiento se aborda con respeto y enfoque de memoria y dignidad.'),
  gap(),

  // ---------- 9 ----------
  h1('9. Errores comunes'),
  table(['Error', 'Cómo evitarlo'], [
    ['Asumir que el apellido revela el origen étnico', 'Verificar con documentos y, si se desea, con ADN de linaje.'],
    ['Confundir homónimos (mismo nombre, distinta persona)', 'Cruzar fecha, lugar y nombres de padres en cada registro.'],
    ['Registrar datos orales como hechos confirmados', 'Usar siempre el campo "nivel de certeza".'],
    ['Omitir ramas maternas', 'Dar el mismo peso a la línea Vivas que a la línea Machado.'],
    ['Diagnosticar por el árbol', 'El pedigrí orienta; el diagnóstico requiere pruebas y valoración clínica.'],
    ['Olvidar hermanos fallecidos en la infancia', 'Preguntar explícitamente por muertes tempranas y pérdidas gestacionales.'],
  ], [4000, 5360]),
  gap(),

  // ---------- 10 ----------
  h1('10. Repaso pedagógico y checklist final'),
  h2('10.1 Preguntas de autoevaluación'),
  n('¿Cuál es la proporción aproximada de ancestría africana, europea y nativo-americana reportada para el Chocó?'),
  n('¿Qué patrón de herencia sugiere un árbol donde solo varones están afectados y la condición se transmite por madres sanas?'),
  n('¿Por qué un apellido de origen ibérico no prueba ancestría europea directa en una familia afrochocoana?'),
  n('¿Qué dos condiciones hematológicas se priorizan en tamizaje de poblaciones con ancestría africana?'),
  n('¿Qué archivo consultaría para partidas de bautismo anteriores al registro civil obligatorio?'),
  h2('10.2 Respuestas clave'),
  b('1) ~76 % africana, ~13 % europea, ~11 % nativo-americana. 2) Ligado al X recesivo. 3) Por la asignación colonial de apellidos vía propietarios, padrinos o parroquia. 4) HbS y déficit de G6PD. 5) Archivos parroquiales de la diócesis correspondiente (y FamilySearch).'),
  h2('10.3 Checklist final'),
  table(['✓', 'Tarea'], [
    ['☐', 'Probando definido y marcado con flecha'],
    ['☐', 'Mínimo 3 generaciones registradas (ambas líneas: Machado y Vivas)'],
    ['☐', 'Cada individuo con fuente y nivel de certeza'],
    ['☐', 'Causas y edades de muerte documentadas'],
    ['☐', 'Antecedentes hematológicos indagados (HbS, G6PD)'],
    ['☐', 'Red flags revisadas y derivaciones definidas'],
    ['☐', 'Consentimiento de informantes obtenido'],
    ['☐', 'Documentos escaneados y archivados con código de individuo'],
  ], [800, 8560]),
  gap(),
  pageBreak(),

  // ---------- 11 ----------
  h1('11. Referencias (formato Vancouver)'),
  p([t('Verificadas en PubMed el 27/09/2026.', { italics: true, color: C.grey, size: 18 })]),
  n('Conley AB, Rishishwar L, Norris ET, Valderrama-Aguirre A, Mariño-Ramírez L, Medina-Rivas MA, et al. A comparative analysis of genetic ancestry and admixture in the Colombian populations of Chocó and Medellín. G3 (Bethesda). 2017;7(10):3435-47. doi:10.1534/g3.117.1118. PMID: 28855283.'),
  n('Nagar SD, Moreno AM, Norris ET, Rishishwar L, Conley AB, O\'Neal KL, et al. Population pharmacogenomics for precision public health in Colombia. Front Genet. 2019;10:241. doi:10.3389/fgene.2019.00241. PMID: 30967898.'),
  n('Chande AT, Nagar SD, Rishishwar L, Mariño-Ramírez L, Medina-Rivas MA, Valderrama-Aguirre AE, et al. The impact of ethnicity and genetic ancestry on disease prevalence and risk in Colombia. Front Genet. 2021;12:690366. doi:10.3389/fgene.2021.690366. PMID: 34650589.'),
  n('Ruiz-Linares A, Adhikari K, Acuña-Alonzo V, Quinto-Sanchez M, Jaramillo C, Arias W, et al. Admixture in Latin America: geographic structure, phenotypic diversity and self-perception of ancestry based on 7,342 individuals. PLoS Genet. 2014;10(9):e1004572. doi:10.1371/journal.pgen.1004572. PMID: 25254375.'),
  n('Bennett RL, French KS, Resta RG, Austin J. Practice resource-focused revision: Standardized pedigree nomenclature update centered on sex and gender inclusivity: A practice resource of the National Society of Genetic Counselors. J Genet Couns. 2022;31(6):1238-48. doi:10.1002/jgc4.1621. PMID: 36106433.'),
  h3('Referencias complementarias'),
  n('Bennett RL, French KS, Resta RG, Doyle DL. Standardized human pedigree nomenclature: update and assessment of the recommendations of the National Society of Genetic Counselors. J Genet Couns. 2008;17(5):424-33. doi:10.1007/s10897-008-9169-9. PMID: 18792771.'),
  n('Bernal JE, Tamayo ML, Briceño I, Benavides E. Newborn screening in Colombia: The experience of a private program in Bogotá. Biomedica. 2024;44(1):102-7. doi:10.7705/biomedica.6911. PMID: 38648350.'),
  gap(),
  box('Próxima versión (1.1)', [
    'Al recibir nombres, fechas, lugares y antecedentes de salud, se completarán las secciones 6 y 7, se dibujará el pedigrí y se añadirá el análisis de patrones de herencia específico de la familia Machado Vivas.',
  ]),
];

const doc = new Document({
  creator: 'Documento Maestro — Genealogía Machado Vivas',
  title: 'Árbol Genealógico de la Familia Machado Vivas',
  styles: {
    default: { document: { run: { font: 'Calibri', size: 22 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 32, bold: true, color: C.primary }, paragraph: { spacing: { before: 360, after: 160 }, outlineLevel: 0,
          border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: C.accent, space: 4 } } } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 26, bold: true, color: C.accent }, paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 22, bold: true, color: C.primary }, paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2 } },
    ],
  },
  numbering: { config: [
    { reference: 'bul', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] },
    { reference: 'num', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 540, hanging: 360 } } } }] },
  ] },
  features: { updateFields: true },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT,
      children: [t('Genealogía Machado Vivas · Chocó, Colombia', { size: 16, color: C.grey, italics: true })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
      children: [t('Página ', { size: 16, color: C.grey }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: C.grey })] })] }) },
    children,
  }],
});

Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(OUT, buf); console.log('Wrote', OUT); });
