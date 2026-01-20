import { blogPosts, type BlogPost } from '@/app/lib/data';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

function BlogPostCard({ post }: { post: BlogPost }) {
  return (
    <Card className="overflow-hidden h-full flex flex-col group transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
      {post.image && (
         <div className="aspect-video overflow-hidden">
            <Image
              src={post.image.imageUrl}
              alt={post.image.description}
              width={600}
              height={400}
              className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105"
              data-ai-hint={post.image.imageHint}
            />
        </div>
      )}
      <CardHeader>
        <p className="text-sm text-muted-foreground">{new Date(post.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        <h3 className="text-xl font-bold font-headline">{post.title}</h3>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col">
        <p className="text-foreground/80 flex-grow">{post.excerpt}</p>
        <Button variant="link" className="p-0 mt-4 self-start text-primary">
          Read More <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

export function Blog() {
  return (
    <section id="blog" className="bg-card">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-headline text-primary">From the Blog</h2>
          <p className="text-lg text-foreground/80 mt-4 max-w-2xl mx-auto">
            Sharing updates, insights, and news from my field.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {blogPosts.map((post) => (
            <BlogPostCard key={post.id} post={post} />
          ))}
        </div>
      </div>
    </section>
  );
}
