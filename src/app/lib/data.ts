import { PlaceHolderImages } from "@/lib/placeholder-images";

const findImage = (id: string) => PlaceHolderImages.find(img => img.id === id);

export const projects = [
  {
    id: 'proj-1',
    title: "Vibrant Branding for a Startup",
    description: "A complete branding package, including logo design, color palette, and typography for a new tech startup aiming to disrupt the market.",
    image: findImage('project-1'),
  },
  {
    id: 'proj-2',
    title: "E-commerce Platform Redesign",
    description: "User experience and interface overhaul for a popular online retailer, resulting in a 25% increase in conversion rates.",
    image: findImage('project-2'),
  },
  {
    id: 'proj-3',
    title: "Mobile App for a Fitness Brand",
    description: "Designed and developed an intuitive mobile application for workout tracking, meal planning, and community engagement.",
    image: findImage('project-3'),
  },
];

export const testimonials = [
  {
    id: 'test-1',
    quote: "The team's creativity and attention to detail for our new company website were outstanding. They captured our brand's essence perfectly.",
    author: "Jane Doe",
    company: "Tech Solutions Inc.",
  },
  {
    id: 'test-2',
    quote: "Working with them on our mobile app was a fantastic experience. The final product exceeded all our expectations and our users love it.",
    author: "John Smith",
    company: "FitLife Apps",
  },
  {
    id: 'test-3',
    quote: "The rebranding project was a huge success. We've seen a significant increase in brand recognition and customer engagement.",
    author: "Emily White",
    company: "Creative Co.",
  },
  {
    id: 'test-4',
    quote: "Their insights into UI/UX are second to none. The e-commerce redesign not only looks great but is also incredibly user-friendly.",
    author: "Michael Brown",
    company: "Shopify Store Pro",
  },
];

export const blogPosts = [
  {
    id: 'blog-1',
    title: "The Future of Web Design in 2024",
    excerpt: "Exploring the latest trends, from AI-driven interfaces to sustainable design principles.",
    date: "2024-05-15",
    image: findImage('blog-1'),
  },
  {
    id: 'blog-2',
    title: "Why Your Startup Needs a Strong Brand Identity",
    excerpt: "A deep dive into how branding can make or break your new business venture.",
    date: "2024-04-22",
    image: findImage('blog-2'),
  },
  {
    id: 'blog-3',
    title: "Our 5-Step Creative Process",
    excerpt: "A behind-the-scenes look at how we bring ideas to life, from initial concept to final delivery.",
    date: "2024-03-10",
    image: findImage('blog-3'),
  },
];

export type Project = typeof projects[0];
export type Testimonial = typeof testimonials[0];
export type BlogPost = typeof blogPosts[0];
