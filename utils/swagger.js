// filepath: c:\Users\deanm\repos\BlogNodeJs\server\swagger.js
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

/**
 * Swagger/OpenAPI helper. Exposes `swaggerSpec`, `swaggerUiMiddleware` and
 * `swaggerUiSetup` which can be mounted in `app.js` for interactive API docs.
 */
const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'BlogNodeJs API',
      version: '1.0.0',
    },
  },
  apis: ['./routes/*.js'], // Pfad zu deinen Endpunkten
};

export const swaggerSpec = swaggerJSDoc(options);
export const swaggerUiMiddleware = swaggerUi.serve;
export const swaggerUiSetup = swaggerUi.setup(swaggerSpec);