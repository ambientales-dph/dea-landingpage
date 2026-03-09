
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trello, UploadCloud, Mouse, GanttChartSquare, Settings, Search, ListChecks, Database } from "lucide-react";

export function WelcomeScreen() {
    return (
        <div className="flex flex-col items-center justify-center h-full p-4 md:p-8 overflow-y-auto">
            <div className="text-center mb-8 shrink-0">
                <GanttChartSquare className="h-16 w-16 mx-auto text-muted-foreground/50" />
                <h1 className="text-3xl font-bold font-headline mt-4">Línea de Tiempo DEA</h1>
                <p className="text-foreground/80 max-w-2xl mx-auto mt-2">
                    Historial consolidado de proyectos del Departamento de Estudios Ambientales.
                </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-6xl">
                <Card className="border-primary/20 bg-primary/5">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 font-headline text-lg text-primary">
                            <Database className="h-5 w-5" />
                            Datos Migrados
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                        <p>
                            Si ya ejecutaste la migración, seleccioná un proyecto en el panel lateral. Los hitos históricos aparecerán automáticamente vinculados a sus tarjetas de Trello.
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 font-headline text-lg">
                            <Trello className="h-5 w-5 text-primary" />
                            Sincronización Trello
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                        <p>
                            Al seleccionar una tarjeta, el sistema importa automáticamente comentarios, archivos adjuntos y movimientos de lista como hitos del proyecto.
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 font-headline text-lg">
                            <UploadCloud className="h-5 w-5 text-primary" />
                            Hitos Manuales
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                        <p>
                            Usá el botón <strong>"+"</strong> para añadir eventos, fotos o documentos directamente a la línea de tiempo. Se guardarán en Google Drive y se verán en Trello.
                        </p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 font-headline text-lg">
                            <Mouse className="h-5 w-5 text-primary" />
                            Navegación
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                        <ul className="list-disc list-inside space-y-1">
                            <li><strong>Zoom:</strong> Rueda del ratón.</li>
                            <li><strong>Mover:</strong> Clic derecho y arrastrar.</li>
                            <li><strong>Detalles:</strong> Un clic sobre cualquier punto.</li>
                        </ul>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 font-headline text-lg">
                           <Search className="h-5 w-5 text-primary" />
                           Búsqueda Global
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                        <p>
                            Buscá por nombre de archivo, descripción o etiquetas. El sistema filtrará los eventos en tiempo real para facilitarte el seguimiento.
                        </p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 font-headline text-lg">
                            <ListChecks className="h-5 w-5 text-primary" />
                            Resumen de Obra
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                       <p>
                            Cambiá a la <strong>vista de tabla</strong> para generar reportes imprimibles o PDFs con el resumen cronológico de todas las intervenciones.
                       </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
