import { Github, Linkedin, Twitter } from "lucide-react";
import { Button } from "./ui/button";

const socialLinks = [
  { icon: Twitter, href: "#", name: "Twitter" },
  { icon: Github, href: "#", name: "Github" },
  { icon: Linkedin, href: "#", name: "LinkedIn" },
];

export function Footer() {
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <p className="text-sm mb-4 md:mb-0">
            &copy; {new Date().getFullYear()} Work Showcase. All Rights Reserved.
          </p>
          <div className="flex items-center space-x-2">
            {socialLinks.map((link) => (
              <Button key={link.name} variant="ghost" size="icon" asChild className="text-primary-foreground hover:bg-primary-foreground/10">
                <a href={link.href} aria-label={link.name}>
                  <link.icon className="h-5 w-5" />
                </a>
              </Button>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
