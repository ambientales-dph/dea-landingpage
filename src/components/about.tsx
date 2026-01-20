import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export function About() {
  const aboutImage = PlaceHolderImages.find(img => img.id === 'about-image');

  return (
    <section id="about" className="bg-card">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-5 gap-12 items-center">
          <div className="md:col-span-2">
            {aboutImage && (
              <div className="relative aspect-[3/4] rounded-lg overflow-hidden shadow-lg transform transition-transform duration-500 hover:scale-105">
                <Image
                  src={aboutImage.imageUrl}
                  alt={aboutImage.description}
                  fill
                  className="object-cover"
                  data-ai-hint={aboutImage.imageHint}
                />
              </div>
            )}
          </div>
          <div className="md:col-span-3">
            <h2 className="text-4xl md:text-5xl font-headline text-primary mb-6">About the Work</h2>
            <div className="space-y-4 text-lg text-foreground/80">
              <p>
                Welcome to my digital portfolio. I am a passionate creator specializing in modern web development and user-centric design. With a keen eye for aesthetics and a strong foundation in cutting-edge technologies, I strive to build digital experiences that are not only beautiful but also intuitive and performant.
              </p>
              <p>
                My approach is collaborative and transparent. I believe in working closely with clients to understand their vision and translate it into a compelling digital presence. From initial concept to final deployment, my goal is to deliver solutions that exceed expectations and drive results.
              </p>
              <p>
                This space is a curated collection of projects that reflect my dedication to quality, creativity, and innovation.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
