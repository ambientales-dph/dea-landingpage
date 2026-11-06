export interface Recurso {
  title: string;
  url: string;
  category: string;
}

export const RECURSOS: Recurso[] = [
  { category: 'A', title: 'ACUMAR RESOL-2019-283-APN-ACUMAR#MI', url: 'https://www.argentina.gob.ar/normativa/nacional/resoluci%C3%B3n-283-2019-334281/texto' },
  { category: 'A', title: 'ATLAS CONURBANO', url: 'http://atlasconurbano.info/index.php' },
  { category: 'C', title: 'Código Alimentario Argentino - Agua', url: 'https://alimentosargentinos.magyp.gob.ar/contenido/marco/CAA/Capitulo_12.php' },
  { category: 'C', title: 'CREPAP', url: 'https://sites.google.com/view/crepap/p%C3%A1gina-principal' },
  { category: 'D', title: 'DATOS ABIERTOS PBA', url: 'https://catalogo.datos.gba.gob.ar/' },
  { category: 'G', title: 'GEOINFRA', url: 'https://www.geoinfra.minfra.gba.gov.ar/' },
  { category: 'I', title: 'IDEBA', url: 'https://ideba.gba.gob.ar/visualizadores' },
  { category: 'I', title: 'INAI', url: 'https://www.argentina.gob.ar/derechoshumanos/inai/mapa' },
  { category: 'I', title: 'INDEC', url: 'https://www.indec.gob.ar/' },
  { category: 'M', title: 'MAPA ESCOLAR', url: 'https://mapaescolar.abc.gob.ar/mapaescolar' },
  { category: 'O', title: 'OBSERVATORIO CONURBANO', url: 'http://normas.ungs.edu.ar/' },
  { category: 'O', title: 'ONSERVATORIO METROPOLITANO', url: 'https://observatorioamba.org/' },
  { category: 'O', title: 'OPISU', url: 'https://www.gba.gob.ar/opisu' },
  { category: 'R', title: 'RENABAP', url: 'https://www.argentina.gob.ar/desarrollosocial/renabap' },
  { category: 'R', title: 'Residuos Peligrosos - Ley 24.051', url: 'https://www.ecofield.net/Legales/Residuos_pel/ley24051-dec831-93/dec831-93_anexo%20II%20Tablas.htm' },
  { category: 'S', title: 'SIEMPRO', url: 'https://www.argentina.gob.ar/politicassociales/siempro' },
  { category: 'S', title: 'SIMARCC', url: 'https://simarcc.ambiente.gob.ar/' },
  { category: 'S', title: 'Sistema Nacional de Información Hídrica', url: 'https://snih.hidricosargentina.gob.ar/' },
  { category: 'T', title: 'TECHO', url: 'http://relevamiento.techo.org.ar/?latlng=-37.134045371264456,-59.85351562500001&z=6&l=mapa&f=2&y=r2016&chart=0&table=0&details=0&detailsTab=0&nid=' },
  { category: 'U', title: 'URBASIG', url: 'https://urbasig.gob.gba.gob.ar/urbasig/' },
];

export interface RecursoPropio {
  id: string;
  order: number;
  section: 'guias' | 'plantillas';
  title: string;
  url: string;
  isFolder?: boolean;
  fileName?: string;
  format?: 'docx' | 'xlsx' | 'pdf' | 'folder';
  fileSizeText?: string;
  createdAtText?: string;
  uploadedBy?: string;
  description?: string;
  storagePath?: string;
}

