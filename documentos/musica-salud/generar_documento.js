const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, TabStopType,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, VerticalAlign,
  PageBreak, Header, Footer, PageNumber, NumberFormat, LevelFormat, TableOfContents,
  PageOrientation, convertInchesToTwip,
} = require("docx");
const fs = require("fs");

/* ------------------------------------------------------------------ *
 *  PALETA Y CONSTANTES
 * ------------------------------------------------------------------ */
const AZUL   = "12355B"; // azul noche  - titulos nivel 1
const TEAL   = "10706B"; // verde azulado - titulos nivel 2
const CORAL  = "B23A25"; // coral profundo - acentos / alertas
const OCRE   = "8A6512"; // ocre - avisos
const GRIS   = "3F3F46"; // texto secundario
const NEGRO  = "1A1A1A";
const FILA_A = "EDF2F7"; // fondo tabla alterno
const FILA_H = "12355B"; // cabecera tabla
const CAJA_AZ = "E8EFF6";
const CAJA_TE = "E4F1EF";
const CAJA_CO = "FBEBE7";
const CAJA_OC = "FBF3E2";
const CAJA_GR = "F2F3F5";

const INFO = { compact: true, size: 19 }; // cajas de la infografia de sintesis

const CONTENT_W = 9360;              // 12240 - 2*1440 (Carta con margenes 1")
const FUENTE = "Calibri";
const FUENTE_TIT = "Cambria";

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const NONE_ALL = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER,
                   insideHorizontal: NO_BORDER, insideVertical: NO_BORDER };

/* ------------------------------------------------------------------ *
 *  HELPERS DE PARRAFO
 * ------------------------------------------------------------------ */
const P = (text, opt = {}) => new Paragraph({
  alignment: opt.align || AlignmentType.JUSTIFIED,
  spacing: { before: opt.before ?? 0, after: opt.after ?? 140, line: opt.line ?? 276 },
  indent: opt.indent,
  children: [new TextRun({
    text, font: opt.font || FUENTE, size: opt.size || 22,
    color: opt.color || NEGRO, bold: opt.bold, italics: opt.italics,
  })],
});

// Parrafo con tramos mixtos: rich([["negrita", {b:1}], ["normal", {}]])
const rich = (parts, opt = {}) => new Paragraph({
  alignment: opt.align || AlignmentType.JUSTIFIED,
  spacing: { before: opt.before ?? 0, after: opt.after ?? 140, line: opt.line ?? 276 },
  indent: opt.indent,
  children: parts.map(([t, o = {}]) => new TextRun({
    text: t, font: o.font || opt.font || FUENTE, size: o.size || opt.size || 22,
    color: o.color || opt.color || NEGRO, bold: o.b, italics: o.i, underline: o.u ? {} : undefined,
  })),
});

const H1 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_1,
  spacing: { before: 380, after: 200 },
  keepNext: true,
  border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: AZUL, space: 6 } },
  children: [new TextRun({ text, font: FUENTE_TIT, size: 32, bold: true, color: AZUL })],
});

const H2 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  spacing: { before: 300, after: 140 },
  keepNext: true,
  children: [new TextRun({ text, font: FUENTE_TIT, size: 26, bold: true, color: TEAL })],
});

const H3 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_3,
  spacing: { before: 220, after: 110 },
  keepNext: true,
  children: [new TextRun({ text, font: FUENTE, size: 23, bold: true, color: GRIS })],
});

// Titulo de "Parte" a pagina completa
const PARTE = (num, titulo, bajada) => [
  new Paragraph({ children: [new PageBreak()] }),
  ...Array.from({ length: 7 }, () => new Paragraph({ spacing: { after: 0 }, children: [] })),
  new Paragraph({ spacing: { before: 0, after: 60 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: num, font: FUENTE_TIT, size: 24, bold: true, color: CORAL,
      characterSpacing: 60 })] }),
  new Paragraph({ spacing: { after: 160 }, alignment: AlignmentType.CENTER,
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: AZUL, space: 10 } },
    children: [new TextRun({ text: titulo, font: FUENTE_TIT, size: 44, bold: true, color: AZUL })] }),
  new Paragraph({ spacing: { before: 160 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: bajada, font: FUENTE, size: 22, italics: true, color: GRIS })] }),
  new Paragraph({ children: [new PageBreak()] }),
];

const bullet = (text, lvl = 0) => new Paragraph({
  numbering: { reference: "vinetas", level: lvl },
  spacing: { after: 90, line: 276 },
  alignment: AlignmentType.JUSTIFIED,
  children: [new TextRun({ text, font: FUENTE, size: 22, color: NEGRO })],
});

const bulletRich = (parts, lvl = 0) => new Paragraph({
  numbering: { reference: "vinetas", level: lvl },
  spacing: { after: 90, line: 276 },
  alignment: AlignmentType.JUSTIFIED,
  children: parts.map(([t, o = {}]) => new TextRun({
    text: t, font: FUENTE, size: 22, color: o.color || NEGRO, bold: o.b, italics: o.i })),
});

// `inst` crea una instancia de numeracion independiente: cada lista reinicia en 1.
const paso = (text, inst = 0, ref = "pasos") => new Paragraph({
  numbering: { reference: ref, level: 0, instance: inst },
  spacing: { after: 90, line: 276 },
  alignment: AlignmentType.JUSTIFIED,
  children: [new TextRun({ text, font: FUENTE, size: 22, color: NEGRO })],
});

const espacio = (n = 120) => new Paragraph({ spacing: { after: n }, children: [] });

/* ------------------------------------------------------------------ *
 *  CAJAS DESTACADAS (tabla de una celda con barra lateral de color)
 * ------------------------------------------------------------------ */
function caja(titulo, lineas, tono = "azul", opt = {}) {
  const sz = opt.size || 22;
  const mg = opt.compact
    ? { top: 110, bottom: 110, left: 200, right: 170 }
    : { top: 180, bottom: 180, left: 220, right: 200 };
  const gap = opt.compact ? 60 : 100;
  const ln = opt.compact ? 232 : undefined;
  const map = {
    azul:  [CAJA_AZ, AZUL],
    teal:  [CAJA_TE, TEAL],
    coral: [CAJA_CO, CORAL],
    ocre:  [CAJA_OC, OCRE],
    gris:  [CAJA_GR, GRIS],
  };
  const [fill, barra] = map[tono];
  const kids = [];
  if (titulo) kids.push(new Paragraph({
    spacing: { after: gap },
    children: [new TextRun({ text: titulo, font: FUENTE, size: sz, bold: true, color: barra })],
  }));
  // Un "par" es ["texto", {opciones}]: tramo con formato dentro de un mismo parrafo.
  const esPar = (x) => Array.isArray(x) && typeof x[0] === "string" &&
    (x.length === 1 || (x[1] && typeof x[1] === "object" && !Array.isArray(x[1])));
  if (lineas.length && lineas.every(esPar)) {
    // Toda la lista es un unico parrafo con tramos mixtos.
    kids.push(rich(lineas, { after: 0, size: sz, line: ln }));
  } else {
    lineas.forEach((l, i) => {
      const after = i === lineas.length - 1 ? 0 : gap;
      if (Array.isArray(l)) kids.push(rich(l, { after, size: sz, line: ln }));
      else kids.push(P(l, { after, size: sz, line: ln }));
    });
  }
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [CONTENT_W],
    borders: {
      top: NO_BORDER, bottom: NO_BORDER, right: NO_BORDER,
      left: { style: BorderStyle.SINGLE, size: 24, color: barra },
      insideHorizontal: NO_BORDER, insideVertical: NO_BORDER,
    },
    rows: [new TableRow({ cantSplit: true, children: [new TableCell({
      width: { size: CONTENT_W, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill, color: "auto" },
      margins: mg,
      children: kids,
    })] })],
  });
}

/* ------------------------------------------------------------------ *
 *  TABLAS DE DATOS
 * ------------------------------------------------------------------ */
function celda(text, w, opt = {}) {
  const contenido = Array.isArray(text) ? text : [text];
  return new TableCell({
    width: { size: w, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: opt.fill || "FFFFFF", color: "auto" },
    margins: { top: 90, bottom: 90, left: 130, right: 130 },
    verticalAlign: VerticalAlign.CENTER,
    children: contenido.map((t, i) => new Paragraph({
      alignment: opt.align || AlignmentType.LEFT,
      spacing: { after: i === contenido.length - 1 ? 0 : 60, line: 260 },
      children: [new TextRun({
        text: t, font: FUENTE, size: opt.size || 20,
        bold: opt.bold, italics: opt.italics, color: opt.color || NEGRO,
      })],
    })),
  });
}

function tabla(cols, headers, filas, opt = {}) {
  const total = cols.reduce((a, b) => a + b, 0);
  const rows = [];
  rows.push(new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => celda(h, cols[i], {
      fill: FILA_H, bold: true, color: "FFFFFF", size: opt.headSize || 20,
      align: i === 0 ? AlignmentType.LEFT : (opt.headAlign || AlignmentType.LEFT),
    })),
  }));
  filas.forEach((f, idx) => {
    rows.push(new TableRow({
      children: f.map((c, i) => celda(c, cols[i], {
        fill: idx % 2 === 1 ? FILA_A : "FFFFFF",
        size: opt.size || 20,
        bold: i === 0 && opt.boldFirst !== false,
        color: i === 0 && opt.boldFirst !== false ? AZUL : NEGRO,
      })),
    }));
  });
  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: cols,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 6, color: "C3CDD8" },
      bottom: { style: BorderStyle.SINGLE, size: 6, color: "C3CDD8" },
      left: { style: BorderStyle.SINGLE, size: 6, color: "C3CDD8" },
      right: { style: BorderStyle.SINGLE, size: 6, color: "C3CDD8" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "D5DDE5" },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "D5DDE5" },
    },
    rows,
  });
}

const rotulo = (text) => new Paragraph({
  spacing: { before: 60, after: 240 },
  alignment: AlignmentType.LEFT,
  children: [new TextRun({ text, font: FUENTE, size: 18, italics: true, color: GRIS })],
});

/* ------------------------------------------------------------------ *
 *  DIAGRAMA DE FLUJO TEXTUAL (cadena de bloques)
 * ------------------------------------------------------------------ */
function flujo(pasos) {
  const w = CONTENT_W;
  const rows = [];
  pasos.forEach((p, i) => {
    rows.push(new TableRow({ children: [new TableCell({
      width: { size: w, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: i % 2 === 0 ? CAJA_AZ : CAJA_TE, color: "auto" },
      margins: { top: 110, bottom: 110, left: 200, right: 180 },
      children: [
        new Paragraph({ spacing: { after: 50 }, children: [new TextRun({
          text: `${i + 1}. ${p[0]}`, font: FUENTE, size: 21, bold: true,
          color: i % 2 === 0 ? AZUL : TEAL })] }),
        new Paragraph({ alignment: AlignmentType.JUSTIFIED, children: [new TextRun({
          text: p[1], font: FUENTE, size: 20, color: NEGRO })] }),
      ],
    })] }));
    if (i < pasos.length - 1) {
      rows.push(new TableRow({ children: [new TableCell({
        width: { size: w, type: WidthType.DXA },
        margins: { top: 20, bottom: 20, left: 200, right: 0 },
        children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 },
          children: [new TextRun({ text: "▼", font: FUENTE, size: 20, color: CORAL })] })],
      })] }));
    }
  });
  return new Table({
    width: { size: w, type: WidthType.DXA },
    columnWidths: [w],
    borders: NONE_ALL,
    rows,
  });
}

