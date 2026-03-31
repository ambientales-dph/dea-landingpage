import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UploadCloud, Mouse, GanttChartSquare, Search, ListChecks, ShieldCheck, Tag, Info } from "lucide-react";

export function WelcomeScreen() {
    return (
        <div className="flex flex-col items-center justify-center h-full p-4 md:p-8 overflow-y-auto bg-zinc-100/50">
            <div className="text-center mb-12 shrink-0 animate-in fade-in slide-in-from-top-4 duration-700">
                <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                    <GanttChartSquare className="h-10 w-10 text-primary" />
                </div>
                <h1 className="text-4xl font-bold font-headline text-black tracking-tight">Línea de Tiempo DEA</h1>
                <p className="text-zinc-600 max-w-2xl mx-auto mt-3 text-sm leading-relaxed">
                    Historial cronológico y repositorio documental técnico para la gestión de proyectos del Departamento de Estudios Ambientales.
                </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-6xl animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-200">
                <Card className="border-primary/20 bg-white shadow-md hover:shadow-xl transition-all duration-300 group">
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-3 font-headline text-lg text-primary">
                            <UploadCloud className="h-5 w-5 group-hover:scale-110 transition-transform" />
                            Registro de Eventos
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-zinc-600 leading-relaxed">
                        <p>
                            Documentá hitos relevantes, visitas de obra o reuniones técnicas. Cada evento registrado guarda un historial inalterable de quién y cuándo realizó la carga.
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-primary/20 bg-white shadow-md hover:shadow-xl transition-all duration-300 group">
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-3 font-headline text-lg text-primary">
                            <ShieldCheck className="h-5 w-5 group-hover:scale-110 transition-transform" />
                            Gestión Documental
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-zinc-600 leading-relaxed">
                        <p>
                            Clasificá tus archivos como <strong>Finales</strong> (documentación entregable e intocable) o de <strong>Trabajo</strong> (archivos técnicos en edición alojados en el servidor principal).
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-primary/20 bg-white shadow-md hover:shadow-xl transition-all duration-300 group">
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-3 font-headline text-lg text-primary">
                            <Mouse className="h-5 w-5 group-hover:scale-110 transition-transform" />
                            Navegación Temporal
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-zinc-600 leading-relaxed">
                        <ul className="space-y-1.5">
                            <li className="flex items-center gap-2"><div className="h-1 w-1 rounded-full bg-primary" /> <strong>Zoom:</strong> Usá la rueda del ratón para ampliar periodos específicos.</li>
                            <li className="flex items-center gap-2"><div className="h-1 w-1 rounded-full bg-primary" /> <strong>Desplazamiento:</strong> Clic derecho y arrastrar para navegar la historia.</li>
                        </ul>
                    </CardContent>
                </Card>

                <Card className="border-primary/20 bg-white shadow-md hover:shadow-xl transition-all duration-300 group">
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-3 font-headline text-lg text-primary">
                            <Tag className="h-5 w-5 group-hover:scale-110 transition-transform" />
                            Auditoría Técnica
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-zinc-600 leading-relaxed">
                        <p>
                            Utilizá categorías y etiquetas para clasificar hallazgos, inspecciones o informes de impacto (EIA). Permite un seguimiento granular de la evolución del proyecto.
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-primary/20 bg-white shadow-md hover:shadow-xl transition-all duration-300 group">
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-3 font-headline text-lg text-primary">
                           <Search className="h-5 w-5 group-hover:scale-110 transition-transform" />
                           Búsqueda Inteligente
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-zinc-600 leading-relaxed">
                        <p>
                            Localizá archivos o hitos específicos mediante filtros por nombre, descripción o palabras clave. El sistema indexa todo el contenido para una respuesta inmediata.
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-primary/20 bg-white shadow-md hover:shadow-xl transition-all duration-300 group">
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-3 font-headline text-lg text-primary">
                            <ListChecks className="h-5 w-5 group-hover:scale-110 transition-transform" />
                            Reportes Consolidados
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-zinc-600 leading-relaxed">
                       <p>
                            Accedé a la <strong>vista de tabla</strong> para generar resúmenes ejecutivos imprimibles. Ideal para adjuntar a expedientes o compartir informes de avance rápidos.
                       </p>
                    </CardContent>
                </Card>
            </div>

            <div className="mt-12 p-4 bg-zinc-200/50 rounded-lg flex items-center gap-3 text-zinc-500 border border-zinc-300">
                <Info className="h-4 w-4" />
                <p className="text-[10px] uppercase font-bold tracking-widest">
                    Seleccioná un proyecto en el panel izquierdo para comenzar la navegación técnica.
                </p>
            </div>
        </div>
    );
}
