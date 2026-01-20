import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ArrowDown } from 'lucide-react';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export function Hero() {
  const heroImage = PlaceHolderImages.find(p => p.id === 'hero-background');
  
  return (
    <section id="home" className="relative h-[90vh] min-h-[600px] flex items-center justify-center text-center text-white py-0">
      {heroImage && (
        <Image
          src={heroImage.imageUrl}
          alt={heroImage.description}
          fill
          priority
          className="object-cover"
          data-ai-hint={heroImage.imageHint}
        />
      )}
      <div className="absolute inset-0 bg-primary/70" />
      <div className="relative z-10 container mx-auto px-4">
        <h1 className="text-5xl md:text-7xl lg:text-8xl font-headline mb-4 drop-shadow-lg">
          Crafting Digital Excellence
        </h1>
        <p className="text-xl md:text-2xl max-w-3xl mx-auto text-primary-foreground/90 mb-8 drop-shadow-md">
          Innovative design and development for standout web experiences.
        </p>
        <div className="flex justify-center gap-4">
          <Button size="lg" asChild>
            <a href="#projects">View My Work</a>
          </Button>
          <Button size="lg" variant="outline" asChild className="bg-transparent text-white border-white hover:bg-white hover:text-primary">
            <a href="#contact">Get in Touch</a>
          </Button>
        </div>
      </div>
      <a href="#about" className="absolute bottom-10 z-10 animate-bounce" aria-label="Scroll to about section">
        <ArrowDown className="h-8 w-8 text-white"/>
      </a>
    </section>
  );
}