/* ================================================================== *
 *  CONTENIDO
 * ================================================================== */
const hoy = "9 de agosto de 2026";

/* ---------- PORTADA ---------- */
const portada = [
  new Paragraph({ spacing: { before: 900, after: 0 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "DOCUMENTO MAESTRO  ·  GUÍA PEDAGÓGICA E INFOGRÁFICA",
      font: FUENTE, size: 18, bold: true, color: CORAL, characterSpacing: 50 })] }),
  new Paragraph({ spacing: { before: 420, after: 0 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "LOS EFECTOS",
      font: FUENTE_TIT, size: 58, bold: true, color: AZUL })] }),
  new Paragraph({ spacing: { before: 0, after: 0 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "DE LA MÚSICA",
      font: FUENTE_TIT, size: 58, bold: true, color: AZUL })] }),
  new Paragraph({ spacing: { before: 0, after: 200 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "EN LA SALUD",
      font: FUENTE_TIT, size: 58, bold: true, color: AZUL })] }),
  new Paragraph({ spacing: { before: 0, after: 300 }, alignment: AlignmentType.CENTER,
    border: { top: { style: BorderStyle.SINGLE, size: 16, color: TEAL, space: 12 } },
    children: [new TextRun({
      text: "Cerebro, audición y placer: qué género musical activa más el sistema nervioso y por qué",
      font: FUENTE, size: 26, italics: true, color: TEAL })] }),
  espacio(200),
  caja(null, [
    [[ "Punto de partida: ", { b: 1 } ],
     [ "artículo de Xataka «Los neurocientíficos coinciden: el reguetón es la música que más partes del cerebro activa, por encima de la clásica»." ]],
    [[ "Sustento científico: ", { b: 1 } ],
     [ "Martín-Fernández, J.; Burunat, I.; Modroño, C.; González-Mora, J. L.; Plata-Bello, J. (2021). " ],
     [ "Music Style Not Only Modulates the Auditory Cortex, but Also Motor Related Areas. ", { i: 1 } ],
     [ "Neuroscience, 457, 88–102.", { i: 1 } ]],
  ], "teal"),
  espacio(400),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 },
    children: [new TextRun({ text: "Documento de trabajo · Versión 1.0", font: FUENTE, size: 20, color: GRIS })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 },
    children: [new TextRun({ text: hoy, font: FUENTE, size: 20, color: GRIS })] }),
  new Paragraph({ alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Nivel: divulgación científica avanzada / formación de pregrado y posgrado",
      font: FUENTE, size: 20, italics: true, color: GRIS })] }),
  new Paragraph({ children: [new PageBreak()] }),
];

/* ---------- FICHA TÉCNICA ---------- */
const ficha = [
  H1("Ficha técnica del documento"),
  tabla([2600, 6760], ["Campo", "Descripción"], [
    ["Título", "Los efectos de la música en la salud: cerebro, audición y placer"],
    ["Pregunta rectora", "¿Cómo afecta la música al cerebro y a la audición, y qué género musical estimula más las áreas del placer y la concentración?"],
    ["Tipo de documento", "Documento maestro de síntesis: revisión narrativa + guía pedagógica + material infográfico"],
    ["Destinatarios", "Docentes, estudiantes de ciencias de la salud, profesionales sanitarios, divulgadores y público interesado"],
    ["Fuente detonante", "Xataka — «Los neurocientíficos coinciden: el reguetón es la música que más partes del cerebro activa, por encima de la clásica»"],
    ["Fuente científica principal", "Martín-Fernández et al. (2021), Neuroscience 457:88–102. DOI 10.1016/j.neuroscience.2021.01.012"],
    ["Fuentes complementarias", "Salimpoor et al. (2011, Nature Neuroscience); Witek et al. (2014, PLOS ONE); Pietschnig et al. (2010); OMS — Norma mundial de escucha sin riesgos (2022); revisiones Cochrane sobre musicoterapia"],
    ["Estructura", "6 partes, 20 capítulos, 14 tablas didácticas, 3 diagramas de flujo, glosario y banco de preguntas"],
    ["Tiempo estimado de lectura", "60–75 minutos (lectura completa); 15 minutos (síntesis infográfica del capítulo 16)"],
    ["Licencia de uso sugerida", "Uso académico y docente con cita de la fuente"],
  ]),
  rotulo("Tabla 1. Ficha técnica del documento maestro."),
  new Paragraph({ children: [new PageBreak()] }),
];

/* ---------- ÍNDICE ---------- */
const indice = [
  H1("Índice de contenidos"),
  P("Para actualizar el índice en Word: haga clic sobre él y pulse F9 (o clic derecho ▸ Actualizar campos ▸ Actualizar toda la tabla).",
    { italics: true, color: GRIS, size: 20, after: 240 }),
  new TableOfContents("Tabla de contenido", {
    hyperlink: true, headingStyleRange: "1-3",
  }),
  new Paragraph({ children: [new PageBreak()] }),
];

/* ---------- GUÍA DE USO Y OBJETIVOS ---------- */
const guia = [
  H1("Cómo usar este documento"),
  P("Este material está diseñado con una lógica de doble entrada. Puede leerse de forma lineal, como una monografía que avanza desde la física del sonido hasta las aplicaciones clínicas; o de forma modular, entrando directamente por el capítulo que responda a la pregunta concreta que se tenga entre manos. Cada parte es autónoma y cierra con elementos visuales de síntesis."),
  H2("Claves de lectura"),
  tabla([1900, 7460], ["Elemento", "Qué significa y cómo aprovecharlo"], [
    ["Cajas azules", "Ideas clave y definiciones operativas. Son el «mínimo indispensable» de cada capítulo: si solo se dispone de cinco minutos, léanse únicamente estas."],
    ["Cajas verdes", "Evidencia científica concreta, con autoría y año. Sirven para citar en clase o en un trabajo académico."],
    ["Cajas coral", "Advertencias, matices y errores de interpretación frecuentes. Protegen contra la sobre-lectura de los titulares."],
    ["Cajas ocre", "Recomendaciones prácticas y protocolos aplicables de inmediato."],
    ["Tablas numeradas", "Material listo para proyectar o fotocopiar como recurso de aula."],
    ["Diagramas de flujo", "Secuencias de procesos: recorrido del sonido, cascada del placer, decisión sobre el uso de música al estudiar."],
  ]),
  rotulo("Tabla 2. Sistema de señalización visual del documento."),
  espacio(160),
  H2("Objetivos de aprendizaje"),
  P("Al terminar la lectura, la persona lectora será capaz de:"),
  paso("Describir el recorrido completo de un estímulo sonoro, desde la onda de presión hasta la respuesta emocional y motora."),
  paso("Distinguir las cuatro redes cerebrales implicadas en la escucha musical y nombrar sus estructuras principales."),
  paso("Explicar, con base en el estudio de Martín-Fernández et al. (2021), por qué el reguetón produjo mayor activación de la red auditivo-motora que la música clásica, y cuáles son los límites de esa conclusión."),
  paso("Diferenciar «activación cerebral» de «calidad musical», «inteligencia» o «beneficio para la salud»."),
  paso("Argumentar por qué el llamado efecto Mozart no sostiene la afirmación de que la música clásica nos vuelve más inteligentes."),
  paso("Seleccionar el acompañamiento sonoro adecuado según el tipo de tarea cognitiva que se vaya a realizar."),
  paso("Calcular de forma aproximada la dosis de exposición sonora diaria y aplicar medidas de protección auditiva basadas en la evidencia."),
  paso("Enumerar las condiciones clínicas en las que la musicoterapia cuenta con respaldo empírico y con qué nivel de solidez."),
  paso("Diseñar una secuencia didáctica de tres sesiones sobre música, cerebro y salud auditiva."),
  new Paragraph({ children: [new PageBreak()] }),
];

