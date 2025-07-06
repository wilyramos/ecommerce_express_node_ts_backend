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
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        /* Global Reset & Body */
        body {
          margin: 0;
          padding: 0;
          font-family: 'IBM Plex Sans', sans-serif;
          background-color: #f0f4f8; /* Softer, modern background */
          -webkit-text-size-adjust: 100%;
          -ms-text-size-adjust: 100%;
          width: 100% !important;
        }

        /* Container & Card Effect */
        .container {
          max-width: 600px;
          margin: 40px auto;
          background-color: #ffffff;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 15px 35px rgba(0, 0, 0, 0.08), 0 5px 15px rgba(0, 0, 0, 0.05); /* More pronounced, layered shadow */
          -webkit-font-smoothing: antialiased;
        }

        /* Header Section */
        .header {
          background: linear-gradient(135deg, #1e3a8a, #3b82f6); /* Dynamic blue gradient */
          padding: 35px 24px;
          text-align: center;
          color: #ffffff;
          position: relative;
        }
        .header::before { /* Subtle background pattern/texture */
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-image: url('data:image/svg+xml;charset=UTF-8,%3Csvg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"%3E%3Cpath d="M0 8H8V16H0V8Z" fill="%23ffffff" fill-opacity="0.05"/%3E%3Cpath d="M8 0H16V8H8V0Z" fill="%23ffffff" fill-opacity="0.05"/%3E%3C/svg%3E');
            background-repeat: repeat;
            opacity: 0.8;
            pointer-events: none;
        }
        .header-content { /* Ensures text is above pseudo-element */
            position: relative;
            z-index: 1;
        }
        .header .logo-text {
          font-size: 24px;
          font-weight: 700; /* Bolder logo text */
          margin-bottom: 5px;
          line-height: 1.2;
        }
        .header .tagline {
          font-size: 13px;
          color: #bfdbfe; /* Lighter blue for tagline */
          margin-top: 0;
          margin-bottom: 20px;
        }
        .header h1 {
          font-size: 32px;
          margin: 0;
          font-weight: 700;
          line-height: 1.2;
        }

        /* Content Section */
        .content-body {
          padding: 35px 35px; /* More generous padding */
          color: #374151; /* Darker, sophisticated text color */
          font-size: 16px;
          line-height: 1.7; /* Increased line height for readability */
        }
        .content-body p {
            margin-bottom: 1em; /* Consistent paragraph spacing */
        }

        /* Call to Action Button */
        .button-section {
          padding: 0 35px 35px;
          text-align: center;
        }
        .button {
          display: inline-block;
          background: linear-gradient(90deg, #10b981, #059669); /* Engaging green gradient */
          color: #ffffff !important; /* Ensure text color is white */
          padding: 14px 28px;
          border-radius: 8px; /* Slightly more rounded */
          text-decoration: none;
          font-weight: 600;
          font-size: 17px;
          transition: background-color 0.3s ease; /* Smooth transition for hover effect (limited email client support) */
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15); /* Subtle button shadow */
        }
        .button:hover {
          background: linear-gradient(90deg, #059669, #10b981); /* Reverse gradient on hover */
        }

        /* Divider */
        .divider {
          border-top: 1px solid #e2e8f0;
          margin: 0 35px; /* Aligned with content padding */
        }

        /* Footer Section */
        .footer {
          padding: 28px 35px;
          text-align: center;
          font-size: 12px;
          color: #6b7280; /* Muted gray */
        }
        .footer a {
          color: #2563eb; /* Stronger blue for links */
          text-decoration: none;
          font-weight: 500;
        }
        .footer a:hover {
            text-decoration: underline;
        }

        /* Responsive Styles (limited support in some clients) */
        @media only screen and (max-width: 620px) {
          .container {
            margin: 20px auto;
            border-radius: 0; /* Remove border-radius on small screens for full width */
            box-shadow: none;
          }
          .header, .content-body, .button-section, .footer, .divider {
            padding-left: 20px !important;
            padding-right: 20px !important;
          }
          .header h1 {
            font-size: 28px !important;
          }
          .button {
            padding: 12px 24px !important;
            font-size: 16px !important;
          }
        }
      </style>
    </head>
    <body>

      <div class="container">

        <div class="header">
          <div class="header-content">
            <p class="logo-text">GoPhone Cañete</p>
            <p class="tagline">San Vicente de Cañete, Lima, Perú</p>
            <h1>${title}</h1>
          </div>
        </div>

        <div class="content-body">
          ${content}
        </div>


        <div class="divider"></div>

        <div class="footer">
          © ${new Date().getFullYear()} <strong><a href="https://gophone.pe">Gophone.pe</a></strong><br/>
          Este mensaje fue enviado automáticamente. Por favor, no respondas a este correo.
        </div>
      </div>

    </body>
  </html>
  `;
}