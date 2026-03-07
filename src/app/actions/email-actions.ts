
'use server';

import nodemailer from 'nodemailer';

export type EmailResult = {
  success: boolean;
  message?: string;
  error?: string;
};

/**
 * Envía un correo electrónico utilizando la cuenta central ambientales.dph@gmail.com
 * pero configurando el Reply-To con el correo del usuario logueado.
 * 
 * NOTA IMPORTANTE: Para GMAIL_PASS se debe utilizar una "Contraseña de Aplicación" 
 * generada desde la configuración de seguridad de la cuenta de Google.
 */
export async function sendProjectEmail({
  to,
  subject,
  body,
  replyTo,
}: {
  to: string;
  subject: string;
  body: string;
  replyTo: string;
}): Promise<EmailResult> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_PASS;

  if (!user || !pass) {
    return { 
      success: false, 
      error: 'Servidor de correo no configurado. Falta GMAIL_USER o GMAIL_PASS en .env' 
    };
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });

  const mailOptions = {
    from: `"Portal DEA" <${user}>`,
    to,
    subject,
    text: body,
    replyTo,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true, message: 'Correo enviado correctamente.' };
  } catch (error: any) {
    console.error('Error al enviar correo:', error);
    // Mejorar el mensaje de error para el usuario en caso de fallo de autenticación común
    if (error.message.includes('535-5.7.8')) {
        return { 
            success: false, 
            error: 'Error de autenticación: Asegurate de estar usando una "Contraseña de Aplicación" de Google y no tu clave normal.' 
        };
    }
    return { success: false, error: error.message || 'Error desconocido al enviar el mail.' };
  }
}