/* ================== PARTE I ================== */
const parte1 = [
  ...PARTE("PARTE I", "El punto de partida", "Del titular periodístico al experimento que lo sostiene"),

  H1("1. Introducción: la música como agente biológico"),
  H2("1.1 Una conducta universal sin función evidente"),
  P("No se conoce ninguna cultura humana documentada que carezca de música. Esa universalidad es notable porque, a diferencia de comer, dormir o reproducirse, la música no resuelve ninguna necesidad fisiológica obvia. Es un estímulo abstracto: una secuencia organizada de variaciones de presión del aire que no alimenta, no abriga y no defiende. Y, sin embargo, el sistema nervioso humano la trata con una prioridad que normalmente reserva para recompensas tangibles."),
  P("Esa paradoja —un estímulo sin valor de supervivencia que activa los mismos circuitos que la comida o el sexo— es el punto donde la neurociencia de la música se vuelve interesante para la salud. Si la música puede movilizar el sistema dopaminérgico, modular la frecuencia cardíaca, sincronizar el movimiento y reorganizar patrones de atención, entonces deja de ser un asunto puramente estético y pasa a ser una variable con consecuencias clínicas medibles."),
  caja("Idea clave", [
    "La música no es solo cultura: es un estímulo con efectos fisiológicos reproducibles sobre el sistema auditivo, el sistema motor, el sistema de recompensa y el eje neuroendocrino del estrés. Por eso pertenece legítimamente al dominio de las ciencias de la salud.",
  ], "azul"),
  espacio(160),

  H2("1.2 Las tres preguntas que organiza este documento"),
  P("El material responde a tres interrogantes encadenados, que corresponden a las partes centrales del texto:"),
  bulletRich([["¿Cómo afecta la música al cerebro? ", { b: 1 }], ["Qué estructuras se activan, en qué orden y con qué consecuencias sobre la emoción, la memoria y el movimiento (Parte II)."]]),
  bulletRich([["¿Qué género estimula más las áreas del placer y la concentración? ", { b: 1 }], ["Aquí conviene separar dos preguntas que el titular mezcla: la del placer —donde la evidencia experimental es sólida— y la de la concentración, donde la respuesta es distinta y con frecuencia contraintuitiva (Partes II y III)."]]),
  bulletRich([["¿Cómo afecta la música a la audición? ", { b: 1 }], ["El mismo estímulo que activa el circuito de recompensa puede destruir de forma irreversible el órgano que lo capta. Es el gran punto ciego de la conversación pública sobre música y bienestar (Parte IV)."]]),
  espacio(120),
  caja("Advertencia de lectura", [
    "Las tres preguntas tienen respuestas de solidez muy desigual. La primera cuenta con miles de estudios de neuroimagen convergentes. La segunda depende críticamente de cómo se defina «estimular más». La tercera es la mejor establecida de todas —la relación dosis-daño auditivo es una de las curvas mejor caracterizadas de la salud ocupacional— y, paradójicamente, la que menos aparece en los titulares.",
  ], "coral"),

  new Paragraph({ children: [new PageBreak()] }),

  H1("2. El artículo detonante y el estudio que lo sostiene"),
  H2("2.1 Qué afirma el titular"),
  P("El artículo de Xataka que motiva este documento recoge una idea que circuló ampliamente en medios hispanohablantes durante 2026: que el reguetón sería «la música que más partes del cerebro activa, por encima de la clásica». La afirmación no es una ocurrencia periodística; procede de un experimento real, publicado en una revista con revisión por pares, cuyos datos merecen ser examinados con precisión antes de aceptarlos o descartarlos."),
  caja("Nota metodológica sobre las fuentes", [
    "El acceso directo al artículo de Xataka no fue posible desde el entorno de elaboración de este documento por una restricción de red. Para no depender de una lectura de segunda mano, el contenido se ha reconstruido a partir de la fuente científica primaria que el propio artículo cita —el estudio publicado en Neuroscience— y del contraste con la cobertura del mismo estudio en El Tiempo, La Nación y otros medios. El resultado es un documento más verificable que la nota de prensa original, porque cita el experimento y no su resumen.",
  ], "gris"),
  espacio(160),

  H2("2.2 Ficha del estudio primario"),
  tabla([2500, 6860], ["Elemento", "Detalle"], [
    ["Título", "Music Style Not Only Modulates the Auditory Cortex, but Also Motor Related Areas"],
    ["Autoría", "Jesús Martín-Fernández, Iballa Burunat, Cristián Modroño, José Luis González-Mora y Julio Plata-Bello"],
    ["Instituciones", "Universidad de La Laguna (Tenerife, Islas Canarias, España) y Universidad de Jyväskylä (Finlandia)"],
    ["Publicación", "Neuroscience, volumen 457 (2021), páginas 88–102"],
    ["DOI", "10.1016/j.neuroscience.2021.01.012"],
    ["Técnica", "Resonancia magnética funcional (fMRI) — medición indirecta de actividad neural mediante señal BOLD"],
    ["Participantes", "28 personas adultas sin formación musical formal"],
    ["Condición experimental", "Escucha pasiva (sin tarea motora ni verbal asociada)"],
    ["Géneros comparados", "Clásica · Folclore (música tradicional canaria) · Electrónica · Reguetón"],
    ["Control crítico", "Fragmentos exclusivamente instrumentales: se eliminaron las voces y las letras"],
    ["Análisis", "Contraste de cerebro completo (whole-brain) entre géneros"],
  ]),
  rotulo("Tabla 3. Ficha técnica del estudio de referencia."),
  espacio(160),

  H2("2.3 Por qué el diseño del experimento es inteligente"),
  P("Dos decisiones metodológicas hacen que este estudio sea más informativo que la mayoría de comparaciones entre géneros musicales."),
  P("La primera es la eliminación de las letras. Una canción de reguetón con voz activa, además del sistema auditivo, toda la red del lenguaje: giro temporal superior posterior, área de Wernicke, fascículo arqueado, área de Broca. Si se compara una canción cantada con una sonata instrumental, buena parte de la diferencia observada sería atribuible al procesamiento lingüístico y no a la música. Al trabajar solo con pistas instrumentales, los autores aislaron la contribución de los parámetros estrictamente musicales: ritmo, timbre, armonía y estructura métrica."),
  P("La segunda es el reclutamiento de participantes sin formación musical. El cerebro de un músico profesional procesa la música de manera medible y estructuralmente distinta —mayor cuerpo calloso, cortezas auditiva y motora más desarrolladas, distinta lateralización. Usar personas sin entrenamiento reduce ese factor de confusión y permite hablar de una respuesta más cercana a la del oyente promedio."),
  caja("Evidencia", [
    "El diseño de Martín-Fernández et al. (2021) compara cuatro géneros en escucha pasiva, con estímulos instrumentales y participantes sin formación musical. Esto convierte el resultado en una comparación de estructuras musicales, no de letras ni de pericia auditiva.",
  ], "teal"),
  espacio(160),

  H2("2.4 Qué encontraron"),
  P("El contraste de cerebro completo arrojó un patrón consistente que puede resumirse en tres hallazgos."),
  paso("El reguetón produjo mayor actividad que los otros tres géneros en las áreas relacionadas con el procesamiento auditivo.", 1),
  paso("El reguetón activó además regiones relacionadas con el movimiento, un efecto que se hizo especialmente marcado en la comparación directa contra la música clásica.", 1),
  paso("Se observó implicación de los ganglios basales, estructuras subcorticales que modulan el movimiento y participan en el procesamiento de la recompensa.", 1),
  espacio(120),
  P("La conclusión de los autores, formulada con la prudencia propia del género académico, es que el estilo musical no modula únicamente la corteza auditiva, sino también áreas motoras, y que entre los géneros estudiados el reguetón fue el que evocó mayor actividad en la red auditivo-motora."),
  espacio(120),
  tabla([2300, 3600, 3460], ["Género", "Perfil de activación observado", "Interpretación funcional"], [
    ["Reguetón", "Máxima activación de la red auditivo-motora; implicación de áreas motoras y ganglios basales", "Patrón rítmico muy predecible con síncopa moderada: el cerebro anticipa el pulso y prepara movimiento"],
    ["Electrónica", "Activación auditiva alta; componente motor presente pero menor que el reguetón", "Pulso regular y potente, con menor riqueza de síncopa en los fragmentos empleados"],
    ["Folclore", "Activación auditiva intermedia", "Estructura métrica reconocible con mayor variabilidad tímbrica"],
    ["Clásica", "Menor activación de la red auditivo-motora en el contraste directo con reguetón", "Métrica y tonalidad cambiantes y menos predecibles: el sistema motor no encuentra un pulso estable que anticipar"],
  ], { size: 19 }),
  rotulo("Tabla 4. Síntesis comparativa de los resultados. La descripción por género integra el contraste principal del estudio con el marco teórico de predicción rítmica desarrollado en el capítulo 6."),
  espacio(160),

  H2("2.5 Cómo leer bien este resultado"),
  P("Aquí es donde la divulgación suele descarrilar. El estudio dice algo preciso y limitado; el titular tiende a convertirlo en algo amplio y evaluativo. Conviene fijar cuatro cautelas."),
  caja("Cuatro errores de interpretación que hay que evitar", [
    ["«Más activación» no significa «mejor música». ", { b: 1 }],
    ["La activación cerebral es una medida de coste y participación de recursos neurales, no un certificado de calidad, complejidad ni valor estético. Un estímulo puede activar mucho porque es simple y arrastra al sistema motor, y otro puede activar de forma más focal porque es complejo y exige procesamiento fino en áreas especializadas.", {}],
  ], "coral"),
  espacio(80),
  caja(null, [
    ["«Más activación» no significa «más beneficio para la salud». ", { b: 1 }],
    ["El estudio no midió estado de ánimo, ansiedad, presión arterial, rendimiento cognitivo ni ningún desenlace clínico. Midió señal BOLD durante escucha pasiva.", {}],
  ], "coral"),
  espacio(80),
  caja(null, [
    ["No es «el cerebro», son 28 cerebros en un contexto cultural concreto. ", { b: 1 }],
    ["La muestra es pequeña —lo habitual en fMRI, por coste— y la familiaridad cultural con el reguetón en un entorno hispanohablante es un factor que no puede descartarse: el cerebro responde de forma distinta a los patrones rítmicos con los que ha crecido.", {}],
  ], "coral"),
  espacio(80),
  caja(null, [
    ["La red auditivo-motora no es «todo el cerebro». ", { b: 1 }],
    ["Decir que un género «activa más partes del cerebro» sugiere un recuento global de regiones. Lo que el estudio muestra es una ventaja específica en un circuito concreto: el que une audición y movimiento. En otras redes —memoria autobiográfica, procesamiento armónico fino, atención sostenida— el ranking podría invertirse perfectamente.", {}],
  ], "coral"),
];

