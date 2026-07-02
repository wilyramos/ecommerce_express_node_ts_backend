// File: backend/src/emails/templates/baseEmailTemplate.ts

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
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>${title}</title>
  </head>
  <body style="margin:0; padding:0; background-color:#ffffff; font-family:'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing:antialiased;">

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff;">
      <tr>
        <td align="center" style="padding: 48px 16px 64px;">

          <!-- Contenedor principal -->
          <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0"
            style="max-width:560px; width:100%;">

            <!-- Logo + marca -->
            <tr>
              <td style="padding-bottom: 40px;">
                <img
                  src="https://www.gophone.pe/logogophone.png"
                  alt="GoPhone"
                  style="height:32px; width:auto; display:block;"
                />
              </td>
            </tr>

            <!-- Línea divisora superior -->
            <tr>
              <td style="padding-bottom: 32px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="height:1px; background-color:#e8e8e8; font-size:0; line-height:0;">&nbsp;</td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Título -->
            <tr>
              <td style="padding-bottom: 32px;">
                <h1 style="margin:0; font-size:22px; font-weight:600; color:#0f0f0f; letter-spacing:-0.3px; line-height:1.3;">
                  ${title}
                </h1>
              </td>
            </tr>

            <!-- Contenido dinámico -->
            <tr>
              <td style="color:#3a3a3a; font-size:15px; line-height:1.7;">
                ${content}
              </td>
            </tr>

            <!-- Línea divisora inferior -->
            <tr>
              <td style="padding-top: 48px; padding-bottom: 28px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="height:1px; background-color:#e8e8e8; font-size:0; line-height:0;">&nbsp;</td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="vertical-align:middle;">
                      <p style="margin:0; font-size:12px; color:#0f0f0f; font-weight:600; letter-spacing:0.04em; text-transform:uppercase;">
                        GoPhone.pe
                      </p>
                      <p style="margin:4px 0 0; font-size:12px; color:#9a9a9a;">
                        Calidad a tu alcance.
                      </p>
                    </td>
                    <td align="right" style="vertical-align:middle;">
                      <p style="margin:0; font-size:11px; color:#b0b0b0; line-height:1.6; text-align:right;">
                        © ${new Date().getFullYear()} Gophone.pe<br/>
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>

  </body>
</html>
  `.trim();
}