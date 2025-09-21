import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import * as session from 'express-session';
import * as exphbs from 'express-handlebars';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useStaticAssets(join(__dirname, '..', 'views'));
  app.setBaseViewsDir(join(__dirname, '..', 'views'));

  const hbs = exphbs.create({
    defaultLayout: false
  });
  app.engine('handlebars', hbs.engine);
  app.setViewEngine('handlebars');

  app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: false
  }));

  await app.listen(8443);
  console.log('Example app listening on port 8443!');
}
bootstrap();