/* ================== PARTE II ================== */
const parte2 = [
  ...PARTE("PARTE II", "Cómo la música afecta al cerebro", "El recorrido del sonido, las cuatro redes y el circuito del placer"),

  H1("3. La ruta del sonido: de la onda a la emoción"),
  P("Antes de hablar de géneros conviene entender el trayecto. Lo que llamamos «escuchar música» es una cadena de transformaciones en la que una perturbación mecánica del aire acaba convertida en experiencia subjetiva. Cada eslabón puede fallar, y cada eslabón puede intervenirse clínicamente."),
  espacio(140),
  flujo([
    ["Onda de presión y captación", "El pabellón auricular concentra las variaciones de presión del aire y las canaliza por el conducto auditivo externo hasta la membrana timpánica, que vibra reproduciendo la forma de la onda."],
    ["Amplificación mecánica (oído medio)", "La cadena de huesecillos —martillo, yunque y estribo— actúa como un transformador de impedancia: adapta la vibración del aire, poco denso, al líquido del oído interno, mucho más denso. Sin este paso se perdería alrededor del 99 % de la energía sonora."],
    ["Transducción coclear (oído interno)", "En la cóclea, la onda viaja por la membrana basilar, que está organizada tonotópicamente: los agudos excitan la base y los graves el ápice. Las células ciliadas convierten el movimiento mecánico en impulsos eléctricos. Son unas 15.000 por oído y no se regeneran."],
    ["Vía auditiva ascendente", "El nervio coclear conduce la señal al núcleo coclear del tronco encefálico, y de ahí al complejo olivar superior, el lemnisco lateral, el colículo inferior y el cuerpo geniculado medial del tálamo. En el camino ya se calculan la localización espacial y las primeras regularidades temporales."],
    ["Corteza auditiva primaria (giro de Heschl)", "En el lóbulo temporal, la señal se reconstruye como altura tonal, timbre e intensidad. Aquí la música todavía no «significa» nada: es análisis acústico."],
    ["Cortezas auditivas secundarias y de asociación", "El giro temporal superior y el plano temporal extraen estructura: melodía, métrica, contorno armónico, patrón repetitivo. Es donde el cerebro pasa de oír sonidos a reconocer música."],
    ["Difusión hacia redes no auditivas", "La estructura extraída se distribuye simultáneamente al sistema motor (preparación del movimiento), al sistema límbico (emoción), al hipocampo (memoria autobiográfica) y al circuito mesolímbico de recompensa (placer). Este es el punto donde escuchar deja de ser un acto sensorial y se convierte en una experiencia."],
  ]),
  rotulo("Diagrama 1. Recorrido del estímulo musical, del aire a la experiencia subjetiva."),
  espacio(160),
  caja("Idea clave", [
    "La música no se procesa en un «centro musical». No existe tal cosa. Se procesa en paralelo por al menos cuatro redes distribuidas que operan de forma simultánea. Por eso una canción puede, en el mismo segundo, hacer que se mueva el pie, se erice la piel y se recuerde un verano concreto de hace veinte años.",
  ], "azul"),

  new Paragraph({ children: [new PageBreak()] }),

  H1("4. Las cuatro redes de la escucha musical"),
  P("Organizar la respuesta cerebral en redes funcionales evita la trampa del «mapa de puntitos» y permite explicar por qué géneros distintos producen perfiles distintos. La tabla siguiente es la pieza central de este documento desde el punto de vista didáctico."),
  espacio(140),
  tabla([1750, 2750, 2500, 2360],
    ["Red", "Estructuras principales", "Función", "Experiencia subjetiva"], [
    ["Auditiva",
      "Giro de Heschl (corteza auditiva primaria), giro temporal superior, plano temporal",
      "Analiza altura, timbre, intensidad y estructura métrica; construye la representación de «esto es música»",
      "Reconocer la canción, distinguir instrumentos, notar una nota desafinada"],
    ["Auditivo-motora",
      "Área motora suplementaria, corteza premotora, cerebelo, ganglios basales (putamen)",
      "Extrae el pulso, predice el siguiente golpe y prepara el movimiento aunque no se mueva ni un músculo",
      "Llevar el ritmo con el pie, ganas irresistibles de bailar, sensación de «groove»"],
    ["De recompensa",
      "Área tegmental ventral, núcleo accumbens, núcleo caudado, corteza orbitofrontal",
      "Libera dopamina ante la anticipación y la consumación de un evento musical esperado",
      "Placer, euforia, piel de gallina, deseo de repetir la canción"],
    ["Límbico-mnésica y ejecutiva",
      "Amígdala, hipocampo, corteza cingulada, corteza prefrontal medial y dorsolateral",
      "Asigna valencia emocional, recupera memoria autobiográfica y regula el foco atencional",
      "Emoción intensa, nostalgia, recuerdo vívido asociado, aumento o pérdida de concentración"],
  ], { size: 18, headSize: 18 }),
  rotulo("Tabla 5. Las cuatro redes de la escucha musical. Recurso recomendado para proyección en aula."),
  espacio(160),
  P("El hallazgo de Martín-Fernández et al. (2021) se ubica con precisión en la segunda fila de esta tabla: lo que el reguetón maximizó fue la red auditivo-motora. No se demostró que maximizara la red límbica ni la ejecutiva. Esta distinción es exactamente la que se pierde cuando el resultado se comprime en un titular."),
  espacio(120),
  caja("Advertencia", [
    "Que un género active más la red auditivo-motora no implica que active más la red del placer, aunque ambas compartan los ganglios basales y estén estrechamente acopladas. La superposición anatómica sugiere una relación —el movimiento y la recompensa comparten circuitería— pero no la demuestra. El estudio no midió placer subjetivo.",
  ], "coral"),

  new Paragraph({ children: [new PageBreak()] }),

  H1("5. El circuito del placer: dopamina, expectativa y piel de gallina"),
  H2("5.1 El experimento que lo demostró"),
  P("La demostración más elegante de que la música activa el sistema de recompensa la aportaron Salimpoor y colaboradores en 2011, en un trabajo publicado en Nature Neuroscience. El diseño combinó dos técnicas de neuroimagen sobre los mismos participantes y los mismos estímulos: tomografía por emisión de positrones con raclopride, que permite medir liberación endógena de dopamina, y resonancia magnética funcional, que aporta resolución temporal."),
  P("Los investigadores utilizaron como marcador el fenómeno de los escalofríos musicales —el frisson, la piel de gallina—, un indicador fiable de respuesta emocional máxima. Los participantes escuchaban música elegida por ellos mismos, capaz de provocarles esa reacción."),
  caja("Evidencia", [
    ["Salimpoor, V. N. y cols. (2011). ", { b: 1 }],
    ["Anatomically distinct dopamine release during anticipation and experience of peak emotion to music. ", { i: 1 }],
    ["Nature Neuroscience, 14(2), 257–262. Se documentó liberación endógena de dopamina en el estriado durante los picos de arousal emocional, con una disociación funcional: el núcleo caudado se implicaba durante la anticipación del clímax musical, mientras que el núcleo accumbens lo hacía durante la experiencia del clímax. Los mayores cambios en el potencial de unión dopaminérgico se registraron en el caudado derecho y en el núcleo accumbens.", {}],
  ], "teal"),
  espacio(160),

  H2("5.2 Por qué es un hallazgo importante"),
  P("Hasta ese momento se sabía que la dopamina se liberaba ante recompensas biológicamente relevantes: comida, sexo, sustancias psicoactivas. Todas ellas tienen valor de supervivencia o actúan farmacológicamente sobre el circuito. La música no es ninguna de las dos cosas: es un patrón abstracto de aire en movimiento. Que consiga movilizar el mismo sistema obliga a concluir que el circuito de recompensa humano responde también a la estructura de la información, no solo a su contenido material."),
  P("La disociación temporal es la parte más reveladora. Que el caudado se active antes del clímax significa que el placer musical es, en una proporción sustancial, placer de anticipación. No disfrutamos únicamente del acorde que llega: disfrutamos de haberlo predicho correctamente. La música es un juego de expectativas, y el cerebro cobra su recompensa por acertar."),
  espacio(140),
  flujo([
    ["Exposición y aprendizaje estadístico", "Tras años de escucha, el cerebro ha extraído las regularidades de su cultura musical: qué acorde suele seguir a cuál, dónde cae el golpe fuerte, cómo se resuelve una tensión."],
    ["Formación de la expectativa", "Al sonar una frase musical, el sistema genera una predicción del evento siguiente. Este es el trabajo del modelo predictivo cortical."],
    ["Anticipación — dopamina en el núcleo caudado", "En los segundos previos al momento esperado, se libera dopamina. Es la fase de deseo, de tensión placentera."],
    ["Resolución — dopamina en el núcleo accumbens", "Cuando llega el evento, se libera dopamina en el accumbens. Es la fase de consumación: la satisfacción, el escalofrío."],
    ["Refuerzo y repetición", "El episodio queda marcado como valioso. Aumenta la probabilidad de volver a buscar esa canción. Es el mecanismo por el que una canción se vuelve adictiva."],
  ]),
  rotulo("Diagrama 2. La cascada del placer musical: de la expectativa aprendida al refuerzo."),
  espacio(160),
  caja("Idea clave", [
    "El placer musical vive en la tensión entre lo que el cerebro predice y lo que efectivamente ocurre. Demasiada predictibilidad produce aburrimiento —no hay error que resolver. Demasiada sorpresa produce ruido —no hay modelo que aplicar. El placer máximo está en un punto intermedio, y ese punto es el objeto del capítulo siguiente.",
  ], "azul"),

  new Paragraph({ children: [new PageBreak()] }),

  H1("6. Ritmo y groove: el punto dulce de la síncopa"),
  H2("6.1 La curva en U invertida"),
  P("Witek y colaboradores publicaron en 2014, en PLOS ONE, el estudio que dio forma cuantitativa a esta intuición. Presentaron a los participantes patrones rítmicos con grados crecientes de síncopa —el desplazamiento de acentos respecto al pulso métrico esperado— y les pidieron valorar dos cosas: cuánto placer sentían y cuántas ganas tenían de moverse."),
  P("El resultado fue una curva en U invertida limpia. Los ritmos con síncopa baja se valoraron como aburridos y produjeron poco deseo de movimiento. Los ritmos con síncopa muy alta se percibieron como caóticos, difíciles de interpretar, y también puntuaron bajo. El máximo de placer y de ganas de moverse se situó en un grado intermedio de complejidad rítmica: el punto dulce del groove."),
  caja("Evidencia", [
    ["Witek, M. A. G. y cols. (2014). ", { b: 1 }],
    ["Syncopation, body-movement and pleasure in groove music. ", { i: 1 }],
    ["PLOS ONE, 9(4), e94446. Relación en U invertida entre grado de síncopa y las valoraciones de placer y deseo de movimiento: los grados intermedios de complejidad rítmica ofrecen el óptimo. Bajo el marco del procesamiento predictivo, los ritmos moderadamente sincopados generan el mayor número de errores de predicción fuertemente ponderados, y el impulso de moverse se interpreta como un intento corporal de reducir esa incertidumbre sensorial.", {}],
  ], "teal"),
  espacio(160),
  tabla([2000, 2400, 2400, 2560],
    ["Complejidad rítmica", "Predicción del cerebro", "Respuesta motora", "Ejemplo aproximado"], [
    ["Muy baja", "Trivial: el modelo acierta siempre; no hay error informativo", "Escasa: nada que resolver", "Metrónomo, pulso plano sin acentos"],
    ["Moderada — punto dulce", "Acierta el marco métrico, pero los acentos desplazados generan errores de predicción informativos", "Máxima: el cuerpo «completa» los huecos del patrón", "Dembow del reguetón, funk, afrobeat, samba"],
    ["Muy alta", "El modelo métrico no logra estabilizarse", "Baja: se percibe como caos, no como pulso", "Jazz de vanguardia, música contemporánea atonal, polirritmias extremas"],
  ], { size: 19 }),
  rotulo("Tabla 6. La U invertida de la síncopa: por qué un ritmo hace bailar y otro no."),
  espacio(160),

  H2("6.2 Por qué el reguetón cae justo en el punto dulce"),
  P("El reguetón se construye sobre el patrón dembow, una figura rítmica cuya subdivisión característica responde a la agrupación 3+3+2 dentro del compás. Esta estructura tiene tres propiedades que la sitúan casi por diseño en el óptimo descrito por Witek."),
  bulletRich([["Pulso estable y bajo en frecuencia. ", { b: 1 }], ["El bombo marca un pulso regular, en un rango grave que el sistema vestibular y somatosensorial registran con especial eficacia. El cerebro fija el marco métrico en pocos compases."]]),
  bulletRich([["Síncopa moderada y constante. ", { b: 1 }], ["La agrupación 3+3+2 desplaza acentos respecto a la cuadrícula binaria sin destruirla. Se generan errores de predicción, pero siempre resolubles."]]),
  bulletRich([["Repetición prolongada del patrón. ", { b: 1 }], ["El bucle se mantiene durante toda la pieza, lo que permite que el modelo predictivo se consolide y que cada iteración refuerce la sensación de acierto."]]),
  espacio(120),
  P("Contrastemos con una sonata clásica. En ella la métrica cambia de densidad, el tempo respira mediante rubato, la tonalidad modula, la textura pasa de homofónica a contrapuntística. El sistema predictivo trabaja intensamente, pero en el dominio armónico y estructural, no en el dominio del pulso. El resultado es una experiencia estética rica que no recluta al sistema motor de la misma manera. Los autores del estudio de 2021 lo formularon en términos equivalentes: mientras que en una obra clásica el ritmo y las tonalidades cambian de forma constante y poco predecible, el reguetón ofrece una estructura que el cerebro procesa y anticipa con facilidad."),
  espacio(120),
  caja("El matiz decisivo", [
    "Que el reguetón sea más eficiente para reclutar la red auditivo-motora no lo convierte en música «superior», del mismo modo que un alimento hipercalórico no es nutricionalmente superior por activar más el circuito de recompensa. Son métricas distintas. La eficiencia neural para provocar movimiento y el valor estético o cognitivo de una obra son dimensiones independientes, y confundirlas es el error central de la mayoría de titulares sobre este estudio.",
  ], "coral"),

  new Paragraph({ children: [new PageBreak()] }),

  H1("7. Entonces, ¿qué género es el mejor?"),
  P("La pregunta, planteada así, no tiene respuesta científica. Reformulada como «¿qué género es más eficaz para qué objetivo?», sí la tiene. La tabla siguiente sintetiza el estado de la evidencia distinguiendo objetivos."),
  espacio(140),
  tabla([2500, 3400, 3460], ["Objetivo", "Perfil sonoro más eficaz", "Base de la recomendación"], [
    ["Activar el movimiento, iniciar actividad física, romper la inercia",
      "Ritmo marcado, tempo 120–140 ppm, síncopa moderada: reguetón, funk, afrobeat, electrónica de pulso claro",
      "Máxima activación de la red auditivo-motora (Martín-Fernández et al., 2021); punto dulce de la U invertida (Witek et al., 2014)"],
    ["Provocar placer intenso y escalofríos",
      "Cualquier género, siempre que sea música elegida por la propia persona y familiar",
      "En Salimpoor et al. (2011) la liberación dopaminérgica se obtuvo con música autoseleccionada: la preferencia personal pesa más que el género"],
    ["Concentración en tareas verbales (leer, escribir, estudiar)",
      "Silencio, o sonido sin letra y sin variación brusca: ambient, ruido rosa, lo-fi de baja variabilidad",
      "El efecto del sonido irrelevante: el habla y la letra compiten por el bucle fonológico de la memoria de trabajo"],
    ["Tareas repetitivas o monótonas que requieren mantener el arousal",
      "Música con letra y tempo alto, del agrado del usuario",
      "Hipótesis de arousal y estado de ánimo: el beneficio proviene de la activación general, no de la música en sí"],
    ["Reducción de ansiedad y estrés",
      "Tempo lento (60–80 ppm), dinámica estable, instrumentación suave, sin sorpresas armónicas",
      "Ensayos sobre ansiedad preoperatoria y respuesta de cortisol; el criterio clave es la predictibilidad, no el género"],
    ["Rehabilitación de la marcha",
      "Pulso metronómico externo estable, ajustado a la cadencia objetivo del paciente",
      "Estimulación auditiva rítmica: acoplamiento directo entre pulso auditivo y programa motor"],
  ], { size: 18, headSize: 18 }),
  rotulo("Tabla 7. Selección musical según objetivo. Ninguna fila afirma superioridad general de un género."),
  espacio(160),
  caja("Respuesta directa a la pregunta rectora", [
    ["Para el placer y la activación motora, ", { b: 1 }],
    ["la evidencia disponible sitúa a los géneros de ritmo repetitivo con síncopa moderada —el reguetón entre ellos— como los más eficaces para reclutar la red auditivo-motora y los ganglios basales. ", {}],
    ["Para la concentración, ", { b: 1 }],
    ["la evidencia apunta en dirección opuesta: exactamente los rasgos que hacen bailable una canción —pulso marcado, repetición, letra pegadiza— son los que interfieren con las tareas cognitivas de mayor demanda verbal. No hay un género que gane en ambos frentes.", {}],
  ], "azul"),
];

