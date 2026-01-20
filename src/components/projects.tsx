import { projects, type Project } from '@/app/lib/data';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';

function ProjectCard({ project }: { project: Project }) {
  return (
    <Card className="overflow-hidden h-full flex flex-col group transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
      {project.image && (
        <div className="aspect-video overflow-hidden">
            <Image
              src={project.image.imageUrl}
              alt={project.image.description}
              width={600}
              height={400}
              className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105"
              data-ai-hint={project.image.imageHint}
            />
        </div>
      )}
      <CardHeader>
        <h3 className="text-2xl font-bold font-headline">{project.title}</h3>
      </CardHeader>
      <CardContent>
        <p className="text-foreground/80">{project.description}</p>
      </CardContent>
    </Card>
  );
}

export function Projects() {
  return (
    <section id="projects" className="bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-headline text-primary">Featured Projects</h2>
          <p className="text-lg text-foreground/80 mt-4 max-w-2xl mx-auto">
            A selection of my work, showcasing my skills in design and development.
          </p>
        </div>
        <div className="grid md:grid-cols-1 lg:grid-cols-3 gap-8">
          {projects.map((project, index) => (
             <div key={project.id} className={index === 0 ? 'lg:col-span-3' : 'lg:col-span-1'}>
                { index === 0 ? (
                  <Card className="overflow-hidden h-full flex flex-col md:flex-row group transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
                    {project.image && (
                      <div className="md:w-1/2 aspect-video md:aspect-auto overflow-hidden">
                          <Image
                            src={project.image.imageUrl}
                            alt={project.image.description}
                            width={800}
                            height={600}
                            className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105"
                            data-ai-hint={project.image.imageHint}
                          />
                      </div>
                    )}
                    <div className="md:w-1/2 flex flex-col">
                      <CardHeader>
                        <h3 className="text-3xl font-bold font-headline">{project.title}</h3>
                      </CardHeader>
                      <CardContent className="flex-grow">
                        <p className="text-foreground/80 text-lg">{project.description}</p>
                      </CardContent>
                    </div>
                  </Card>
                ) : (
                  <ProjectCard project={project} />
                )
              }
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
