'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { testimonials as allTestimonials, type Testimonial } from '@/app/lib/data';
import { getRelevance } from '@/app/actions';
import { Skeleton } from '@/components/ui/skeleton';
import { Quote } from 'lucide-react';

type TestimonialWithRelevance = Testimonial & { relevanceScore: number };

function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
  return (
    <Card className="h-full bg-accent/30 border-accent/50">
      <CardContent className="flex flex-col items-center justify-center p-8 text-center h-full">
        <Quote className="w-10 h-10 text-accent mb-4" />
        <p className="text-lg md:text-xl font-medium text-foreground/90 mb-4 italic">
          "{testimonial.quote}"
        </p>
        <footer className="mt-auto">
          <p className="font-bold font-headline text-primary">{testimonial.author}</p>
          <p className="text-sm text-muted-foreground">{testimonial.company}</p>
        </footer>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
    return (
        <div className="p-1">
            <Card className="h-full bg-muted">
                <CardContent className="flex flex-col items-center justify-center p-8 text-center h-full min-h-[300px]">
                    <Skeleton className="w-10 h-10 rounded-full mb-4" />
                    <Skeleton className="h-6 w-3/4 mb-4" />
                    <Skeleton className="h-6 w-1/2 mb-6" />
                    <div className="mt-auto w-full flex flex-col items-center">
                        <Skeleton className="h-5 w-24 mb-2" />
                        <Skeleton className="h-4 w-32" />
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

export function Testimonials() {
  const [sortedTestimonials, setSortedTestimonials] = useState<TestimonialWithRelevance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // This is a simulation of visitor activity.
    // In a real app, this could be built from analytics, user navigation history, etc.
    const visitorActivity = 'Visited the projects page, spent 3 minutes looking at web design and e-commerce projects, and clicked on the "Hire Me" button.';

    async function fetchRelevanceScores() {
      try {
        const testimonialsWithScores = await Promise.all(
          allTestimonials.map(async (testimonial) => {
            const { relevanceScore } = await getRelevance(visitorActivity, testimonial.quote);
            return { ...testimonial, relevanceScore };
          })
        );
        
        testimonialsWithScores.sort((a, b) => b.relevanceScore - a.relevanceScore);
        
        setSortedTestimonials(testimonialsWithScores);
      } catch (error) {
        console.error("Failed to fetch and sort testimonials:", error);
        // Fallback to original order if AI fails
        const fallbackTestimonials = allTestimonials.map(t => ({...t, relevanceScore: 0}))
        setSortedTestimonials(fallbackTestimonials);
      } finally {
        setLoading(false);
      }
    }

    fetchRelevanceScores();
  }, []);

  return (
    <section id="testimonials" className="bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-headline text-primary">What Clients Say</h2>
          <p className="text-lg text-foreground/80 mt-4 max-w-2xl mx-auto">
            AI-powered relevance to show you the most pertinent feedback.
          </p>
        </div>
        
        <Carousel
          opts={{
            align: "start",
            loop: true,
          }}
          className="w-full max-w-4xl mx-auto"
        >
          <CarouselContent>
            {loading ? (
                Array.from({ length: 3 }).map((_, index) => (
                    <CarouselItem key={index} className="md:basis-1/2 lg:basis-1/2">
                        <LoadingSkeleton />
                    </CarouselItem>
                ))
            ) : (
                sortedTestimonials.map((testimonial) => (
                <CarouselItem key={testimonial.id} className="md:basis-1/2 p-4">
                    <TestimonialCard testimonial={testimonial} />
                </CarouselItem>
                ))
            )}
          </CarouselContent>
          <CarouselPrevious className="hidden sm:flex" />
          <CarouselNext className="hidden sm:flex" />
        </Carousel>
      </div>
    </section>
  );
}