/* ================== PARTE III ================== */
const parte3 = [
  ...PARTE("PARTE III", "Música y concentración", "Lo que la evidencia dice, y lo que el mito del efecto Mozart nunca dijo"),

  H1("8. El efecto Mozart: anatomía de un malentendido"),
  H2("8.1 Qué decía realmente el estudio original"),
  P("En 1993 Rauscher, Shaw y Ky publicaron en Nature una comunicación breve. Estudiantes universitarios que escuchaban diez minutos de una sonata de Mozart mostraban una mejora en una tarea concreta de razonamiento espacial-temporal —doblar y cortar papel mentalmente— frente a quienes escuchaban instrucciones de relajación o silencio. La mejora equivalía a unos pocos puntos y desaparecía en un plazo de diez a quince minutos."),
  P("El estudio nunca afirmó que Mozart aumentara la inteligencia. Ni que el efecto fuera duradero. Ni que se aplicara a niños, y menos aún a fetos. La distancia entre ese hallazgo modesto y la industria de discos «para bebés inteligentes» que generó es uno de los casos mejor documentados de deriva entre ciencia y cultura popular."),
  espacio(140),
  H2("8.2 Qué encontró el metaanálisis"),
  caja("Evidencia", [
    ["Pietschnig, J., Voracek, M. y Formann, A. K. (2010). ", { b: 1 }],
    ["Metaanálisis realizado en la Facultad de Psicología de la Universidad de Viena sobre el conjunto de estudios del efecto Mozart. La conclusión fue que el impacto de escuchar música de Mozart sobre el rendimiento cognitivo es pequeño y no significativo, y que no se sostiene a largo plazo. El análisis estadístico no encontró cambios relevantes en las habilidades cognitivas de quienes habían escuchado a Mozart.", {}],
  ], "teal"),
  espacio(140),
  P("La explicación que ha resistido mejor el escrutinio es la hipótesis de arousal y estado de ánimo. Escuchar música agradable eleva transitoriamente el nivel de alerta y mejora el humor; una persona más despierta y de mejor ánimo rinde algo mejor en una tarea inmediatamente posterior. El efecto es real, pero no tiene nada de específicamente mozartiano: se reproduce con cualquier estímulo que resulte estimulante y agradable para el sujeto, incluida la lectura de un texto que le interese."),
  caja("Advertencia", [
    "El efecto Mozart no demuestra que la música clásica sea buena para el cerebro. Demuestra que estar despierto y de buen humor ayuda a hacer un test. Cualquier música que le guste a la persona produce el mismo efecto, y una taza de café también.",
  ], "coral"),

  new Paragraph({ children: [new PageBreak()] }),

  H1("9. Estudiar con música: qué funciona y qué no"),
  H2("9.1 El efecto del sonido irrelevante"),
  P("El mecanismo que mejor explica la interferencia de la música durante el estudio es el efecto del sonido irrelevante. La memoria de trabajo verbal opera mediante un bucle fonológico, un almacén de capacidad muy limitada que mantiene información sonora y lingüística durante unos segundos. Leer, redactar, memorizar vocabulario o razonar verbalmente ocupan ese bucle."),
  P("Cuando suena música con letra, el sistema no puede impedir que las palabras entren en el mismo almacén: el procesamiento del habla es obligatorio, no voluntario. El resultado es una competencia directa por un recurso escaso. Por eso la música con letra perjudica de forma sistemática las tareas que emplean el canal lingüístico interno, mientras que apenas afecta —o incluso favorece— a tareas espaciales, manuales o repetitivas que no lo utilizan."),
  espacio(140),
  H2("9.2 Recomendación por tipo de tarea"),
  tabla([2700, 3200, 3460], ["Tarea", "Recomendación sonora", "Por qué"], [
    ["Lectura comprensiva, redacción, traducción, estudio de textos",
      "Silencio o ruido de fondo constante y sin habla (ruido rosa o marrón, ambient sin melodía definida)",
      "Competencia directa por el bucle fonológico. Es la situación de mayor interferencia documentada"],
    ["Memorización de listas, vocabulario, secuencias",
      "Silencio, sin excepción",
      "La codificación serial es especialmente vulnerable a cualquier variación acústica"],
    ["Resolución de problemas matemáticos o lógicos",
      "Instrumental de baja variabilidad, volumen bajo; el silencio sigue siendo la opción más segura",
      "La carga verbal es menor, pero los cambios bruscos de dinámica capturan la atención de forma involuntaria"],
    ["Trabajo espacial, diseño, dibujo, edición visual",
      "Música instrumental de preferencia personal, tempo moderado",
      "Escaso solapamiento de recursos; el beneficio de arousal puede superar al coste de interferencia"],
    ["Tareas repetitivas, mecánicas o administrativas",
      "Música con letra, tempo alto, del agrado del usuario",
      "El riesgo principal es la caída del nivel de alerta, no la interferencia cognitiva"],
    ["Ejercicio físico",
      "120–140 ppm, ritmo marcado",
      "Sincronización motora, reducción del esfuerzo percibido, aumento del tiempo hasta el agotamiento"],
    ["Entorno de oficina abierta o biblioteca ruidosa",
      "Ruido de enmascaramiento o música instrumental muy repetitiva con auriculares",
      "Una fuente sonora constante y previsible es preferible a un entorno con conversaciones intermitentes"],
  ], { size: 18, headSize: 18 }),
  rotulo("Tabla 8. Guía de decisión sonora según demanda cognitiva de la tarea."),
  espacio(160),

  H2("9.3 Protocolo práctico"),
  caja("Siete reglas para usar la música como herramienta de estudio", [
    ["1. Separe fases. ", { b: 1 }], ["Use música con energía para arrancar y vencer la procrastinación; apáguela al entrar en la fase de comprensión profunda.", {}],
  ], "ocre"),
  espacio(70),
  caja(null, [
    ["2. Sin letra durante el trabajo verbal. ", { b: 1 }], ["Es la regla de mayor rendimiento y la más incumplida.", {}],
  ], "ocre"),
  espacio(70),
  caja(null, [
    ["3. Elija repertorio conocido y aburrido. ", { b: 1 }], ["La música nueva captura atención. La conocida se vuelve fondo. Paradójicamente, la mejor música para estudiar es aquella a la que se presta menos atención.", {}],
  ], "ocre"),
  espacio(70),
  caja(null, [
    ["4. Volumen bajo, por debajo del 50 %. ", { b: 1 }], ["Protege la audición y reduce la captura atencional involuntaria.", {}],
  ], "ocre"),
  espacio(70),
  caja(null, [
    ["5. Una sola lista, sin gestionarla. ", { b: 1 }], ["Cambiar de canción es una microinterrupción que fragmenta la atención sostenida.", {}],
  ], "ocre"),
  espacio(70),
  caja(null, [
    ["6. Desconfíe de los ritmos binaurales. ", { b: 1 }], ["La evidencia sobre su efecto en la concentración es débil, heterogénea y con estudios de baja calidad metodológica. Si funcionan, probablemente lo hagan por el mismo mecanismo de arousal y enmascaramiento que cualquier sonido constante.", {}],
  ], "ocre"),
  espacio(70),
  caja(null, [
    ["7. Contrástelo consigo mismo. ", { b: 1 }], ["La variabilidad interindividual es alta. Haga la prueba: dos semanas con música, dos sin ella, midiendo páginas comprendidas o problemas resueltos por hora. El dato propio vale más que cualquier recomendación general.", {}],
  ], "ocre"),
];

