
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
  { category: 'O', title: 'OBSERVATORIO CONURBANO', url: 'http://observatorioconurbano.ungs.edu.ar/' },
  { category: 'O', title: 'ONSERVATORIO METROPOLITANO', url: 'https://observatorioamba.org/' },
  { category: 'O', title: 'OPISU', url: 'https://www.gba.gob.ar/opisu' },
  { category: 'R', title: 'RENABAP', url: 'https://www.argentina.gob.ar/desarrollosocial/renabap' },
  { category: 'R', title: 'Residuos Peligrosos - Ley 24.051', url: 'https://www.ecofield.net/Legales/Residuos_pel/ley24051-dec831-93/dec831-93_anexo%20II%20Tablas.htm' },
  { category: 'S', title: 'SIEMPRO', url: 'https://www.argentina.gob.ar/politicassociales/siempro' },
  { category: 'S', title: 'SIMARCC', url: 'https://simarcc.ambiente.gob.ar/' },
  { category: 'T', title: 'TECHO', url: 'http://relevamiento.techo.org.ar/?latlng=-37.134045371264456,-59.85351562500001&z=6&l=mapa&f=2&y=r2016&chart=0&table=0&details=0&detailsTab=0&nid=' },
  { category: 'U', title: 'URBASIG', url: 'https://urbasig.gob.gba.gob.ar/urbasig/' },
];

export const RECURSOS_PROPIOS: {title: string, url: string}[] = [
  {
    title: 'Sistema Visual DEA',
    url: 'https://drive.google.com/drive/folders/1CUQGZpF9nvF-mEX6bi2U8iNFyqJfdD7Y?usp=sharing',
  },
  {
    title: 'Anexo I - Digesto Normativo Ambiental',
    url: 'https://docs.google.com/document/d/1c0ZRopXMBVlne2FIcPUX6mzGNpWEbea3/export?format=docx',
  },
  {
    title: 'Plan de Gestión Ambiental',
    url: 'https://docs.google.com/document/d/1awzF11qKyQKgkGVcDcFCGp_z4Iw9VgwP/export?format=docx',
  },
  {
    title: 'Matriz de Impactos y Cálculo de VIA',
    url: 'https://docs.google.com/spreadsheets/d/1EDbhZZH_W71usWJvC7xZ915DVupcxHeL/export?format=xlsx',
  },
  {
    title: 'Atlas de Cuencas y Regiones Hídricas - Etapa I',
    url: 'https://drive.google.com/uc?export=download&id=1DBZwunjGFTZ0M_E9PGyOT4doeo2g8uxy',
  },
];
