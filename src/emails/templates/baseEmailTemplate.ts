type EmailTemplateParams = {
  title: string;
  content: string;
};

export function baseEmailTemplate({ title, content }: EmailTemplateParams): string {
  return `
  <!DOCTYPE html>
  <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <link href="https://fonts.googleapis.com/css2?family=Fustat&display=swap" rel="stylesheet">
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Fustat', sans-serif;">

      <div style="max-width: 600px; margin: 40px auto; border-radius: 16px; overflow: hidden;">

        <!-- Header con degradado -->
        <div style="background: linear-gradient(135deg, #000000, #000000); padding: 24px; text-align: center;">
          <img src="https://res.cloudinary.com/delcvo0yz/image/upload/v1751441756/products/ca4c68b5-eee2-42af-9aa5-922d99bb6096.jpg" 
               alt="Gophone" 
               style="height: 48px; border-radius: 10px; margin-bottom: 12px;" />
          <h1 style="color: #ffffff; font-size: 24px; margin: 0;">${title}</h1>
        </div>

        <!-- Cuerpo del correo -->
        <div style="padding: 32px 24px; color: #374151; font-size: 14px; line-height: 1.2;">
          ${content}
        </div>

        <!-- Separador decorativo -->
        <div style="border-top: 1px solid #e5e7eb; margin: 0 24px;"></div>

        <!-- Footer -->
        <div style="padding: 24px; text-align: center; font-size: 13px; color: #9ca3af;">
          © ${new Date().getFullYear()} <strong style="color: #4f46e5;"><a href="https://gophone.pe">Gophone.pe</a></strong><br/>
          Este mensaje fue enviado automáticamente. No respondas a este correo.
        </div>
      </div>

    </body>
  </html>
  `;
}