/* ================== PARTE IV ================== */
const parte4 = [
  ...PARTE("PARTE IV", "Música y audición", "El coste biológico del volumen: la parte que los titulares omiten"),

  H1("10. Cómo se rompe el oído"),
  H2("10.1 Las células que no vuelven"),
  P("El órgano de Corti aloja alrededor de 15.000 células ciliadas por oído. Las externas amplifican y afinan la señal; las internas la transducen en impulsos nerviosos. En el ser humano, y en los mamíferos en general, estas células no se regeneran. Cada una que se pierde se pierde para siempre. Esta es la diferencia fundamental entre el daño auditivo y casi cualquier otro daño tisular del organismo: no hay reparación, no hay cicatriz funcional, no hay recuperación espontánea."),
  P("La exposición a sonido intenso las daña por dos vías. La mecánica, cuando la amplitud del movimiento de la membrana basilar excede lo tolerable y los estereocilios se doblan o se fracturan. Y la metabólica, más insidiosa: la estimulación sostenida genera estrés oxidativo y agotamiento energético en la célula, que muere por apoptosis horas o días después de la exposición."),
  espacio(140),
  H2("10.2 Del cansancio temporal al daño permanente"),
  tabla([2400, 3400, 3560], ["Fenómeno", "Qué ocurre", "Relevancia clínica"], [
    ["Desplazamiento temporal del umbral",
      "Tras un concierto, los sonidos se perciben apagados y aparece un zumbido. El umbral auditivo se recupera en horas o días",
      "No es inofensivo: es la señal de que hubo estrés celular. Su repetición acumula daño permanente"],
    ["Desplazamiento permanente del umbral",
      "La recuperación es incompleta. Se instaura una pérdida definitiva, típicamente con una muesca en torno a los 4.000 Hz",
      "Es la hipoacusia inducida por ruido clásica. Suele detectarse tarde, cuando ya afecta a la comprensión del habla"],
    ["Sinaptopatía coclear",
      "Se pierden sinapsis entre células ciliadas internas y fibras del nervio auditivo sin que cambie el umbral tonal",
      "La audiometría convencional sale normal, pero la persona no entiende en ambientes ruidosos. Es la llamada pérdida auditiva oculta"],
    ["Acúfenos (tinnitus)",
      "Percepción de un sonido sin fuente externa, habitualmente agudo y continuo",
      "Con frecuencia es la primera manifestación del daño. Puede volverse crónico e interferir gravemente con el sueño y el ánimo"],
    ["Hiperacusia",
      "Intolerancia a sonidos de intensidad normal, que se perciben como dolorosos",
      "Deteriora de forma marcada la calidad de vida y la participación social"],
  ], { size: 18, headSize: 18 }),
  rotulo("Tabla 9. Espectro del daño auditivo inducido por sonido intenso."),
  espacio(160),
  caja("Idea clave", [
    "El daño auditivo es acumulativo, silencioso e irreversible. No duele mientras ocurre y no se percibe hasta que la pérdida es sustancial. Esa combinación —ausencia de señal de alarma y ausencia de reparación— lo convierte en un problema de salud pública de primer orden en la generación que ha crecido con auriculares.",
  ], "azul"),

  new Paragraph({ children: [new PageBreak()] }),

  H1("11. La dosis hace el daño"),
  P("El daño auditivo no depende solo de la intensidad, sino del producto de intensidad por tiempo. La escala de decibelios es logarítmica: un aumento de 3 dB duplica la energía sonora y, en consecuencia, reduce a la mitad el tiempo de exposición segura. Esta regla de intercambio de 3 dB es la base de la tabla siguiente."),
  espacio(140),
  tabla([1600, 3900, 3860], ["Nivel (dBA)", "Situación equivalente", "Tiempo de exposición diaria antes de riesgo"], [
    ["60–70", "Conversación normal, oficina tranquila", "Sin límite práctico"],
    ["80", "Tráfico urbano denso, aspiradora", "Alrededor de 25 horas semanales (referencia OMS para adultos: 80 dB / 40 h semanales)"],
    ["85", "Tráfico intenso, restaurante ruidoso", "8 horas"],
    ["88", "Cortacésped, secador de pelo cerca del oído", "4 horas"],
    ["91", "Motocicleta, metro en marcha", "2 horas"],
    ["94", "Auriculares a volumen alto", "1 hora"],
    ["97", "Taladro, sierra eléctrica", "30 minutos"],
    ["100", "Discoteca, concierto, auriculares al máximo en muchos dispositivos", "15 minutos"],
    ["103", "Zona próxima al escenario de un concierto", "Menos de 8 minutos"],
    ["110", "Sirena cercana, altavoz de gran potencia a corta distancia", "Menos de 2 minutos"],
    ["120–130", "Umbral de dolor; petardo, despegue de aeronave", "Daño posible de forma inmediata"],
  ], { size: 19 }),
  rotulo("Tabla 10. Relación dosis-tiempo de exposición segura. Valores orientativos según el criterio de intercambio de 3 dB y las referencias de la OMS."),
  espacio(160),
  caja("Referencia normativa", [
    ["En marzo de 2022 la Organización Mundial de la Salud publicó la ", {}],
    ["Norma mundial para la escucha sin riesgos en locales y eventos musicales", { i: 1 }],
    [", que fija un límite de 100 dB (LAeq) medido en períodos de 15 minutos, junto con la obligación de disponer de zonas de descanso auditivo, protección auditiva disponible y monitorización del sonido. La OMS estima que más de mil millones de personas de entre 12 y 35 años están en riesgo de pérdida auditiva por exposición prolongada a música y sonidos recreativos intensos.", {}],
  ], "teal"),

  new Paragraph({ children: [new PageBreak()] }),

  H1("12. Protección auditiva: protocolo aplicable"),
  H2("12.1 Las reglas de oro"),
  caja("Regla 60/60", [
    "No más del 60 % del volumen máximo del dispositivo, durante no más de 60 minutos seguidos. Es la regla más difundida y la más fácil de recordar. Tras cada hora, un descanso de al menos diez minutos permite la recuperación metabólica de las células ciliadas.",
  ], "ocre"),
  espacio(120),
  P("Junto a ella, un conjunto de medidas con respaldo suficiente para recomendarse sin reservas:"),
  bulletRich([["Auriculares con cancelación activa de ruido. ", { b: 1 }], ["Su principal beneficio no es la calidad de sonido sino la reducción del volumen: en un entorno ruidoso, la razón por la que se sube el volumen es enmascarar el ruido ambiental. Eliminado el ruido, se escucha más bajo de forma espontánea."]]),
  bulletRich([["Auriculares de diadema frente a los de botón. ", { b: 1 }], ["A igualdad de percepción, los intraaurales entregan más presión sonora directamente sobre el tímpano."]]),
  bulletRich([["Tapones de atenuación plana en conciertos y discotecas. ", { b: 1 }], ["Los tapones diseñados para música reducen unos 15–20 dB de forma uniforme en todo el espectro, sin distorsionar el timbre. Permiten disfrutar del concierto reduciendo la dosis en más de un 95 % de energía."]]),
  bulletRich([["Distancia a los altavoces. ", { b: 1 }], ["La intensidad decae con el cuadrado de la distancia. Duplicar la separación respecto al altavoz reduce el nivel en unos 6 dB."]]),
  bulletRich([["Uso del limitador de volumen del dispositivo. ", { b: 1 }], ["Los sistemas operativos actuales incorporan avisos de dosis semanal y limitadores configurables. Activarlos es la intervención de menor coste y mayor adherencia."]]),
  bulletRich([["Audiometría periódica. ", { b: 1 }], ["Recomendable cada uno o dos años en personas con exposición recreativa o laboral intensa, y siempre ante la aparición de acúfenos."]]),
  espacio(140),
  H2("12.2 Señales de alarma: cuándo consultar"),
  caja("Consulte con otorrinolaringología si aparece cualquiera de estos signos", [
    "Zumbido o pitido que persiste más de 24 horas después de una exposición sonora intensa.",
    "Sensación de oído tapado o audición apagada que no se resuelve en el plazo de un día.",
    "Dificultad creciente para seguir conversaciones en ambientes con ruido de fondo, aunque la audición parezca normal en silencio.",
    "Necesidad de subir progresivamente el volumen de dispositivos respecto a lo que era habitual.",
    "Molestia o dolor ante sonidos cotidianos de intensidad normal.",
    "Pérdida auditiva súbita en un oído: esto constituye una urgencia médica y debe atenderse en las primeras horas.",
  ], "coral"),
];

/* ================== PARTE V ================== */
const parte5 = [
  ...PARTE("PARTE V", "Música y salud clínica", "De los efectos sistémicos a la musicoterapia basada en la evidencia"),

  H1("13. Efectos sistémicos de la música"),
  P("Más allá del cerebro, la música produce cambios medibles en varios sistemas del organismo. El mecanismo común es la modulación del eje hipotálamo-hipófiso-suprarrenal y del sistema nervioso autónomo: la música predecible y agradable desplaza el equilibrio hacia el predominio parasimpático, mientras que la música rápida y estimulante lo desplaza hacia el simpático."),
  espacio(140),
  tabla([2400, 3300, 3660], ["Sistema", "Efecto documentado", "Solidez de la evidencia"], [
    ["Neuroendocrino", "Descenso de cortisol salival tras escucha de música relajante, especialmente en contextos de estrés agudo", "Moderada; efecto consistente pero de magnitud variable"],
    ["Cardiovascular", "Modulación de frecuencia cardíaca y presión arterial; aumento de la variabilidad de la frecuencia cardíaca con música lenta", "Moderada; efectos de corta duración"],
    ["Percepción del dolor", "Reducción de la intensidad percibida y del consumo de analgésicos en procedimientos y postoperatorio", "Buena; múltiples ensayos y revisiones sistemáticas convergentes"],
    ["Ansiedad", "Reducción de ansiedad preoperatoria comparable en algunos estudios a la premedicación ansiolítica", "Buena en el contexto perioperatorio"],
    ["Sueño", "Mejora de la latencia y de la calidad subjetiva del sueño con música lenta antes de acostarse", "Moderada; sesgo de expectativa difícil de controlar"],
    ["Sistema motor", "Sincronización de la marcha con un pulso auditivo externo; mejora de cadencia y longitud del paso", "Buena; mecanismo fisiológico bien caracterizado"],
    ["Estado de ánimo", "Reducción de sintomatología depresiva en poblaciones clínicas específicas", "Variable según población; mejor documentada en demencia"],
  ], { size: 18, headSize: 18 }),
  rotulo("Tabla 11. Efectos sistémicos de la escucha musical y solidez de la evidencia disponible."),

  new Paragraph({ children: [new PageBreak()] }),

  H1("14. Musicoterapia: dónde funciona de verdad"),
  P("Conviene distinguir dos cosas que se confunden con frecuencia. Escuchar música es una actividad; la musicoterapia es una intervención estructurada, con objetivos terapéuticos definidos, aplicada por profesionales formados y evaluada mediante desenlaces medibles. La evidencia que sigue se refiere a la segunda."),
  espacio(140),
  tabla([2200, 3600, 3560], ["Condición", "Intervención y desenlace", "Estado de la evidencia"], [
    ["Demencia",
      "Musicoterapia activa y receptiva; desenlaces en síntomas depresivos, alteraciones conductuales y funcionamiento social",
      "Una revisión Cochrane que analizó 30 estudios con 1.720 participantes encontró pruebas de mejoría de los síntomas depresivos. Es la indicación con evidencia más consolidada"],
    ["Ictus",
      "Estimulación auditiva rítmica para rehabilitación de la marcha; desenlaces en velocidad, cadencia y longitud del paso",
      "Buena. Mejora demostrada de la funcionalidad de miembros inferiores y de la capacidad de marcha"],
    ["Enfermedad de Parkinson",
      "Estimulación auditiva rítmica sobre la marcha y los bloqueos motores",
      "Buena para desenlaces motores a corto plazo. El pulso auditivo externo suple parcialmente el déficit de temporización interna de los ganglios basales"],
    ["Dolor agudo y postoperatorio",
      "Escucha musical durante y tras el procedimiento; desenlaces en escala de dolor y consumo de opioides",
      "Buena. Efecto pequeño a moderado pero consistente entre estudios"],
    ["Ansiedad perioperatoria",
      "Escucha musical preoperatoria",
      "Buena. Coste nulo y ausencia de efectos adversos la hacen recomendable como coadyuvante"],
    ["Neonatología",
      "Música en vivo o grabada en unidades de cuidados intensivos neonatales; desenlaces en frecuencia cardíaca, saturación y alimentación",
      "Prometedora, con heterogeneidad metodológica considerable"],
    ["Trastornos del espectro autista",
      "Musicoterapia interactiva; desenlaces en comunicación social",
      "Modesta y controvertida; los efectos se atenúan en los estudios con mejor control metodológico"],
  ], { size: 18, headSize: 18 }),
  rotulo("Tabla 12. Musicoterapia por condición clínica y nivel de respaldo empírico."),
  espacio(160),
  caja("Criterio profesional", [
    "La musicoterapia es un coadyuvante con perfil de seguridad excelente y coste bajo, no un sustituto de tratamientos con eficacia establecida. Su valor es máximo precisamente donde la farmacología es más problemática: síntomas conductuales de la demencia, dolor con riesgo de sobre-medicación opioide, ansiedad situacional. Presentarla como alternativa a un tratamiento indicado sería un error clínico y ético.",
  ], "coral"),
  espacio(160),

  H1("15. Riesgos y matices que no conviene omitir"),
  bulletRich([["La música no siempre regula: a veces amplifica. ", { b: 1 }], ["En personas con sintomatología depresiva, la escucha repetida de música triste puede consolidar la rumia en lugar de proporcionar alivio. El efecto depende del uso: la escucha con función de reflexión y elaboración es adaptativa; la escucha con función de evasión y rumia no lo es."]]),
  bulletRich([["El volumen anula el beneficio. ", { b: 1 }], ["Una intervención que reduce el estrés a costa de dañar la cóclea no es una intervención saludable. Cualquier recomendación sobre música y bienestar es incompleta si no incorpora el límite de dosis."]]),
  bulletRich([["Atención al enmascaramiento en contextos de riesgo. ", { b: 1 }], ["Auriculares en la vía pública, en bicicleta o conduciendo eliminan señales acústicas de seguridad. El coste no es auditivo sino traumatológico."]]),
  bulletRich([["El efecto depende de la persona. ", { b: 1 }], ["Preferencia, familiaridad, biografía y contexto cultural modulan la respuesta más que el género en abstracto. Una playlist prescrita sin considerar la preferencia del paciente tiene una eficacia sustancialmente menor."]]),
];