export const RECURSOS_PROPIOS: RecursoPropio[] = [
  // Subsección 1: Documentación Institucional y Guías
  {
    id: 'sistema-visual-dea',
    order: 1,
    section: 'guias',
    title: 'Sistema Visual DEA',
    url: 'https://drive.google.com/drive/folders/1CUQGZpF9nvF-mEX6bi2U8iNFyqJfdD7Y?usp=sharing',
    isFolder: true,
    format: 'folder',
    uploadedBy: 'DEA',
    description: 'Carpeta en Google Drive con logos oficiales, manual de identidad visual, tipografías y recursos gráficos institucionales de la DEA.',
  },
  {
    id: 'anexo-i-digesto-normativo',
    order: 2,
    section: 'guias',
    title: 'Anexo I - Digesto Normativo Ambiental',
    url: 'https://docs.google.com/document/d/1c0ZRopXMBVlne2FIcPUX6mzGNpWEbea3/export?format=docx',
    fileName: 'Anexo I - Digesto Normativo Ambiental.docx',
    format: 'docx',
    uploadedBy: 'DEA',
    description: 'Compendio y digesto de normativas ambientales vigentes aplicables a los proyectos y obras de la DEA.',
  },
  {
    id: 'atlas-cuencas-etapa-i',
    order: 3,
    section: 'guias',
    title: 'Atlas de Cuencas y Regiones Hídricas - Etapa I',
    url: 'https://drive.google.com/uc?export=download&id=1DBZwunjGFTZ0M_E9PGyOT4doeo2g8uxy',
    fileName: 'Atlas de Cuencas y Regiones Hídricas - Etapa I.pdf',
    format: 'pdf',
    uploadedBy: 'DEA',
    description: 'Atlas cartográfico y delimitación técnica de cuencas y regiones hídricas de la Provincia de Buenos Aires (Etapa I).',
  },

  // Subsección 2: Plantillas y Modelos de Gestión
  {
    id: 'plan-gestion-ambiental-pga',
    order: 4,
    section: 'plantillas',
    title: 'Plan de Gestión Ambiental (PGA Modelo)',
    url: 'https://docs.google.com/document/d/1awzF11qKyQKgkGVcDcFCGp_z4Iw9VgwP/export?format=docx',
    fileName: 'Plan de Gestión Ambiental.docx',
    format: 'docx',
    uploadedBy: 'DEA',
    description: 'Documento modelo del Plan de Gestión Ambiental (PGA) y marco jurídico ambiental para obras DEA.',
  },
  {
    id: 'matriz-impactos-via',
    order: 5,
    section: 'plantillas',
    title: 'Matriz de Impactos y Cálculo de VIA (Modelo)',
    url: 'https://docs.google.com/spreadsheets/d/1EDbhZZH_W71usWJvC7xZ915DVupcxHeL/export?format=xlsx',
    fileName: 'Matriz de Impactos y Cálculo de VIA.xlsx',
    format: 'xlsx',
    uploadedBy: 'DEA',
    description: 'Planilla de cálculo oficial para matrices de impactos ambientales y cálculo de Valor de Impacto Ambiental (VIA).',
  },
  {
    id: 'informe-mensual-pgas',
    order: 6,
    section: 'plantillas',
    title: 'Informe Mensual PGAS (Modelo)',
    url: 'https://storage.googleapis.com/studio-1428739321-e57bb.firebasestorage.app/reference_docs/1793916460859_Informe_Mensual_de_Ejecuci_n_del_PGAS_a_ser_presentado_por_Contratista.docx',
    fileName: 'Informe Mensual de Ejecución del PGAS a ser presentado por Contratista.docx',
    format: 'docx',
    fileSizeText: '23 KB',
    createdAtText: '11/02/2022, 10:39 a. m.',
    uploadedBy: 'DEA',
    description: 'Modelo de Informe Mensual de Ejecución del PGAS a ser presentado por el Contratista de obra.',
  },
  {
    id: 'informe-vista-modelo',
    order: 7,
    section: 'plantillas',
    title: 'Informe Vista (Modelo)',
    url: 'https://storage.googleapis.com/studio-1428739321-e57bb.firebasestorage.app/reference_docs/1793916450925_informe_vista_MODELO.docx',
    fileName: 'informe vista MODELO.docx',
    format: 'docx',
    fileSizeText: '136 KB',
    createdAtText: '11/02/2022, 10:39 a. m.',
    uploadedBy: 'DEA',
    description: 'Documento plantilla modelo para informe de vista técnica ambiental de obras.',
  },
  {
    id: 'acta-reunion-modelo',
    order: 8,
    section: 'plantillas',
    title: 'Acta de Reunión (Modelo)',
    url: 'https://storage.googleapis.com/studio-1428739321-e57bb.firebasestorage.app/reference_docs/1793916476530_Acta_de_reuni_n.docx',
    fileName: 'Acta de reunión.docx',
    format: 'docx',
    fileSizeText: '86 KB',
    createdAtText: '11/02/2022, 10:38 a. m.',
    uploadedBy: 'DEA',
    description: 'Plantilla modelo para la confección de actas de reunión de seguimiento y coordinación.',
  },
  {
    id: 'solicitud-reunion-modelo',
    order: 9,
    section: 'plantillas',
    title: 'Solicitud de Reunión (Modelo)',
    url: 'https://storage.googleapis.com/studio-1428739321-e57bb.firebasestorage.app/reference_docs/1793916471412_Solicitud_de_reuni_n.docx',
    fileName: 'Solicitud de reunión.docx',
    format: 'docx',
    fileSizeText: '88 KB',
    createdAtText: '11/02/2022, 10:38 a. m.',
    uploadedBy: 'DEA',
    description: 'Plantilla modelo formal para solicitud de reunión técnica o institucional.',
  },
];
