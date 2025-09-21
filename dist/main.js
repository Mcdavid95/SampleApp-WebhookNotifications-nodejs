"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const path_1 = require("path");
const session = require("express-session");
const exphbs = require("express-handlebars");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.useStaticAssets((0, path_1.join)(__dirname, '..', 'views'));
    app.setBaseViewsDir((0, path_1.join)(__dirname, '..', 'views'));
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
//# sourceMappingURL=main.js.map