/* ================== PARTE VI ================== */
const parte6 = [
  ...PARTE("PARTE VI", "Aplicación pedagógica", "Síntesis visual, desmontaje de mitos y secuencia didáctica"),

  // Capitulo 16: una sola pagina autocontenida, apta para proyectar o fotocopiar.
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 160 },
    keepNext: true,
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: AZUL, space: 6 } },
    children: [new TextRun({ text: "16. Música, cerebro y salud en una página",
      font: FUENTE_TIT, size: 30, bold: true, color: AZUL })],
  }),
  caja("① LA MÚSICA ENTRA POR EL OÍDO Y SALE POR CUATRO REDES", [
    "Oído externo ▸ oído medio ▸ cóclea ▸ vía auditiva ▸ corteza auditiva ▸ y desde ahí, en paralelo:",
    "• Red AUDITIVA — analiza altura, timbre y estructura.",
    "• Red AUDITIVO-MOTORA — extrae el pulso y prepara el movimiento.",
    "• Red de RECOMPENSA — libera dopamina por anticipación y por resolución.",
    "• Red LÍMBICO-MNÉSICA y EJECUTIVA — emoción, recuerdo y foco atencional.",
  ], "azul", INFO),
  espacio(50),
  caja("② QUÉ ENCONTRÓ EL ESTUDIO DEL TITULAR", [
    "28 personas sin formación musical · fMRI · escucha pasiva · fragmentos SIN letra · cuatro géneros.",
    "El reguetón produjo la mayor activación de la RED AUDITIVO-MOTORA, con implicación de áreas motoras y ganglios basales, especialmente frente a la música clásica.",
    "Martín-Fernández et al. (2021), Neuroscience 457:88–102.",
  ], "teal", INFO),
  espacio(50),
  caja("③ POR QUÉ: EL PUNTO DULCE DEL RITMO", [
    "Poca síncopa → aburrido. Mucha síncopa → caótico. Síncopa MODERADA → máximo placer y máximas ganas de moverse (curva en U invertida, Witek et al., 2014).",
    "El patrón dembow del reguetón (agrupación 3+3+2, repetida y con pulso grave estable) cae casi exactamente en ese óptimo.",
  ], "azul", INFO),
  espacio(50),
  caja("④ PLACER ≠ CONCENTRACIÓN", [
    "PLACER: dopamina en caudado (anticipar) y accumbens (resolver). Funciona con música que a uno le gusta, de cualquier género (Salimpoor et al., 2011).",
    "CONCENTRACIÓN: los rasgos que hacen bailable una canción son los que estorban al estudiar. Con letra, se compite por el bucle fonológico. El efecto Mozart no sobrevivió al metaanálisis (Pietschnig et al., 2010).",
  ], "ocre", INFO),
  espacio(50),
  caja("⑤ EL LÍMITE BIOLÓGICO: 15.000 CÉLULAS QUE NO VUELVEN", [
    "85 dB → 8 h · 91 dB → 2 h · 100 dB (discoteca, auriculares al máximo) → 15 min.",
    "Regla 60/60: máximo 60 % de volumen, máximo 60 minutos seguidos. Tapones en conciertos. Cancelación de ruido para bajar el volumen. Zumbido de más de 24 h → consulta.",
    "Más de 1.000 millones de jóvenes de 12 a 35 años en riesgo (OMS).",
  ], "coral", INFO),
  espacio(50),
  caja("⑥ LA CONCLUSIÓN HONESTA", [
    "Ningún género es «mejor para el cerebro». Cada uno es mejor PARA UN OBJETIVO DISTINTO: reguetón y afines para mover el cuerpo; silencio o instrumental sin letra para estudiar; tempo lento y predecible para bajar la ansiedad; pulso metronómico estable para rehabilitar la marcha.",
  ], "gris", INFO),

  new Paragraph({ children: [new PageBreak()] }),

  H1("17. Mitos y realidades"),
  tabla([3100, 3100, 3160], ["Se dice que…", "La evidencia dice", "Matiz importante"], [
    ["La música clásica hace más inteligentes a los niños",
      "No. El metaanálisis de Pietschnig et al. (2010) no encontró efecto significativo ni duradero",
      "Aprender a tocar un instrumento sí produce cambios estructurales cerebrales; escucharlo pasivamente, no"],
    ["El reguetón es «mejor para el cerebro» que la música clásica",
      "El estudio muestra mayor activación auditivo-motora, no superioridad cognitiva ni beneficio para la salud",
      "Activación no equivale a calidad, complejidad ni beneficio"],
    ["Usamos solo una parte del cerebro y la música activa el resto",
      "Falso de raíz: el cerebro está activo en su totalidad de forma continua",
      "Lo que varía entre estímulos es el patrón relativo de activación, no la proporción de cerebro «encendido»"],
    ["Escuchar música siempre ayuda a estudiar",
      "Depende de la tarea. En trabajo verbal, la música con letra reduce el rendimiento de forma sistemática",
      "En tareas monótonas puede ayudar, por sostener el nivel de alerta"],
    ["Si no me duele el oído, no hay daño",
      "El daño coclear es indoloro y acumulativo. El dolor aparece muy por encima del umbral de lesión",
      "El primer aviso suele ser el acúfeno, no el dolor"],
    ["Los auriculares de botón son más seguros porque son pequeños",
      "Al contrario: entregan mayor presión sonora directamente sobre el tímpano",
      "Los de diadema con cancelación de ruido permiten escuchar más bajo"],
    ["La musicoterapia cura enfermedades",
      "Es un coadyuvante eficaz en indicaciones concretas, no un tratamiento curativo",
      "Su mejor evidencia está en demencia, rehabilitación de la marcha y dolor"],
    ["El efecto de la música es igual para todos",
      "La preferencia personal y la familiaridad cultural modulan fuertemente la respuesta neural",
      "Es la razón por la que las prescripciones musicales genéricas funcionan peor que las personalizadas"],
  ], { size: 18, headSize: 18 }),
  rotulo("Tabla 13. Mitos frecuentes y su contraste con la evidencia."),

  new Paragraph({ children: [new PageBreak()] }),

  H1("18. Secuencia didáctica de tres sesiones"),
  P("Propuesta de aplicación en aula, adaptable a educación secundaria superior, pregrado en ciencias de la salud o formación continua. Cada sesión está diseñada para 90 minutos."),
  espacio(140),
  tabla([1300, 2500, 2900, 2660], ["Sesión", "Título y objetivo", "Desarrollo", "Producto evaluable"], [
    ["1",
      "«¿Por qué se te mueve el pie?» — Comprender la red auditivo-motora",
      "Escucha comparada a ciegas de cuatro fragmentos instrumentales (clásico, folclore, electrónico, reguetón). Registro individual de ganas de moverse en escala de 0 a 10. Puesta en común, construcción de la curva en U invertida con los datos del grupo y explicación del diagrama 1",
      "Gráfico de grupo con la relación entre complejidad rítmica percibida y ganas de moverse, con interpretación escrita de media página"],
    ["2",
      "«El titular y el estudio» — Alfabetización en lectura científica",
      "Lectura del titular periodístico frente a la ficha del estudio (tabla 3). Identificación por parejas de las cuatro sobre-lecturas del capítulo 2.5. Debate estructurado sobre la diferencia entre activación y beneficio",
      "Reescritura del titular en una versión rigurosa de un máximo de 25 palabras, con justificación"],
    ["3",
      "«El precio del volumen» — Salud auditiva aplicada",
      "Medición del nivel sonoro del aula y de los auriculares personales con una aplicación de sonómetro. Cálculo de la dosis diaria individual con la tabla 10. Diseño de una campaña breve de sensibilización",
      "Cartel o pieza digital de una sola página con el mensaje de escucha segura dirigido a población adolescente"],
  ], { size: 18, headSize: 18 }),
  rotulo("Tabla 14. Secuencia didáctica de tres sesiones."),
  espacio(160),

  H2("18.1 Rúbrica de evaluación"),
  tabla([2400, 2320, 2320, 2320], ["Criterio", "Nivel logrado", "Nivel en proceso", "Nivel inicial"], [
    ["Precisión conceptual", "Distingue con corrección las cuatro redes y ubica el hallazgo del estudio en la red correcta", "Nombra las redes pero confunde funciones o estructuras", "Emplea «el cerebro» como entidad indiferenciada"],
    ["Lectura crítica de la fuente", "Identifica las limitaciones del estudio y evita la inferencia de valor a partir de la activación", "Detecta alguna limitación pero mantiene conclusiones evaluativas", "Reproduce el titular sin cuestionarlo"],
    ["Aplicación práctica", "Justifica sus recomendaciones sonoras según el tipo de tarea y calcula correctamente la dosis auditiva", "Aplica recomendaciones generales sin ajustarlas a la tarea", "No relaciona la evidencia con decisiones concretas"],
    ["Comunicación", "Producto claro, riguroso y adaptado a la audiencia destinataria", "Producto correcto pero con imprecisiones o exceso de tecnicismo", "Producto confuso o con errores conceptuales"],
  ], { size: 17, headSize: 17 }),
  rotulo("Tabla 15. Rúbrica de evaluación de la secuencia didáctica."),

  new Paragraph({ children: [new PageBreak()] }),

  H1("19. Banco de preguntas de comprobación"),
  P("Diez preguntas para verificar la comprensión. Las respuestas están en los capítulos indicados entre paréntesis."),
  paso("Explique por qué el diseño del estudio de Martín-Fernández et al. (2021) eliminó las letras de los fragmentos musicales y qué habría ocurrido de no hacerlo. (Cap. 2.3)", 0, "preguntas"),
  paso("Nombre las cuatro redes de la escucha musical e indique en cuál de ellas se sitúa el hallazgo principal del estudio. (Caps. 4 y 2.4)", 0, "preguntas"),
  paso("¿Por qué «activar más regiones cerebrales» no equivale a «ser mejor música»? Formule dos argumentos independientes. (Cap. 2.5)", 0, "preguntas"),
  paso("Describa la disociación funcional entre núcleo caudado y núcleo accumbens hallada por Salimpoor et al. (2011) y qué implica sobre la naturaleza del placer musical. (Cap. 5)", 0, "preguntas"),
  paso("Dibuje la curva en U invertida de la síncopa y explique qué ocurre en cada uno de sus tres tramos. (Cap. 6.1)", 0, "preguntas"),
  paso("¿Qué tres propiedades del patrón dembow lo sitúan en el punto dulce del groove? (Cap. 6.2)", 0, "preguntas"),
  paso("Un estudiante afirma que escucha reguetón mientras redacta un ensayo porque «le activa más el cerebro». Responda con dos argumentos basados en la evidencia. (Caps. 2.5 y 9.1)", 0, "preguntas"),
  paso("¿Por qué el efecto Mozart no sostiene la idea de que la música clásica nos vuelve más inteligentes? (Cap. 8)", 0, "preguntas"),
  paso("Una persona escucha música a 100 dB con auriculares. ¿Cuánto tiempo diario puede hacerlo antes de entrar en zona de riesgo, y por qué la escala de decibelios explica esa cifra? (Cap. 11)", 0, "preguntas"),
  paso("Enumere tres condiciones clínicas con evidencia razonable a favor de la musicoterapia y precise el desenlace concreto que mejora en cada una. (Cap. 14)", 0, "preguntas"),
];

