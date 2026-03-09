'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './ui/form';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { sendFeedback } from '@/actions/send-feedback';

const feedbackSchema = z.object({
  userEmail: z.string().email({ message: 'Por favor, introduce un correo válido.' }),
  title: z.string().min(5, { message: 'El título debe tener al menos 5 caracteres.' }),
  content: z.string().min(10, { message: 'El comentario debe tener al menos 10 caracteres.' }),
});

type FeedbackFormValues = z.infer<typeof feedbackSchema>;

interface FeedbackDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function FeedbackDialog({ isOpen, onOpenChange }: FeedbackDialogProps) {
  const form = useForm<FeedbackFormValues>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: {
      userEmail: '',
      title: '',
      content: '',
    },
  });

  const { isSubmitting } = form.formState;

  React.useEffect(() => {
    if (!isOpen) {
      form.reset();
    }
  }, [form, isOpen]);

  const onSubmit = async (data: FeedbackFormValues) => {
    const result = await sendFeedback(data);

    if (result.success) {
      toast({
        title: "¡Comentario enviado!",
        description: "Gracias por tu feedback, nos ayuda a mejorar.",
      });
      onOpenChange(false);
    } else {
      toast({
        variant: "destructive",
        title: "Error al enviar",
        description: result.message,
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] bg-zinc-300 text-black">
        <DialogHeader>
          <DialogTitle className="font-headline">Enviar Comentarios</DialogTitle>
          <DialogDescription className="text-zinc-700">
            Tus sugerencias nos ayudan a mejorar. Completa el formulario y lo enviaremos directamente.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="userEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tu Correo Electrónico</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="tu.correo@dominio.com" {...field} className="bg-zinc-100 text-black border-zinc-400 placeholder:text-zinc-500" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Asunto</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Sugerencia para la línea de tiempo" {...field} className="bg-zinc-100 text-black border-zinc-400 placeholder:text-zinc-500" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Comentario</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe tu sugerencia o el problema que encontraste."
                      className="resize-none bg-zinc-100 text-black border-zinc-400 placeholder:text-zinc-500"
                      rows={5}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="text-black border-zinc-400 hover:bg-zinc-200">
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? 'Enviando...' : 'Enviar Comentario'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
