'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, Briefcase } from 'lucide-react';
import { cn } from '@/lib/utils';

const navLinks = [
  { name: 'About', href: '#about' },
  { name: 'Projects', href: '#projects' },
  { name: 'Testimonials', href: '#testimonials' },
  { name: 'Blog', href: '#blog' },
  { name: 'Contact', href: '#contact' },
];

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={cn(
      "sticky top-0 z-50 w-full transition-all duration-300",
      isScrolled ? "bg-background/80 backdrop-blur-sm shadow-md" : "bg-transparent"
    )}>
      <div className="container mx-auto px-4">
        <div className="flex h-20 items-center justify-between">
          <a href="#" className="flex items-center gap-2 font-headline text-2xl text-primary font-bold">
            <Briefcase className="h-6 w-6" />
            <span>Work Showcase</span>
          </a>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-2">
            {navLinks.map((link) => (
              <Button key={link.name} variant="ghost" asChild>
                <a href={link.href}>{link.name}</a>
              </Button>
            ))}
            <Button asChild>
              <a href="#contact">Hire Me</a>
            </Button>
          </nav>

          {/* Mobile Navigation */}
          <div className="md:hidden">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                <nav className="flex flex-col h-full p-6">
                  <a href="#" className="flex items-center gap-2 font-headline text-2xl text-primary font-bold mb-8" onClick={() => setMobileMenuOpen(false)}>
                    <Briefcase className="h-6 w-6" />
                    <span>Work Showcase</span>
                  </a>
                  <div className="flex flex-col space-y-4">
                    {navLinks.map((link) => (
                      <a 
                        key={link.name} 
                        href={link.href} 
                        className="text-lg font-medium text-foreground hover:text-primary transition-colors"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        {link.name}
                      </a>
                    ))}
                  </div>
                  <Button asChild className="mt-auto">
                    <a href="#contact" onClick={() => setMobileMenuOpen(false)}>Hire Me</a>
                  </Button>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