/* ================== CIERRE ================== */
const cierre = [
  new Paragraph({ children: [new PageBreak()] }),
  H1("20. Glosario"),
  tabla([2600, 6760], ["Término", "Definición operativa"], [
    ["Acúfeno (tinnitus)", "Percepción de un sonido en ausencia de fuente externa. Suele ser la primera manifestación clínica del daño coclear."],
    ["Área motora suplementaria", "Región de la corteza frontal medial implicada en la planificación y secuenciación del movimiento; se activa incluso cuando se escucha ritmo sin moverse."],
    ["Arousal", "Nivel general de activación fisiológica y alerta del organismo. Explica buena parte de los efectos atribuidos erróneamente a músicas concretas."],
    ["Bucle fonológico", "Componente de la memoria de trabajo que mantiene temporalmente información verbal y acústica. Recurso limitado por el que compiten la letra de una canción y el texto que se está leyendo."],
    ["Células ciliadas", "Células sensoriales del órgano de Corti que transducen la vibración mecánica en señal eléctrica. Aproximadamente 15.000 por oído; no se regeneran en el ser humano."],
    ["Dembow", "Patrón rítmico característico del reguetón, basado en una agrupación 3+3+2 dentro del compás, con pulso grave estable y repetición sostenida."],
    ["fMRI (resonancia magnética funcional)", "Técnica de neuroimagen que estima la actividad neural de forma indirecta, midiendo cambios en la oxigenación sanguínea (señal BOLD)."],
    ["Ganglios basales", "Conjunto de núcleos subcorticales —incluido el putamen— implicados en la modulación del movimiento, la temporización y el procesamiento de la recompensa."],
    ["Groove", "Cualidad de una música que induce el deseo de moverse acompañado de placer. Alcanza su máximo con grados intermedios de síncopa."],
    ["Núcleo accumbens", "Estructura del estriado ventral central en el circuito de recompensa; se implica en la fase de consumación del placer musical."],
    ["Núcleo caudado", "Estructura del estriado dorsal; se implica en la fase de anticipación del clímax musical."],
    ["Señal BOLD", "Blood Oxygen Level Dependent. Correlato hemodinámico de la actividad neural que mide la fMRI. No mide disparo neuronal directamente."],
    ["Sinaptopatía coclear", "Pérdida de sinapsis entre células ciliadas internas y fibras nerviosas sin elevación del umbral tonal. Base de la llamada pérdida auditiva oculta."],
    ["Síncopa", "Desplazamiento de un acento rítmico respecto a la posición métrica esperada. Su grado determina la intensidad de la sensación de groove."],
    ["Tonotopía", "Organización espacial de las estructuras auditivas según la frecuencia del sonido, presente desde la membrana basilar hasta la corteza auditiva."],
  ], { size: 19 }),
  rotulo("Tabla 16. Glosario de términos empleados en el documento."),

  new Paragraph({ children: [new PageBreak()] }),
  H1("21. Referencias"),
  H2("Fuente detonante"),
  P("Xataka. Los neurocientíficos coinciden: «El reguetón es la música que más partes del cerebro activa, por encima de la clásica». Sección Investigación. Disponible en: www.xataka.com/investigacion/neurocientificos-coinciden-regueton-musica-que-partes-cerebro-activa-encima-clasica", { size: 21 }),
  H2("Fuente científica principal"),
  P("Martín-Fernández, J., Burunat, I., Modroño, C., González-Mora, J. L. y Plata-Bello, J. (2021). Music Style Not Only Modulates the Auditory Cortex, but Also Motor Related Areas. Neuroscience, 457, 88–102. DOI: 10.1016/j.neuroscience.2021.01.012", { size: 21 }),
  H2("Fuentes complementarias citadas"),
  P("Salimpoor, V. N., Benovoy, M., Larcher, K., Dagher, A. y Zatorre, R. J. (2011). Anatomically distinct dopamine release during anticipation and experience of peak emotion to music. Nature Neuroscience, 14(2), 257–262.", { size: 21 }),
  P("Witek, M. A. G., Clarke, E. F., Wallentin, M., Kringelbach, M. L. y Vuust, P. (2014). Syncopation, body-movement and pleasure in groove music. PLOS ONE, 9(4), e94446.", { size: 21 }),
  P("Vuust, P., Witek, M. A. G. y cols. The sweet spot between predictability and surprise: musical groove in brain, body, and social interactions. Revisión sobre procesamiento predictivo y groove.", { size: 21 }),
  P("Pietschnig, J., Voracek, M. y Formann, A. K. (2010). Metaanálisis del efecto Mozart. Facultad de Psicología, Universidad de Viena.", { size: 21 }),
  P("Rauscher, F. H., Shaw, G. L. y Ky, K. N. (1993). Music and spatial task performance. Nature, 365, 611. [Estudio original del efecto Mozart].", { size: 21 }),
  P("Organización Mundial de la Salud (2022). Norma mundial para la escucha sin riesgos en locales y eventos musicales. Ginebra: OMS.", { size: 21 }),
  P("Organización Mundial de la Salud. Informes sobre pérdida auditiva por exposición recreativa en población de 12 a 35 años.", { size: 21 }),
  P("Colaboración Cochrane. Revisiones sistemáticas sobre musicoterapia en demencia (30 estudios, 1.720 participantes) y sobre intervenciones musicales para el dolor y la ansiedad perioperatoria.", { size: 21 }),
  P("Cobertura periodística complementaria del mismo estudio: El Tiempo (Colombia), La Nación (Argentina) y Que.es (España), consultadas en agosto de 2026.", { size: 21 }),
  espacio(200),

  H1("Anexo. Nota de transparencia metodológica"),
  P("Este documento se elaboró a partir del enlace proporcionado como punto de partida. El acceso directo a la página de Xataka resultó bloqueado por la política de red del entorno de trabajo, de modo que su contenido no pudo leerse de primera mano."),
  P("En lugar de reproducir un resumen indirecto, se optó por localizar y trabajar sobre la fuente científica primaria que el artículo divulga —el estudio publicado en la revista Neuroscience en 2021— cuya autoría, referencia bibliográfica, metodología y resultados principales fueron verificados de forma independiente a través de repositorios académicos e institucionales. La cobertura del mismo estudio en otros medios se utilizó únicamente para contrastar cómo se formuló públicamente el hallazgo."),
  P("Los datos numéricos sobre exposición sonora, límites normativos y evidencia clínica proceden de las fuentes citadas en el capítulo 21 y no del artículo detonante. Cuando la evidencia disponible es limitada o heterogénea, el documento lo indica explícitamente en lugar de presentar una conclusión firme."),
  espacio(200),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400 },
    border: { top: { style: BorderStyle.SINGLE, size: 12, color: AZUL, space: 12 } },
    children: [new TextRun({ text: "Fin del documento maestro",
      font: FUENTE_TIT, size: 24, bold: true, color: AZUL })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 100 },
    children: [new TextRun({ text: "Los efectos de la música en la salud · Versión 1.0 · " + hoy,
      font: FUENTE, size: 19, italics: true, color: GRIS })] }),
];

/* ------------------------------------------------------------------ *
 *  DOCUMENTO
 * ------------------------------------------------------------------ */
const doc = new Document({
  creator: "Documento maestro — Música, cerebro y salud",
  title: "Los efectos de la música en la salud",
  description: "Cerebro, audición y placer: qué género musical activa más el sistema nervioso y por qué",
  styles: {
    default: {
      document: { run: { font: FUENTE, size: 22, color: NEGRO } },
    },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: FUENTE_TIT, size: 32, bold: true, color: AZUL },
        paragraph: { spacing: { before: 380, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: FUENTE_TIT, size: 26, bold: true, color: TEAL },
        paragraph: { spacing: { before: 300, after: 140 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: FUENTE, size: 23, bold: true, color: GRIS },
        paragraph: { spacing: { before: 220, after: 110 }, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      { reference: "vinetas", levels: [
        { level: 0, format: LevelFormat.BULLET, text: "▪", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 400, hanging: 220 } },
                   run: { color: CORAL, size: 22 } } },
        { level: 1, format: LevelFormat.BULLET, text: "–", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 760, hanging: 220 } },
                   run: { color: TEAL, size: 22 } } },
      ]},
      { reference: "pasos", levels: [
        { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 440, hanging: 260 } },
                   run: { bold: true, color: AZUL } } },
      ]},
      { reference: "preguntas", levels: [
        { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 440, hanging: 260 } },
                   run: { bold: true, color: CORAL } } },
      ]},
    ],
  },
  sections: [
    /* --- Sección 1: portada, sin encabezado ni numeración --- */
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
        titlePage: false,
      },
      children: portada,
    },
    /* --- Sección 2: cuerpo, con encabezado y pie numerado --- */
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
        },
      },
      headers: {
        default: new Header({ children: [new Paragraph({
          spacing: { after: 0 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "B8C4D0", space: 6 } },
          tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
          children: [
            new TextRun({ text: "Los efectos de la música en la salud", font: FUENTE, size: 17, color: AZUL, bold: true }),
            new TextRun({ text: "\tDocumento maestro · Versión 1.0", font: FUENTE, size: 17, color: GRIS }),
          ],
        })] }),
      },
      footers: {
        default: new Footer({ children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 60 },
          border: { top: { style: BorderStyle.SINGLE, size: 6, color: "B8C4D0", space: 6 } },
          children: [
            new TextRun({ text: "Página ", font: FUENTE, size: 17, color: GRIS }),
            new TextRun({ children: [PageNumber.CURRENT], font: FUENTE, size: 17, color: AZUL, bold: true }),
            new TextRun({ text: " de ", font: FUENTE, size: 17, color: GRIS }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FUENTE, size: 17, color: GRIS }),
          ],
        })] }),
      },
      children: [
        ...ficha, ...indice, ...guia,
        ...parte1, ...parte2, ...parte3, ...parte4, ...parte5, ...parte6,
        ...cierre,
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  const out = process.argv[2] || "Documento_Maestro_Musica_Salud.docx";
  fs.writeFileSync(out, buf);
  console.log("OK ->", out, (buf.length / 1024).toFixed(1) + " KB");
});
